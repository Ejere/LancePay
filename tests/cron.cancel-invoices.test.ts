import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/cron/cancel-overdue-invoices/route'
import { prisma } from '@/lib/db'
import { sendInvoiceCancelledEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'

vi.mock('@/lib/db', () => ({
    prisma: {
        invoice: {
            findMany: vi.fn(),
            update: vi.fn()
        }
    }
}))

vi.mock('@/lib/email', () => ({
    sendInvoiceCancelledEmail: vi.fn().mockResolvedValue({ success: true })
}))

vi.mock('@/lib/audit', () => ({
    logAuditEvent: vi.fn().mockResolvedValue(true)
}))

describe('Cancel Overdue Invoices Cron', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.CRON_SECRET = 'test-secret'
    })

    const makeAuthRequest = (token = 'Bearer test-secret') => {
        const req = new Request('http://localhost:3000/api/cron/cancel-overdue-invoices', {
            headers: { authorization: token }
        })
        return req
    }

    it('rejects an unauthorized request', async () => {
        const res = await GET(makeAuthRequest('Bearer wrong-secret'))
        expect(res.status).toBe(401)
    })

    it('fetches eligible invoices with correct where clause including all exclusions', async () => {
        vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([])
        await GET(makeAuthRequest())

        expect(prisma.invoice.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: 'pending',
                    doNotAutoCancel: false,
                    dispute: { is: null },
                    escrowEnabled: false,
                })
            })
        )

        // Check that dueDate constraint is correct
        const calls = vi.mocked(prisma.invoice.findMany).mock.calls
        const where = calls[0][0].where as any
        expect(where.dueDate.lt).toBeInstanceOf(Date)

        // Roughly check if date is 90 days ago
        const msDiff = Date.now() - where.dueDate.lt.getTime()
        const daysDiff = msDiff / (1000 * 60 * 60 * 24)
        expect(daysDiff).toBeCloseTo(90, 0)
    })

    it('processes an eligible invoice: releases lien, audits, and emails', async () => {
        const mockInvoice = {
            id: 'inv-123',
            invoiceNumber: 'INV001',
            amount: '500.00',
            clientEmail: 'client@example.com',
            dueDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
            user: { name: 'Freelancer', email: 'free@lancer.com' }
        }

        vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([mockInvoice as any])
        vi.mocked(prisma.invoice.update).mockResolvedValueOnce({ ...mockInvoice, status: 'cancelled' } as any)

        const res = await GET(makeAuthRequest())
        const json = await res.json()

        expect(json.success).toBe(true)
        expect(json.cancelledCount).toBe(1)
        expect(json.cancelledInvoiceIds).toContain('inv-123')

        // Lien release and status atomic update
        expect(prisma.invoice.update).toHaveBeenCalledWith({
            where: { id: 'inv-123' },
            data: expect.objectContaining({
                status: 'cancelled',
                cancellationReason: 'Auto-cancelled: 90 days overdue',
                lienActive: false,
            })
        })

        // Audit event
        expect(logAuditEvent).toHaveBeenCalledWith(
            'inv-123',
            'invoice.auto_cancelled',
            null,
            { reason: 'Auto-cancelled: 90 days overdue' }
        )

        // Email
        expect(sendInvoiceCancelledEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'free@lancer.com',
                invoiceNumber: 'INV001',
                amount: 500,
                daysOverdue: expect.any(Number)
            })
        )
    })
})
