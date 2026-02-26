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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await (prisma as any).paymentMethod.delete({
            where: { id, userId: user.id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('PaymentMethod DELETE error:', error)
        return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
    }
}
