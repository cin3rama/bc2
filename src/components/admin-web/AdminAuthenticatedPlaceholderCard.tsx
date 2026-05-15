// /src/components/admin-web/AdminAuthenticatedPlaceholderCard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import { ADMIN_WEB_API_ROOT } from "@/lib/admin-web/env";

export default function AdminAuthenticatedPlaceholderCard() {
    const { walletAddress, mode } = useAdminSession();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin Session Shell Ready</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                            Session
                        </div>
                        <div className="font-mono text-[11px] break-all">{walletAddress ?? "—"}</div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            Mode: {mode}
                        </div>
                    </div>

                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                            Next Task 9B Targets
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300">
                            auth/session flow, AOI actor list/read/patch, and actor-market list/read/patch
                        </div>
                    </div>

                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                            API Scaffold
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 break-all">
                            {ADMIN_WEB_API_ROOT}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href="/admin-web/aoi"
                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Open AOI Actor Shell
                    </Link>
                    <Link
                        href="/admin-web/aoi/detail?aoiId=1"
                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Open AOI Detail Shell
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
