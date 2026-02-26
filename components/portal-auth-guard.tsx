"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

export function PortalAuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { ready, authenticated } = usePrivy();

    useInactivityTimeout();

    useEffect(() => {
        if (ready && !authenticated) {
            router.push("/portal/login");
        }
    }, [ready, authenticated, router]);

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-black" />
            </div>
        );
    }

    if (!authenticated) return null;

    return <>{children}</>;
}
