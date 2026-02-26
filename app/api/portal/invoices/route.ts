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

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Fetch invoices where user is the client
        const invoices = await (prisma as any).invoice.findMany({
            where: {
                OR: [
                    { clientId: user.id },
                    { clientEmail: user.email }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                }
            }
        })

        return NextResponse.json({ invoices })
    } catch (error) {
        console.error('Portal Invoices GET error:', error)
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }
}
