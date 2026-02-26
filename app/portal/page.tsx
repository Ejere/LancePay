'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function PortalDashboard() {
    const { getAccessToken } = usePrivy()
    const [invoices, setInvoices] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const token = await getAccessToken()
            const res = await fetch('/api/portal/invoices', {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setInvoices(data.invoices)
            }
        } finally {
            setIsLoading(false)
        }
    }, [getAccessToken])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const stats = {
        total: invoices.length,
        pending: invoices.filter((i: any) => i.status === 'pending').length,
        paid: invoices.filter((i: any) => i.status === 'paid').length,
        unpaidAmount: invoices
            .filter((i: any) => i.status === 'pending')
            .reduce((acc: number, i: any) => acc + Number(i.amount), 0),
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <p className="text-sm text-brand-gray mb-1">Client Portal</p>
                <h1 className="text-3xl font-bold text-brand-black">Your Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-brand-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-brand-light rounded-lg flex items-center justify-center text-brand-black">
                            <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-brand-gray font-medium">Total Invoices</span>
                    </div>
                    <p className="text-3xl font-bold text-brand-black">{stats.total}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-brand-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-brand-gray font-medium">Pending Payments</span>
                    </div>
                    <p className="text-3xl font-bold text-brand-black">{stats.pending}</p>
                    <p className="text-sm text-brand-gray mt-1">Total: ${stats.unpaidAmount.toFixed(2)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-brand-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <span className="text-brand-gray font-medium">Paid Invoices</span>
                    </div>
                    <p className="text-3xl font-bold text-brand-black">{stats.paid}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-brand-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-brand-black">Recent Invoices</h3>
                    <Link href="/portal/invoices" className="text-sm font-medium text-brand-black hover:underline">
                        View all
                    </Link>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-16 bg-brand-light animate-pulse rounded-lg" />
                        ))}
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-brand-gray">No invoices found for your account.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-brand-border">
                        {invoices.slice(0, 5).map((invoice: any) => (
                            <div key={invoice.id} className="py-4 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-brand-black">{invoice.invoiceNumber}</p>
                                    <p className="text-sm text-brand-gray">From: {invoice.user.name || invoice.user.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-brand-black">${Number(invoice.amount).toFixed(2)}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {invoice.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
