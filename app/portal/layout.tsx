import { PortalAuthGuard } from '@/components/portal-auth-guard'
import { PortalSidebar } from '@/components/layout/portal-sidebar'

export const dynamic = 'force-dynamic'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <PortalAuthGuard>
            <div className="min-h-screen bg-brand-light flex">
                <PortalSidebar />
                <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8">{children}</main>
            </div>
        </PortalAuthGuard>
    )
}
