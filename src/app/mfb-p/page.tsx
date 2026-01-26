// app/mfb-p/page.tsx
"use client"; // MUST be the first non-empty line

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import  { API_BASE } from '@/lib/env';

type AoiApiRow = {
    aoi_id: number;
    account_id: string;
    label: string;
    lifecycle_state: "active" | "inactive" | string;
};

function shortAccountId(full: string): string {
    if (!full?.startsWith("0x") || full.length <= 10) return full;
    const tail = full.slice(-5);
    return `0x…${tail}`;
}

function coerceStatus(raw: string): "active" | "inactive" {
    return raw === "active" ? "active" : "inactive";
}

function displayLabel(row: AoiApiRow): string {
    const s = (row.label ?? "").trim();
    return s.length ? s : `AOI #${row.aoi_id}`;
}

export default function MfbPHubPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker } = useTickerPeriod();

    const [aois, setAois] = useState<AoiApiRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Ensure the header dropdowns are visible on this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    // Fetch AOI watchlist (HTTP only)
    useEffect(() => {
        let cancelled = false;

        async function fetchWatchlist() {
            try {
                setLoading(true);
                setError(null);

                // If you later wire env vars, replace this with your canonical origin logic.
                const url = `${API_BASE}/api/mfb-p/aoi-watchlist/?status=active`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching AOI watchlist`);

                const raw = (await res.json()) as unknown;
                if (cancelled) return;

                if (!Array.isArray(raw)) {
                    throw new Error("AOI watchlist response is not an array");
                }

                // Light validation / normalization
                const rows: AoiApiRow[] = raw
                    .map((r: any) => ({
                        aoi_id: Number(r?.aoi_id),
                        account_id: String(r?.account_id ?? ""),
                        label: String(r?.label ?? ""),
                        lifecycle_state: String(r?.lifecycle_state ?? ""),
                    }))
                    .filter((r) => Number.isFinite(r.aoi_id) && r.account_id.length > 0);

                setAois(rows);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? "Failed to load AOI watchlist");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchWatchlist();
        return () => {
            cancelled = true;
        };
    }, []);

    const hasAois = aois.length > 0;

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            {/* Page header */}
            <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                        MFB_P – Accounts of Interest
                    </h1>
                    <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                        Monitor key participants for <span className="font-semibold">{ticker}</span> and drill into their live
                        behavior and events.
                    </p>
                </div>
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Note:</span> This hub lists AOIs. Click a row to open a dedicated participant
                    lens.
                </div>
            </section>

            {/* AOI Watchlist */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>AOI Watchlist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading AOIs…</p>
                        ) : error ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        ) : !hasAois ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No AOIs configured yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">AOI</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">Default Ticker</th>
                                        <th className="py-2 px-2 text-left font-semibold">Status</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {aois.map((aoi) => {
                                        const status = coerceStatus(aoi.lifecycle_state);
                                        return (
                                            <tr
                                                key={aoi.aoi_id}
                                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                            >
                                                <td className="py-2 pr-4 align-top">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{displayLabel(aoi)}</span>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">AOI #{aoi.aoi_id}</span>
                                                    </div>
                                                </td>

                                                <td className="py-2 px-2 align-top">
                                                    <span className="font-mono text-[11px]">{shortAccountId(aoi.account_id)}</span>
                                                </td>

                                                <td className="py-2 px-2 align-top">
                                                    {/* Until the backend returns a per-AOI default ticker, use the current header ticker */}
                                                    <span>{ticker}</span>
                                                </td>

                                                <td className="py-2 px-2 align-top">
                            <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    status === "active"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                }`}
                            >
                              {status.toUpperCase()}
                            </span>
                                                </td>

                                                <td className="py-2 pl-2 pr-0 align-top text-right">
                                                    <Link
                                                        href={`/mfb-p/lens?aoiId=${aoi.aoi_id}`}
                                                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                    >
                                                        Open Lens
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
