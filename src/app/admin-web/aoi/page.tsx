// /src/app/admin-web/aoi/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
import { adminWebApi, AdminAoiPolicy } from "@/lib/admin-web/api";

function boolLabel(value: boolean): string {
    return value ? "Yes" : "No";
}

function accountShort(accountId: string): string {
    if (accountId.length <= 18) return accountId;
    return `${accountId.slice(0, 10)}…${accountId.slice(-6)}`;
}

export default function AdminWebAoiListPage() {
    const { isAuthenticated, isReady } = useAdminSession();
    const [rows, setRows] = useState<AdminAoiPolicy[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isReady || !isAuthenticated) return;

        let cancelled = false;

        async function loadRows() {
            setLoading(true);
            setError(null);

            try {
                const payload = await adminWebApi.listAoiPolicies(250);
                if (!cancelled) {
                    setRows(payload.results);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "failed_to_load_aoi_policies");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadRows();

        return () => {
            cancelled = true;
        };
    }, [isReady, isAuthenticated]);

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <CardTitle>AOI Actor Policy</CardTitle>
                            <button
                                type="button"
                                onClick={() => void adminWebApi.listAoiPolicies(250).then((payload) => setRows(payload.results)).catch((err) => setError(err instanceof Error ? err.message : "failed_to_reload"))}
                                className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Reload
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {loading ? (
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                                    Loading AOI actor policies…
                                </div>
                            ) : null}

                            {error ? (
                                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    {error}
                                </div>
                            ) : null}

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">AOI ID</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">Type</th>
                                        <th className="py-2 px-2 text-left font-semibold">Lifecycle</th>
                                        <th className="py-2 px-2 text-left font-semibold">Tier</th>
                                        <th className="py-2 px-2 text-left font-semibold">Mode</th>
                                        <th className="py-2 px-2 text-left font-semibold">Replay</th>
                                        <th className="py-2 px-2 text-left font-semibold">Reconcile</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Detail</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-gray-100 dark:border-gray-800"
                                        >
                                            <td className="py-2 pr-4 align-top">#{row.id}</td>
                                            <td className="py-2 px-2 align-top font-mono text-[11px]">
                                                {accountShort(row.account_id)}
                                            </td>
                                            <td className="py-2 px-2 align-top">{row.aoi_type ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.lifecycle_state ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.checkpoint_tier ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.checkpoint_mode ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{boolLabel(row.replay_enabled)}</td>
                                            <td className="py-2 px-2 align-top">{boolLabel(row.reconcile_enabled)}</td>
                                            <td className="py-2 pl-2 pr-0 align-top text-right">
                                                <Link
                                                    href={`/admin-web/aoi/detail?aoiId=${encodeURIComponent(String(row.id))}`}
                                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    Open Detail
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}

                                    {!loading && rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="py-4 text-center text-sm text-gray-600 dark:text-gray-300"
                                            >
                                                No AOI actor policies returned.
                                            </td>
                                        </tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </AdminSessionGate>
        </main>
    );
}
