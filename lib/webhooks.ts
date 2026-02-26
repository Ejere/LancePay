import crypto from 'crypto'
import { enqueueWebhook, processWebhookDeliveryNow } from './webhook-queue'

/**
 * Supported webhook event types
 */
export type WebhookEventType =
  | 'invoice.paid'
  | 'invoice.viewed'
  | 'invoice.created'
  | 'invoice.disputed'
  | 'invoice.message'
  | 'withdrawal.completed'
  | 'withdrawal.failed'

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  data: Record<string, unknown>
}

/**
 * Compute HMAC-SHA256 signature for webhook payload
 */
export function computeWebhookSignature(
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Dispatch webhooks for a specific event to all subscribed users
 * This function runs asynchronously and does not block the calling thread
 * Call without await to fire-and-forget
 */
export async function dispatchWebhooks(
  userId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Find all active webhooks for this user subscribed to this event
    const webhooks = await prisma.userWebhook.findMany({
      where: {
        userId,
        isActive: true,
        subscribedEvents: {
          has: eventType,
        },
      },
    })

    if (webhooks.length === 0) {
      return // No webhooks to dispatch
    }

    // Construct the webhook payload
    const webhookPayload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    }

    // Queue each delivery and attempt first dispatch immediately.
    // Retries are handled by the webhook queue processor.
    await Promise.all(
      webhooks.map(async (webhook) => {
        const delivery = await enqueueWebhook(webhook.id, eventType, webhookPayload)
        processWebhookDeliveryNow(delivery.id).catch((error) => {
          console.error(`Failed to dispatch webhook delivery ${delivery.id}:`, error)
        })
      })
    )
  } catch (error) {
    console.error('Error dispatching webhooks:', error)
    // Don't throw - webhook failures shouldn't break the main flow
  }
}

/**
 * Generate a secure webhook signing secret
 */
export function generateWebhookSecret(): string {
  const randomBytes = crypto.randomBytes(32)
  return `whsec_${randomBytes.toString('base64url')}`
}

/**
 * Verify a webhook signature (for testing/debugging)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = computeWebhookSignature(payload, secret)

  // Ensure both signatures have the same length
  if (signature.length !== expectedSignature.length) {
    return false
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}
