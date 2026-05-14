// /src/components/admin-web/AdminSessionGate.tsx
"use client";

import React from "react";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import AdminLoginPlaceholderCard from "@/components/admin-web/AdminLoginPlaceholderCard";

export default function AdminSessionGate({
                                             children,
                                         }: {
    children: React.ReactNode;
}) {
    const { isReady, isAuthenticated } = useAdminSession();

    if (!isReady) {
        return (
            <div className="rounded border border-gray-200 dark:border-gray-800 px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
                Checking admin session shell…
            </div>
        );
    }

    if (!isAuthenticated) {
        return <AdminLoginPlaceholderCard />;
    }

    return <>{children}</>;
}
