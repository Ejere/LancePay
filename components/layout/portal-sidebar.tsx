'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { LayoutDashboard, FileText, Settings, LogOut, ChevronLeft, ChevronRight, Menu, X, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
    { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/portal/invoices', label: 'My Invoices', icon: FileText },
    { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalSidebar() {
    const pathname = usePathname()
    const { user, logout } = usePrivy()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    const sidebarContent = (
        <>
            <div className="p-4 border-b border-brand-border overflow-hidden">
                <Link href="/portal" className="flex items-center gap-2 whitespace-nowrap" onClick={() => setMobileOpen(false)}>
                    <div className="w-8 h-8 bg-brand-black rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">LP</span>
                    </div>
                    <span className={cn('font-bold text-xl text-brand-black transition-opacity duration-500', collapsed ? 'opacity-0 lg:opacity-0' : 'opacity-100')}>Client Portal</span>
                </Link>
            </div>

            <nav className="flex-1 p-2 overflow-hidden">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/portal' && pathname.startsWith(item.href))
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    title={collapsed ? item.label : undefined}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                                        isActive ? 'bg-brand-black text-white' : 'text-brand-gray hover:bg-brand-light hover:text-brand-black'
                                    )}
                                >
                                    <item.icon className="w-5 h-5 shrink-0" />
                                    <span className={cn('transition-opacity duration-500', collapsed ? 'opacity-0 lg:opacity-0' : 'opacity-100')}>{item.label}</span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            <div className="p-2 border-t border-brand-border overflow-hidden">
                <div className={cn('flex items-center gap-3 mb-3 px-3 transition-opacity duration-500', collapsed ? 'opacity-0 hidden' : 'opacity-100')}>
                    <div className="w-8 h-8 bg-brand-light rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-brand-gray">{user?.email?.address?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <p className="text-xs text-brand-gray truncate flex-1">{user?.email?.address}</p>
                </div>
                <button
                    onClick={logout}
                    title={collapsed ? 'Sign Out' : undefined}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-gray hover:bg-red-50 hover:text-red-600 transition-colors w-full whitespace-nowrap')}
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className={cn('transition-opacity duration-500', collapsed ? 'opacity-0' : 'opacity-100')}>Sign Out</span>
                </button>
            </div>
        </>
    )

    return (
        <>
            <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md border border-brand-border"
            >
                <Menu className="w-5 h-5" />
            </button>

            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
            )}

            <aside className={cn(
                'lg:hidden fixed top-0 left-0 h-screen w-64 bg-white border-r border-brand-border flex flex-col z-50 transition-transform duration-300',
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 text-brand-gray hover:text-brand-black">
                    <X className="w-5 h-5" />
                </button>
                {sidebarContent}
            </aside>

            <aside className={cn(
                'hidden lg:flex bg-white border-r border-brand-border flex-col h-screen sticky top-0 transition-all duration-500 ease-in-out relative',
                collapsed ? 'w-16' : 'w-64'
            )}>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-3 top-6 w-6 h-6 bg-brand-black text-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-800 z-10"
                >
                    {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>
                {sidebarContent}
            </aside>
        </>
    )
}
