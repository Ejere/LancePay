'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, Filter, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function PortalInvoicesPage() {
    const { getAccessToken } = usePrivy()
    const [invoices, setInvoices] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')

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

    const filteredInvoices = invoices.filter((i: any) =>
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (i.user.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (i.user.email || '').toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-brand-black">My Invoices</h1>
                    <p className="text-brand-gray">View and pay your invoices from freelancers</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-brand-border overflow-hidden">
                <div className="p-4 border-b border-brand-border flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
                        <input
                            type="text"
                            placeholder="Search by invoice # or freelancer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-brand-border focus:border-brand-black outline-none text-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 border border-brand-border rounded-lg text-sm font-medium hover:bg-brand-light transition-colors">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-brand-light text-brand-gray text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Invoice #</th>
                                <th className="px-6 py-4">Freelancer</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border uppercase">
                            {isLoading ? (
                                [1, 2, 3, 4].map((i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-12 bg-gray-50" />
                                    </tr>
                                ))
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-brand-gray normal-case">
                                        No invoices found.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice: any) => (
                                    <tr key={invoice.id} className="hover:bg-brand-light transition-colors">
                                        <td className="px-6 py-4 font-medium text-brand-black">{invoice.invoiceNumber}</td>
                                        <td className="px-6 py-4 text-brand-gray normal-case text-sm">
                                            {invoice.user.name || invoice.user.email}
                                        </td>
                                        <td className="px-6 py-4 text-brand-gray text-sm">
                                            {new Date(invoice.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-brand-black">
                                            ${Number(invoice.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`/pay/${invoice.invoiceNumber}`}
                                                className="text-brand-black hover:underline flex items-center gap-1 text-sm font-medium"
                                            >
                                                {invoice.status === 'paid' ? 'View' : 'Pay'}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
