"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PortalLoginPage() {
    const router = useRouter();
    const { login, authenticated, ready, getAccessToken } = usePrivy();
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        async function syncClient() {
            if (ready && authenticated && !isSyncing) {
                setIsSyncing(true);
                try {
                    const token = await getAccessToken();
                    // Call sync-wallet with a role hint for client
                    await fetch('/api/user/sync-wallet', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'x-role-hint': 'client'
                        }
                    });
                    router.push("/portal");
                } catch (err) {
                    console.error('Failed to sync client:', err);
                } finally {
                    setIsSyncing(false);
                }
            }
        }
        syncClient();
    }, [ready, authenticated, router, getAccessToken, isSyncing]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-light">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-brand-black rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <span className="text-white font-bold text-2xl">LP</span>
                    </div>

                    <h1 className="text-2xl font-bold text-brand-black mb-2">
                        Client Portal
                    </h1>
                    <p className="text-brand-gray mb-8">
                        Sign in to view your invoices and manage payments
                    </p>

                    <button
                        onClick={login}
                        disabled={!ready || isSyncing}
                        className="w-full py-3 px-4 bg-brand-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                        {isSyncing ? "Creating account..." : ready ? "Sign in with Email" : "Loading..."}
                    </button>

                    <p className="text-xs text-brand-gray mt-6">
                        Access your secure dashboard to manage your bills and payment methods
                    </p>
                </div>
            </div>
        </div>
    );
}
