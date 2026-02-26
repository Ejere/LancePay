import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOrCreateUserFromRequest } from '@/app/api/routes-d/bulk-invoices/_shared'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function parseLimit(rawLimit: string | null): { ok: true; value: number } | { ok: false; error: string } {
  if (!rawLimit) return { ok: true, value: DEFAULT_LIMIT }

  const parsed = Number(rawLimit)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: 'limit must be a positive integer' }
  }

  return { ok: true, value: Math.min(parsed, MAX_LIMIT) }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getOrCreateUserFromRequest(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const limitResult = parseLimit(request.nextUrl.searchParams.get('limit'))
    if (!limitResult.ok) {
      return NextResponse.json({ error: limitResult.error }, { status: 400 })
    }

    const limit = limitResult.value
    const cursor = request.nextUrl.searchParams.get('cursor')

    if (cursor) {
      const cursorInvoice = await prisma.invoice.findFirst({
        where: { id: cursor, userId: auth.user.id },
        select: { id: true },
      })

      if (!cursorInvoice) {
        return NextResponse.json(
          { error: 'Invalid cursor' },
          { status: 400 }
        )
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId: auth.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.invoice.count({ where: { userId: auth.user.id } }),
    ])

    const hasMore = invoices.length > limit
    const pageInvoices = hasMore ? invoices.slice(0, limit) : invoices
    const nextCursor = hasMore ? pageInvoices[pageInvoices.length - 1]?.id ?? null : null

    return NextResponse.json({
      invoices: pageInvoices,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    })
  } catch (error) {
    console.error('Bulk invoice export error:', error)
    return NextResponse.json({ error: 'Failed to export invoices' }, { status: 500 })
  }
}
