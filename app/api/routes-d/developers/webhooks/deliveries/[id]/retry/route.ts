import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/app/api/routes-d/disputes/_shared'
import { processWebhookDeliveryNow, resetWebhookDeliveryForRetry } from '@/lib/webhook-queue'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { id } = await params

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id },
      include: {
        webhook: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!delivery || delivery.webhook.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Webhook delivery not found' }, { status: 404 })
    }

    if (delivery.status === 'success') {
      return NextResponse.json(
        { error: 'Cannot retry a successful webhook delivery' },
        { status: 400 }
      )
    }

    await resetWebhookDeliveryForRetry(id)
    const result = await processWebhookDeliveryNow(id)

    const refreshed = await prisma.webhookDelivery.findUnique({
      where: { id },
      select: {
        id: true,
        eventType: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        nextRetryAt: true,
        lastError: true,
        successAt: true,
      },
    })

    return NextResponse.json({
      success: result.success,
      delivery: refreshed,
    })
  } catch (error) {
    console.error('Webhook delivery retry error:', error)
    return NextResponse.json({ error: 'Failed to retry webhook delivery' }, { status: 500 })
  }
}
