// /src/components/admin-web/AdminLoginPlaceholderCard.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import { ADMIN_WEB_API_ROOT } from "@/lib/admin-web/env";

export default function AdminLoginPlaceholderCard() {
    const { error, isAuthenticating, loginWithWallet } = useAdminSession();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin Session Required</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                        Connect an approved admin wallet and sign the backend-issued challenge to
                        establish a secure admin session.
                    </p>

                    <div className="rounded border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                        <span className="font-semibold">Admin API root:</span> {ADMIN_WEB_API_ROOT}
                    </div>

                    {error ? (
                        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                            {error}
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => void loginWithWallet()}
                        disabled={isAuthenticating}
                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isAuthenticating ? "Waiting for wallet signature…" : "Connect Admin Wallet"}
                    </button>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        The signature is off-chain only and does not authorize a blockchain transaction.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
