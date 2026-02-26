'use client'

import Link from 'next/link'
import { Plus, Repeat } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect, useCallback } from 'react'
import { SubscriptionCard } from '@/components/subscriptions/subscription-card'

export default function SubscriptionsPage() {
    const { getAccessToken } = usePrivy()
    const [subscriptions, setSubscriptions] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchSubscriptions = useCallback(async () => {
        try {
            const token = await getAccessToken()
            const res = await fetch('/api/routes-d/subscriptions', { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) setSubscriptions((await res.json()).subscriptions)
        } finally {
            setIsLoading(false)
        }
    }, [getAccessToken])

    useEffect(() => {
        fetchSubscriptions()
    }, [fetchSubscriptions])

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-brand-black">Subscriptions</h1>
                    <p className="text-brand-gray">Manage your recurring retainer billings</p>
                </div>
                <Link href="/dashboard/invoices/new" className="flex items-center gap-2 px-4 py-2.5 bg-brand-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                    <Plus className="w-5 h-5" />
                    New Subscription
                </Link>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-brand-border p-4 animate-pulse">
                            <div className="h-40 bg-gray-200 rounded" />
                        </div>
                    ))}
                </div>
            ) : subscriptions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-brand-border">
                    <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
                        <Repeat className="w-8 h-8 text-brand-gray" />
                    </div>
                    <p className="text-brand-gray mb-2">No active subscriptions yet</p>
                    <Link href="/dashboard/invoices/new" className="text-brand-black underline font-medium">Create your first retainer subscription</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subscriptions.map((sub: { id: string }) => (
                        <SubscriptionCard key={sub.id} subscription={sub as any} onUpdate={fetchSubscriptions} />
                    ))}
                </div>
            )}
        </div>
    )
}
