import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/app/api/routes-d/disputes/_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const webhookId = request.nextUrl.searchParams.get('webhookId')

    if (webhookId) {
      const webhook = await prisma.userWebhook.findFirst({
        where: {
          id: webhookId,
          userId: auth.user.id,
        },
        select: { id: true },
      })

      if (!webhook) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
      }
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhook: { userId: auth.user.id },
        ...(webhookId ? { webhookId } : {}),
      },
      select: {
        id: true,
        webhookId: true,
        eventType: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        nextRetryAt: true,
        lastError: true,
        successAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ deliveries })
  } catch (error) {
    console.error('Webhook deliveries GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch webhook deliveries' }, { status: 500 })
  }
}
