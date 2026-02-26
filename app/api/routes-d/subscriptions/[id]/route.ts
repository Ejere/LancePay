import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'

async function getAuthenticatedUser(request: NextRequest) {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!authToken) return null

    const claims = await verifyAuthToken(authToken)
    if (!claims) return null

    return await prisma.user.findUnique({ where: { privyId: claims.userId } })
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { status } = body

        if (status && !['active', 'paused', 'cancelled'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        const subscription = await (prisma as any).subscription.update({
            where: { id, userId: user.id },
            data: { status },
        })

        return NextResponse.json(subscription)
    } catch (error) {
        console.error('Subscription PATCH error:', error)
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // We do a soft cancel instead of hard delete to keep records
        await (prisma as any).subscription.update({
            where: { id, userId: user.id },
            data: { status: 'cancelled' },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Subscription DELETE error:', error)
        return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
    }
}
