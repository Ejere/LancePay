'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect, useCallback } from 'react'
import { User, CreditCard, Wallet, Trash2, Plus, ShieldCheck } from 'lucide-react'

export default function PortalSettingsPage() {
    const { user, getAccessToken } = usePrivy()
    const [paymentMethods, setPaymentMethods] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [newWallet, setNewWallet] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    const fetchPaymentMethods = useCallback(async () => {
        try {
            const token = await getAccessToken()
            const res = await fetch('/api/portal/payment-methods', {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setPaymentMethods(data.paymentMethods)
            }
        } finally {
            setIsLoading(false)
        }
    }, [getAccessToken])

    useEffect(() => {
        fetchPaymentMethods()
    }, [fetchPaymentMethods])

    const handleAddWallet = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newWallet) return
        setIsAdding(true)
        try {
            const token = await getAccessToken()
            const res = await fetch('/api/portal/payment-methods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ type: 'stellar_wallet', value: newWallet, name: 'Saved Wallet' })
            })
            if (res.ok) {
                setNewWallet('')
                fetchPaymentMethods()
            }
        } finally {
            setIsAdding(false)
        }
    }

    const handleDeleteMethod = async (id: string) => {
        try {
            const token = await getAccessToken()
            const res = await fetch(`/api/portal/payment-methods/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) fetchPaymentMethods()
        } catch (err) {
            console.error('Failed to delete payment method:', err)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-brand-black">Settings</h1>
                <p className="text-brand-gray">Manage your portal profile and saved payment methods</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="col-span-1 space-y-1">
                    <h3 className="font-semibold text-brand-black">Profile Information</h3>
                    <p className="text-sm text-brand-gray font-normal">Your basic account details from magic link login.</p>
                </div>
                <div className="col-span-2 bg-white rounded-2xl border border-brand-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-brand-gray" />
                        </div>
                        <div>
                            <p className="font-bold text-brand-black">{user?.email?.address}</p>
                            <p className="text-xs text-brand-gray uppercase tracking-wider font-semibold">Client Account</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="col-span-1 space-y-1">
                    <h3 className="font-semibold text-brand-black">Saved Payment Methods</h3>
                    <p className="text-sm text-brand-gray font-normal">Speed up your payments by saving your Stellar wallets.</p>
                </div>
                <div className="col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-brand-border divide-y divide-brand-border">
                        {isLoading ? (
                            <div className="p-6 text-center animate-pulse">Loading methods...</div>
                        ) : paymentMethods.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CreditCard className="w-6 h-6 text-brand-gray" />
                                </div>
                                <p className="text-brand-gray text-sm">No saved payment methods yet.</p>
                            </div>
                        ) : (
                            paymentMethods.map((method: any) => (
                                <div key={method.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center text-brand-black">
                                            <Wallet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-brand-black">{method.name}</p>
                                            <p className="text-xs text-brand-gray font-mono">{method.value.slice(0, 6)}...{method.value.slice(-6)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteMethod(method.id)}
                                        className="p-2 text-brand-gray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleAddWallet} className="bg-white rounded-2xl border border-brand-border p-6">
                        <h4 className="font-semibold text-brand-black mb-4">Add Stellar Wallet</h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="G..."
                                value={newWallet}
                                onChange={(e) => setNewWallet(e.target.value)}
                                className="flex-1 px-4 py-2 rounded-lg border border-brand-border focus:border-brand-black outline-none text-sm"
                            />
                            <button
                                type="submit"
                                disabled={isAdding}
                                className="px-4 py-2 bg-brand-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-brand-black text-white rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-green-400" />
                        <h3 className="text-xl font-bold">Secure Portal</h3>
                    </div>
                    <p className="text-brand-gray max-w-md">Your payment history and saved data are protected. We use industry-standard encryption to keep your information safe.</p>
                </div>
                <button className="px-6 py-3 bg-white text-brand-black rounded-lg font-bold hover:bg-brand-light transition-colors whitespace-nowrap">
                    Learn about security
                </button>
            </div>
        </div>
    )
}
