import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { EscrowReleaseSchema, getAuthContext, releaseEscrowFunds } from '@/app/api/routes-d/escrow/_shared'
import { sendEscrowReleasedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await request.json()
    const parsed = EscrowReleaseSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })

    const { invoiceId, clientEmail, approvalNotes } = parsed.data

    // Prevent spoofing
    if (clientEmail.toLowerCase() !== auth.email.toLowerCase()) {
      return NextResponse.json({ error: 'clientEmail must match authenticated user email' }, { status: 403 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { user: { select: { email: true, name: true } } },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    if (invoice.clientEmail.toLowerCase() !== clientEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Not authorized (client email mismatch)' }, { status: 403 })
    }

    if (!(invoice as any).escrowEnabled) return NextResponse.json({ error: 'Escrow is not enabled for this invoice' }, { status: 400 })
    if ((invoice as any).escrowStatus !== 'held') return NextResponse.json({ error: `Invalid escrow status: ${(invoice as any).escrowStatus}` }, { status: 400 })

    // On-chain Release
    if ((invoice as any).escrowContractId) {
      try {
        await releaseEscrowFunds((invoice as any).escrowContractId)
      } catch (err) {
        logger.error({ err: err }, 'On-chain escrow release failed:')
        return NextResponse.json({ error: 'Failed to release escrow on-chain. Please ensure you have sufficient XLM for gas.' }, { status: 500 })
      }
    }

    const now = new Date()
    const updated = await prisma.$transaction(async (tx: any) => {
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: invoice.id,
          escrowEnabled: true,
          escrowStatus: 'held',
          clientEmail: invoice.clientEmail,
        },
        data: {
          escrowStatus: 'released',
          escrowReleasedAt: now,
        },
      })

      if (updateResult.count !== 1) {
        throw new Error('ESCROW_RELEASE_CONFLICT')
      }

      await tx.escrowEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: 'released',
          actorType: 'client',
          actorEmail: clientEmail,
          notes: approvalNotes || 'Client approved work and released escrow',
        },
      })

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        select: { id: true, escrowStatus: true, escrowReleasedAt: true },
      })
    })

    if (!updated) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.user.email) {
      await sendEscrowReleasedEmail({
        to: invoice.user.email,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail,
        notes: approvalNotes,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Escrow released to freelancer',
      invoice: {
        id: updated.id,
        escrowStatus: 'released',
        escrowReleasedAt: updated.escrowReleasedAt ? updated.escrowReleasedAt.toISOString() : now.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ESCROW_RELEASE_CONFLICT') {
      return NextResponse.json({ error: 'Escrow status changed. Please refresh and retry.' }, { status: 409 })
    }
    logger.error({ err: error }, 'Escrow release error:')
    return NextResponse.json({ error: 'Failed to release escrow' }, { status: 500 })
  }
}

