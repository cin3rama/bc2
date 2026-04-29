// /app/mfb-p/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { API_BASE } from "@/lib/env";

type AoiApiRow = {
    aoi_id: number;
    account_id: string;
    label: string;
    aoi_type: string | null;
    position_size: string | number | null;
};

type AoiSortMode =
    | "aoi_id_asc"
    | "aoi_type_asc"
    | "position_signed_desc"
    | "position_abs_desc";

function shortAccountId(full: string): string {
    if (!full?.startsWith("0x") || full.length <= 10) return full;
    const tail = full.slice(-5);
    return `0x…${tail}`;
}

function displayLabel(row: AoiApiRow): string {
    const s = (row.label ?? "").trim();
    return s.length ? s : `AOI #${row.aoi_id}`;
}

function parsePositionValue(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;
    const numeric = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : null;
}

function formatPositionValue(value: string | number | null | undefined): string {
    const numeric = parsePositionValue(value);
    if (numeric === null) return "—";

    return numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function getPositionClass(value: string | number | null | undefined): string {
    const numeric = parsePositionValue(value);

    if (numeric === null || numeric === 0) {
        return "text-gray-800 dark:text-gray-200";
    }

    if (numeric > 0) {
        return "text-green-600 dark:text-green-400";
    }

    return "text-red-600 dark:text-red-400";
}

function compareNullableNumbersDesc(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
}

export default function MfbPHubPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker } = useTickerPeriod();

    const [aois, setAois] = useState<AoiApiRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<AoiSortMode>("aoi_id_asc");

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    useEffect(() => {
        let cancelled = false;

        async function fetchWatchlist() {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams({
                    lifecycle_state: "active",
                    ticker: String(ticker ?? ""),
                });

                const url = `${API_BASE}/api/mfb-p/aoi-watchlist/?${params.toString()}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching AOI watchlist`);

                const raw = (await res.json()) as unknown;
                if (cancelled) return;

                if (!Array.isArray(raw)) {
                    throw new Error("AOI watchlist response is not an array");
                }

                const rows: AoiApiRow[] = raw
                    .map((r: any) => ({
                        aoi_id: Number(r?.aoi_id),
                        account_id: String(r?.account_id ?? ""),
                        label: String(r?.label ?? ""),
                        aoi_type:
                            typeof r?.aoi_type === "string" && r.aoi_type.trim().length > 0
                                ? r.aoi_type.trim()
                                : null,
                        position_size:
                            r?.position_size === null || r?.position_size === undefined
                                ? null
                                : r.position_size,
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
    }, [ticker]);

    const sortedAois = useMemo(() => {
        const rows = [...aois];

        rows.sort((a, b) => {
            if (sortMode === "aoi_id_asc") {
                return a.aoi_id - b.aoi_id;
            }

            if (sortMode === "aoi_type_asc") {
                const aType = a.aoi_type ?? "";
                const bType = b.aoi_type ?? "";
                const cmp = aType.localeCompare(bType);
                return cmp !== 0 ? cmp : a.aoi_id - b.aoi_id;
            }

            if (sortMode === "position_signed_desc") {
                const aPos = parsePositionValue(a.position_size);
                const bPos = parsePositionValue(b.position_size);
                const cmp = compareNullableNumbersDesc(aPos, bPos);
                return cmp !== 0 ? cmp : a.aoi_id - b.aoi_id;
            }

            const aAbs = (() => {
                const n = parsePositionValue(a.position_size);
                return n === null ? null : Math.abs(n);
            })();

            const bAbs = (() => {
                const n = parsePositionValue(b.position_size);
                return n === null ? null : Math.abs(n);
            })();

            const cmp = compareNullableNumbersDesc(aAbs, bAbs);
            if (cmp !== 0) return cmp;

            const aSigned = parsePositionValue(a.position_size);
            const bSigned = parsePositionValue(b.position_size);
            const signedCmp = compareNullableNumbersDesc(aSigned, bSigned);
            return signedCmp !== 0 ? signedCmp : a.aoi_id - b.aoi_id;
        });

        return rows;
    }, [aois, sortMode]);

    const hasAois = sortedAois.length > 0;

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
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

            <section>
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <CardTitle>AOI Watchlist</CardTitle>

                            <div className="flex items-center gap-2 text-xs md:text-sm">
                                <label
                                    htmlFor="aoi-sort-mode"
                                    className="font-medium text-gray-600 dark:text-gray-300"
                                >
                                    Sort
                                </label>
                                <select
                                    id="aoi-sort-mode"
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value as AoiSortMode)}
                                    className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-text dark:text-text-inverted"
                                >
                                    <option value="aoi_id_asc">AOI ID</option>
                                    <option value="aoi_type_asc">AOI Type</option>
                                    <option value="position_signed_desc">Position signed desc</option>
                                    <option value="position_abs_desc">Position absolute desc</option>
                                </select>
                            </div>
                        </div>
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
                                        <th className="py-2 px-2 text-left font-semibold">AOI Type</th>
                                        <th className="py-2 px-2 text-right font-semibold">Position</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {sortedAois.map((aoi) => (
                                        <tr
                                            key={aoi.aoi_id}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            <td className="py-2 pr-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{displayLabel(aoi)}</span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            AOI #{aoi.aoi_id}
                                                        </span>
                                                </div>
                                            </td>

                                            <td className="py-2 px-2 align-top">
                                                <span className="font-mono text-[11px]">{shortAccountId(aoi.account_id)}</span>
                                            </td>

                                            <td className="py-2 px-2 align-top">
                                                <span>{aoi.aoi_type ?? "—"}</span>
                                            </td>

                                            <td className="py-2 px-2 align-top text-right">
                                                    <span className={`font-medium tabular-nums ${getPositionClass(aoi.position_size)}`}>
                                                        {formatPositionValue(aoi.position_size)}
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
                                    ))}
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
