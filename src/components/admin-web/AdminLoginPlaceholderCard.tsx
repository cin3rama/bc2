// /src/components/admin-web/AdminLoginPlaceholderCard.tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import { ADMIN_WEB_API_ROOT } from "@/lib/admin-web/env";

export default function AdminLoginPlaceholderCard() {
    const { loginWithPlaceholder } = useAdminSession();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admin Session Required</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 text-sm">
                    <p className="text-gray-700 dark:text-gray-300">
                        Task 9A uses a placeholder session shell only. Real wallet challenge, verify,
                        me, and logout wiring will land in Task 9B against the existing `mf_admin`
                        backend endpoints.
                    </p>

                    <div className="rounded border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                        <span className="font-semibold">Admin API root scaffold:</span> {ADMIN_WEB_API_ROOT}
                    </div>

                    <button
                        type="button"
                        onClick={() => loginWithPlaceholder()}
                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Use Placeholder Admin Session
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
