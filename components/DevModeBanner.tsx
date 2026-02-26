"use client";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

/**
 * Development Mode Banner
 * Shows when Privy is not configured, directing users to mock login
 */
export function DevModeBanner({ nonce }: { nonce?: string }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
    const configured =
      appId && appId !== "YOUR_PRIVY_APP_ID_HERE" && appId.startsWith("clp");
    setShowBanner(!configured);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-black p-2 flex items-center justify-center gap-2 z-50">
      <AlertCircle className="w-4 h-4" />
      <span className="text-sm font-medium">
        Dev Mode: Privy not configured.{" "}
        <Link href="/mock-login" className="underline font-bold">
          Mock Login
        </Link>{" "}
        or configure at{" "}
        <a
          href="https://dashboard.privy.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-bold"
        >
          dashboard.privy.io
        </a>
      </span>
    </div>
  );
}
