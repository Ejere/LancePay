import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import { z } from 'zod'

const paymentMethodSchema = z.object({
    type: z.string(),
    name: z.string().optional(),
    value: z.string().min(1),
    isDefault: z.boolean().optional().default(false),
})

async function getAuthenticatedUser(request: NextRequest) {
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!authToken) return null

    const claims = await verifyAuthToken(authToken)
    if (!claims) return null

    return await prisma.user.findUnique({ where: { privyId: claims.userId } })
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const paymentMethods = await (prisma as any).paymentMethod.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ paymentMethods })
    } catch (error) {
        console.error('PaymentMethods GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const parsed = paymentMethodSchema.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

        const paymentMethod = await (prisma as any).paymentMethod.create({
            data: {
                userId: user.id,
                ...parsed.data
            }
        })

        return NextResponse.json(paymentMethod, { status: 201 })
    } catch (error) {
        console.error('PaymentMethods POST error:', error)
        return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 })
    }
}
