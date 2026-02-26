import Link from 'next/link'
import { Plus, ArrowUpRight, Repeat } from 'lucide-react'

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Link
        href="/dashboard/invoices/new"
        className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Create Invoice
      </Link>
      <Link
        href="/dashboard/subscriptions"
        className="flex items-center justify-center gap-2 px-4 py-3 border border-brand-border rounded-lg font-medium hover:bg-brand-light transition-colors text-brand-black"
      >
        <Repeat className="w-5 h-5" />
        Subscriptions
      </Link>
      <Link
        href="/dashboard/withdrawals"
        className="flex items-center justify-center gap-2 px-4 py-3 border border-brand-border rounded-lg font-medium hover:bg-brand-light transition-colors text-brand-black"
      >
        <ArrowUpRight className="w-5 h-5" />
        Withdraw
      </Link>
    </div>
  )
}
