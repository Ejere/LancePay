'use client'

import { Repeat, Trash2, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

interface Subscription {
    id: string
    clientEmail: string
    description: string
    amount: number
    currency: string
    status: string
    frequency: string
    interval: number
    nextGenerationDate: string
}

export function SubscriptionCard({ subscription, onUpdate }: { subscription: Subscription, onUpdate: () => void }) {
    const { getAccessToken } = usePrivy()
    const [isLoading, setIsLoading] = useState(false)

    const toggleStatus = async () => {
        setIsLoading(true)
        try {
            const token = await getAccessToken()
            const newStatus = subscription.status === 'active' ? 'paused' : 'active'
            const res = await fetch(`/api/routes-d/subscriptions/${subscription.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            })
            if (res.ok) onUpdate()
        } catch (err) {
            console.error('Failed to toggle subscription status:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const cancel = async () => {
        if (!confirm('Are you sure you want to cancel this subscription?')) return
        setIsLoading(true)
        try {
            const token = await getAccessToken()
            const res = await fetch(`/api/routes-d/subscriptions/${subscription.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) onUpdate()
        } catch (err) {
            console.error('Failed to cancel subscription:', err)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-xl border border-brand-border p-4 hover:border-brand-black/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center">
                        <Repeat className="w-5 h-5 text-brand-black" />
                    </div>
                    <div>
                        <p className="font-medium text-brand-black truncate max-w-[150px]">{subscription.description}</p>
                        <p className="text-sm text-brand-gray">{subscription.clientEmail}</p>
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                        subscription.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                    }`}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </span>
            </div>

            <div className="mb-4">
                <p className="text-xl font-bold text-brand-black">${Number(subscription.amount).toFixed(2)} <span className="text-sm font-normal text-brand-gray">/ {subscription.interval > 1 ? `${subscription.interval} ` : ''}{subscription.frequency === 'monthly' ? 'mo' : 'wk'}</span></p>
                <p className="text-xs text-brand-gray mt-1">Next invoice: {new Date(subscription.nextGenerationDate).toLocaleDateString()}</p>
            </div>

            <div className="flex items-center gap-2 border-t border-gray-50 pt-3">
                {subscription.status !== 'cancelled' && (
                    <>
                        <button
                            onClick={toggleStatus}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium bg-gray-50 hover:bg-gray-100 text-brand-black rounded-lg transition-colors disabled:opacity-50"
                        >
                            {subscription.status === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
                        </button>
                        <button
                            onClick={cancel}
                            disabled={isLoading}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel subscription"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
