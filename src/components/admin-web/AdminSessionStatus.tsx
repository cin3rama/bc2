// /src/components/admin-web/AdminSessionStatus.tsx
"use client";

import React from "react";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";

function walletTail(walletAddress: string | null): string {
    if (!walletAddress) return "—";
    if (walletAddress.length <= 10) return walletAddress;
    return `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
}

export default function AdminSessionStatus() {
    const { isReady, isAuthenticated, walletAddress, mode } = useAdminSession();

    if (!isReady) {
        return (
            <div className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Checking session…
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
                Unauthenticated
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Authenticated
            </span>
            <span className="text-[11px] text-gray-600 dark:text-gray-300">
                {walletTail(walletAddress)} • {mode}
            </span>
        </div>
    );
}
