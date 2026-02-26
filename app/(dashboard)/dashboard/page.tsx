"use client";

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect, useCallback } from 'react'
import { BalanceCard } from '@/components/dashboard/balance-card'
import { ReportsSection } from '@/components/dashboard/reports-section'
import { AssetList } from '@/components/dashboard/asset-list'
import { TrustlineManager } from '@/components/dashboard/trustline-manager'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { TransactionList } from '@/components/dashboard/transaction-list'
import { TaxVaultCard } from '@/components/dashboard/tax-vault-card'
import { AssetMetadata } from '@/lib/assets'

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
    clientName?: string | null;
    description: string;
  } | null;
  bankAccount?: { bankName: string; accountNumber: string } | null;
}

interface Asset {
  code: string;
  issuer?: string;
  balance: string;
  value: number;
  metadata: AssetMetadata;
}

interface Portfolio {
  available?: { display: string }
  localEquivalent?: { display: string; rate: number }
  xlm?: number
  usdc?: string | number
  usd?: string | number
  totalValue?: number
  currency?: string
  assets?: Asset[]
}

export default function DashboardPage() {
  const { getAccessToken } = usePrivy()
  const [balance, setBalance] = useState<Portfolio | null>(null)
  const [profile, setProfile] = useState<{ name?: string } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [taxPercentage, setTaxPercentage] = useState(0)
  const [taxVaultBalance, setTaxVaultBalance] = useState(0)

  // Claimable Balances


  const [claimableBalances, setClaimableBalances] = useState<{ id: string; balance_id?: string;[key: string]: unknown }[]>([])
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimError, setClaimError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const headers = { Authorization: `Bearer ${token}` }

      // Sync wallet first (ensures wallet is stored in DB)
      await fetch('/api/user/sync-wallet', { method: 'POST', headers })

      // Then fetch balance, profile, transactions, tax vault, and claimable balances
      const [balanceRes, profileRes, transactionsRes, taxRes, claimableRes] = await Promise.all([
        fetch('/api/user/balance', { headers }),
        fetch('/api/user/profile', { headers }),
        fetch('/api/transactions', { headers }),
        fetch('/api/routes-d/tax-vault', { headers }),
        fetch('/api/routes-d/claimable-balances', { headers }),
      ])
      if (balanceRes.ok) setBalance(await balanceRes.json())
      if (profileRes.ok) setProfile(await profileRes.json())
      if (transactionsRes.ok) {
        const data = await transactionsRes.json()
        setTransactions(data.transactions || [])
      }
      if (taxRes.ok) {
        const taxData = await taxRes.json()
        setTaxPercentage(taxData.taxPercentage ?? 0)
        setTaxVaultBalance(taxData.taxVault?.currentAmountUsdc ?? 0)
      }
      if (claimableRes.ok) {
        const claimableData = await claimableRes.json()
        setClaimableBalances(claimableData.balances || [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleClaim = async () => {
    if (claimableBalances.length === 0) return;
    setIsClaiming(true);
    setClaimError('');
    try {
      const token = await getAccessToken();
      const balanceId = claimableBalances[0].id || claimableBalances[0].balance_id;

      const res = await fetch('/api/routes-d/claimable-balances/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ balanceId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to claim balance');
      }

      // Success: Remove claimed balance and refresh
      setClaimableBalances(prev => prev.slice(1));
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setClaimError(err.message);
      } else {
        setClaimError('An unexpected error occurred');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const greeting = profile?.name
    ? `Hey, ${profile.name}! 👋`
    : "Welcome back! 👋";

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div>
        <p className="text-sm text-brand-gray mb-1">Dashboard</p>
        <h1 className="text-3xl font-bold text-brand-black">{greeting}</h1>
      </div>

      {claimableBalances.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-blue-900 font-semibold mb-1">
              You have {claimableBalances.length} claimable balance(s)
            </h3>
            <p className="text-blue-700 text-sm">
              ✨ Hint: Recipient must add USDC trustline before claiming.
            </p>
            {claimError && <p className="text-red-600 text-sm mt-2">{claimError}</p>}
          </div>
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 min-w-[120px]"
          >
            {isClaiming ? 'Claiming...' : 'Auto-Claim'}
          </button>
        </div>
      )}

      <BalanceCard
        balance={balance}
        isLoading={isLoading}
      />

      <TaxVaultCard
        taxPercentage={taxPercentage}
        taxVaultBalance={taxVaultBalance}
        totalBalance={balance?.totalValue ?? 0}
        isLoading={isLoading}
      />

      <QuickActions />
      <ReportsSection />

      <AssetList
        assets={balance?.assets || []}
        currency={balance?.currency || 'USD'}
      />

      <TrustlineManager onUpdate={fetchData} />

      <div className="bg-white rounded-2xl border border-brand-border p-6 mt-6">
        <h3 className="text-lg font-semibold text-brand-black mb-4">Recent Activity</h3>
        <TransactionList transactions={transactions} isLoading={isLoading} />
      </div>
    </div>
  );
}
