import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import { createSubscriptionSchema } from '@/lib/validations'

async function getAuthenticatedUser(request: NextRequest) {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!authToken) return null

    const claims = await verifyAuthToken(authToken)
    if (!claims) return null

    let user = await prisma.user.findUnique({ where: { privyId: claims.userId } })
    if (!user) {
        // Basic auto-creation if user doesn't exist but has valid token
        const email = (claims as any).email || `${claims.userId}@privy.local`
        user = await prisma.user.create({
            data: {
                privyId: claims.userId,
                email,
            }
        })
    }
    return user
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const subscriptions = await (prisma as any).subscription.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ subscriptions })
    } catch (error) {
        console.error('Subscriptions GET error:', error)
        return NextResponse.json({ error: 'Failed to get subscriptions' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const parsed = createSubscriptionSchema.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

        const { clientEmail, clientName, description, amount, currency, frequency, interval, startDate } = parsed.data

        const start = startDate ? new Date(startDate) : new Date()

        const subscription = await (prisma as any).subscription.create({
            data: {
                userId: user.id,
                clientEmail,
                clientName,
                description,
                amount,
                currency,
                frequency,
                interval,
                nextGenerationDate: start,
                status: 'active',
            },
        })

        return NextResponse.json(subscription, { status: 201 })
    } catch (error) {
        console.error('Subscriptions POST error:', error)
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
    }
}
