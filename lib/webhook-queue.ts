import crypto from 'crypto'
import { prisma } from '@/lib/db'
import type { WebhookPayload } from '@/lib/webhooks'

const DELIVERY_TIMEOUT_MS = 5000
const MAX_PROCESS_BATCH = 100
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000]

type DeliveryWithWebhook = {
  id: string
  webhookId: string
  eventType: string
  payload: unknown
  status: string
  attempts: number
  maxAttempts: number
  nextRetryAt: Date | null
  webhook: {
    id: string
    targetUrl: string
    signingSecret: string
    isActive: boolean
  }
}

function computeWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

export function calculateNextRetry(attempts: number): Date {
  const delayMs = RETRY_DELAYS_MS[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
  return new Date(Date.now() + delayMs)
}

export async function enqueueWebhook(
  webhookId: string,
  eventType: string,
  payload: WebhookPayload
) {
  return prisma.webhookDelivery.create({
    data: {
      webhookId,
      eventType,
      payload,
      status: 'pending',
      nextRetryAt: new Date(),
    },
    select: { id: true },
  })
}

export async function processWebhookQueue(limit = MAX_PROCESS_BATCH) {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: new Date() },
    },
    include: {
      webhook: {
        select: {
          id: true,
          targetUrl: true,
          signingSecret: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const results = await Promise.all(
    deliveries.map((delivery) => processWebhookDelivery(delivery as DeliveryWithWebhook))
  )

  const summary = results.reduce(
    (acc, item) => {
      if (item.success) acc.success += 1
      else acc.failed += 1
      return acc
    },
    { processed: results.length, success: 0, failed: 0 }
  )

  return summary
}

export async function processWebhookDeliveryNow(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhook: {
        select: {
          id: true,
          targetUrl: true,
          signingSecret: true,
          isActive: true,
        },
      },
    },
  })

  if (!delivery) {
    return { success: false, error: 'Delivery not found' }
  }

  return processWebhookDelivery(delivery as DeliveryWithWebhook)
}

export async function resetWebhookDeliveryForRetry(deliveryId: string) {
  return prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      attempts: 0,
      nextRetryAt: new Date(),
      lastError: null,
      successAt: null,
    },
  })
}

async function processWebhookDelivery(delivery: DeliveryWithWebhook) {
  if (delivery.status === 'success' || delivery.status === 'exhausted') {
    return { success: false, error: `Delivery already ${delivery.status}` }
  }

  if (!delivery.webhook.isActive) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        lastError: 'Webhook is inactive',
        attempts: delivery.attempts + 1,
        nextRetryAt: calculateNextRetry(delivery.attempts + 1),
      },
    })
    return { success: false, error: 'Webhook is inactive' }
  }

  const payloadString = JSON.stringify(delivery.payload)
  const signature = computeWebhookSignature(payloadString, delivery.webhook.signingSecret)
  const nextAttempt = delivery.attempts + 1

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(delivery.webhook.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LancePay-Signature': signature,
          'X-LancePay-Event': delivery.eventType,
          'User-Agent': 'LancePay-Webhooks/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      throw new Error(`Webhook endpoint returned ${response.status}`)
    }

    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'success',
          attempts: nextAttempt,
          successAt: new Date(),
          nextRetryAt: null,
          lastError: null,
        },
      }),
      prisma.userWebhook.update({
        where: { id: delivery.webhookId },
        data: { lastTriggeredAt: new Date() },
      }),
    ])

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown webhook error'
    const exhausted = nextAttempt >= delivery.maxAttempts

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted ? 'exhausted' : 'pending',
        attempts: nextAttempt,
        lastError: errorMessage,
        nextRetryAt: exhausted ? null : calculateNextRetry(nextAttempt),
      },
    })

    return { success: false, error: errorMessage }
  }
}
