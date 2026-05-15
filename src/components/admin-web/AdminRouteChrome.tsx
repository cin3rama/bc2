// /src/components/admin-web/AdminRouteChrome.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import AdminSessionStatus from "@/components/admin-web/AdminSessionStatus";
import { ADMIN_WEB_APP_SUBTITLE, ADMIN_WEB_APP_TITLE } from "@/lib/admin-web/env";

function navClass(isActive: boolean): string {
    return isActive
        ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
}

export default function AdminRouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { setConfig } = useHeaderConfig();
    const { isAuthenticated, logout } = useAdminSession();

    useEffect(() => {
        setConfig({ showTicker: false, showPeriod: false });
    }, [setConfig]);

    const isHome = pathname === "/admin-web";
    const isAoi = pathname?.startsWith("/admin-web/aoi");

    return (
        <div className="space-y-4">
            <section className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                            {ADMIN_WEB_APP_TITLE}
                        </h1>
                        <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                            {ADMIN_WEB_APP_SUBTITLE}
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                        <AdminSessionStatus />
                        {isAuthenticated ? (
                            <button
                                type="button"
                                onClick={() => void logout()}
                                className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Logout Admin Session
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href="/admin-web"
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] md:text-xs font-medium transition-colors ${navClass(isHome)}`}
                    >
                        Admin Home
                    </Link>
                    <Link
                        href="/admin-web/aoi"
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] md:text-xs font-medium transition-colors ${navClass(Boolean(isAoi))}`}
                    >
                        AOI Policy
                    </Link>
                </div>
            </section>

            <section className="space-y-4">{children}</section>
        </div>
    );
}
