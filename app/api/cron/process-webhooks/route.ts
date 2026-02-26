import { NextRequest, NextResponse } from 'next/server'
import { processWebhookQueue } from '@/lib/webhook-queue'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await processWebhookQueue()
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Webhook queue cron error:', error)
    return NextResponse.json({ error: 'Failed to process webhook queue' }, { status: 500 })
  }
}
