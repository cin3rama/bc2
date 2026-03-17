// app/mfb-p-success-leader/page.tsx
"use client"; // MUST be the first non-empty line

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { API_BASE } from "@/lib/env";

import type {
    DecimalLike,
    SuccessLeaderAccountSnapshotV1,
    SuccessLeaderLeaderboardSnapshotV1,
    SuccessLeaderWindowDays,
} from "@/types/mfb_p_success_leader";
import {
    isSuccessLeaderLeaderboardSnapshotV1,
    SUCCESS_LEADER_SNAPSHOT_KIND,
} from "@/types/mfb_p_success_leader";

const WINDOWS: SuccessLeaderWindowDays[] = [7, 30, 60];

function formatUtcMs(ms: number | null | undefined): string {
    if (ms == null) return "—";
    try {
        return new Date(ms).toISOString(); // ✅ UTC only
    } catch {
        return String(ms);
    }
}

function accountTail5(full: string): string {
    if (!full) return "—";
    return full.slice(-5);
}

function parseDecimalLike(x: DecimalLike | null | undefined): number | null {
    if (x == null) return null;
    const n = typeof x === "string" ? Number(x) : x;
    return Number.isFinite(n) ? n : null;
}

function formatNumber(x: DecimalLike | null | undefined, decimals = 2): string {
    const n = parseDecimalLike(x);
    if (n == null) return "—";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatPctGrowth(pctGrowth: DecimalLike | null | undefined): string {
    const n = parseDecimalLike(pctGrowth);
    if (n == null) return "—";
    // DO NOT invent — display raw as percent-like if > 1 else *100.
    const displayPct = Math.abs(n) > 1 ? n : n * 100;
    return (
        displayPct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        "%"
    );
}

function growthClass(pctGrowth: DecimalLike | null | undefined): string {
    const n = parseDecimalLike(pctGrowth);
    if (n == null) return "text-gray-800 dark:text-gray-200";
    if (n > 0) return "text-green-600 dark:text-green-400";
    if (n < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-800 dark:text-gray-200";
}

/** Derived UI field: Confidence badge from days_observed */
function confidenceBadge(daysObserved: number, windowDays: SuccessLeaderWindowDays) {
    if (daysObserved >= windowDays)
        return {
            label: "Full Window",
            cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
    if (daysObserved >= windowDays * 0.5)
        return {
            label: "Partial Window",
            cls: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
        };
    return {
        label: "Low Observation",
        cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
}

/** Derived UI field: Funding badge from cashflow_cumulative */
function fundingBadge(cashflow: DecimalLike) {
    const n = parseDecimalLike(cashflow) ?? 0;
    const eps = 1e-9;
    if (Math.abs(n) <= eps)
        return {
            label: "Organic",
            cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        };
    if (n > 0)
        return {
            label: "Cashflow Assisted",
            cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
        };
    return {
        label: "Withdrawal Distorted",
        cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
    };
}

/**
 * Seed can arrive in one of these shapes:
 * - Envelope: { type:"update_data", payload:<leaderboard_snapshot> }
 * - Raw payload: <leaderboard_snapshot>
 * - Minimal legacy: { asof_day_ms, window_days, leaders }
 */
function extractLeaderboardSeed(raw: any): {
    leaderboard: SuccessLeaderLeaderboardSnapshotV1 | null;
    minimal: { asof_day_ms: number | null; window_days: SuccessLeaderWindowDays; leaders: any[] } | null;
} {
    // Envelope
    if (raw && typeof raw === "object" && raw.type === "update_data" && raw.payload) {
        if (isSuccessLeaderLeaderboardSnapshotV1(raw.payload)) {
            return { leaderboard: raw.payload, minimal: null };
        }
    }

    // Raw payload
    if (isSuccessLeaderLeaderboardSnapshotV1(raw)) {
        return { leaderboard: raw, minimal: null };
    }

    // Minimal legacy-ish
    const wd = raw?.window_days;
    const asof = raw?.asof_day_ms;
    const leaders = raw?.leaders;
    if ((wd === 7 || wd === 30 || wd === 60) && (asof == null || typeof asof === "number") && Array.isArray(leaders)) {
        return {
            leaderboard: null,
            minimal: {
                asof_day_ms: typeof asof === "number" ? asof : null,
                window_days: wd,
                leaders,
            },
        };
    }

    return { leaderboard: null, minimal: null };
}

export default function MfbPSuccessLeaderHubPage() {
    const { setConfig } = useHeaderConfig();

    const [windowDays, setWindowDays] = useState<SuccessLeaderWindowDays>(30);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [leaderboard, setLeaderboard] = useState<SuccessLeaderLeaderboardSnapshotV1 | null>(null);
    const [minimalSeed, setMinimalSeed] = useState<{
        asof_day_ms: number | null;
        window_days: SuccessLeaderWindowDays;
        leaders: any[];
    } | null>(null);

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
    }, [setConfig]);

    const fetchSeed = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setLeaderboard(null);
            setMinimalSeed(null);

            const url = `${API_BASE}/api/mfb-p-success-leader/seed?window_days=${encodeURIComponent(
                String(windowDays)
            )}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching Success Leader seed`);

            const raw = await res.json();
            const extracted = extractLeaderboardSeed(raw);

            if (extracted.leaderboard) {
                setLeaderboard(extracted.leaderboard);
                return;
            }
            if (extracted.minimal) {
                setMinimalSeed(extracted.minimal);
                return;
            }

            throw new Error("Seed response did not match expected Success Leader contracts");
        } catch (e: any) {
            setError(e?.message ?? "Failed to load seed");
        } finally {
            setLoading(false);
        }
    }, [windowDays]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (cancelled) return;
            await fetchSeed();
        })();
        return () => {
            cancelled = true;
        };
    }, [fetchSeed]);

    const effectiveWindowDays: SuccessLeaderWindowDays = useMemo(() => {
        return (leaderboard?.window_days ?? minimalSeed?.window_days ?? windowDays) as SuccessLeaderWindowDays;
    }, [leaderboard?.window_days, minimalSeed?.window_days, windowDays]);

    const effectiveAsofDayMs: number | null = useMemo(() => {
        if (leaderboard) return typeof leaderboard.asof_day_ms === "number" ? leaderboard.asof_day_ms : null;
        return minimalSeed?.asof_day_ms ?? null;
    }, [leaderboard, minimalSeed]);

    const runId: string | null = useMemo(() => {
        if (leaderboard?.meta?.run_id) return leaderboard.meta.run_id;
        return null;
    }, [leaderboard?.meta?.run_id]);

    // ✅ ACCEPT v1 OR v2 leader rows (do not change types file; keep it local)
    type LeaderRow = SuccessLeaderAccountSnapshotV1 & { version?: number };

    const leaders: LeaderRow[] = useMemo(() => {
        const arr = leaderboard?.leaders ?? minimalSeed?.leaders ?? [];
        return arr.filter(
            (x: any) =>
                x &&
                x.kind === SUCCESS_LEADER_SNAPSHOT_KIND &&
                (x.version === 1 || x.version === 2) // ✅ THIS IS THE FIX
        ) as LeaderRow[];
    }, [leaderboard?.leaders, minimalSeed?.leaders]);

    const hasEligibleDay = effectiveAsofDayMs != null;
    const hasLeaders = leaders.length > 0;

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            <section className="flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                            MFB_P — Success Leaderboard
                        </h1>
                        <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                            Top accounts by <span className="font-semibold">pct_growth</span> over the selected window. Times are UTC.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Window</span>
                        <select
                            value={windowDays}
                            onChange={(e) => setWindowDays(Number(e.target.value) as SuccessLeaderWindowDays)}
                            className="text-[10px] p-1 w-24 sm:text-xs sm:p-2 sm:w-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
                        >
                            {WINDOWS.map((d) => (
                                <option key={d} value={d}>
                                    {d} Days
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={fetchSeed}
                            className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">As-of (UTC):</span> {formatUtcMs(effectiveAsofDayMs)}{" "}
                    {runId ? (
                        <>
                            • <span className="font-semibold">run_id:</span>{" "}
                            <span className="font-mono">{runId}</span>
                        </>
                    ) : null}
                </div>
            </section>

            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Leaders</CardTitle>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                        ) : error ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        ) : !hasEligibleDay ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No leaders available yet.</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    The backend will emit leaders once an eligible as-of day exists.
                                </p>
                            </div>
                        ) : !hasLeaders ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No leaders returned for this window.</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    asof_day_ms={String(effectiveAsofDayMs)} • window_days={String(effectiveWindowDays)}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">Rank</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">Growth</th>
                                        <th className="py-2 px-2 text-left font-semibold">Ending Value</th>
                                        <th className="py-2 px-2 text-left font-semibold">Days</th>
                                        <th className="py-2 px-2 text-left font-semibold">Badges</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Lens</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {leaders.map((row, idx) => {
                                        const rank = idx + 1;
                                        const conf = confidenceBadge(row.days_observed, row.window_days);
                                        const fund = fundingBadge(row.cashflow_cumulative);

                                        const lensHref =
                                            effectiveAsofDayMs != null
                                                ? `/mfb-p-success-leader/lens?account_id=${encodeURIComponent(
                                                    row.account_id
                                                )}&window_days=${encodeURIComponent(String(row.window_days))}&asof_day_ms=${encodeURIComponent(
                                                    String(effectiveAsofDayMs)
                                                )}`
                                                : "#";

                                        return (
                                            <tr
                                                key={`${row.account_id}-${idx}`}
                                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                            >
                                                <td className="py-2 pr-4 align-top">
                                                    <span className="font-medium">#{rank}</span>
                                                </td>

                                                <td className="py-2 px-2 align-top">
                                                    <span className="font-mono text-[11px]">…{accountTail5(row.account_id)}</span>
                                                </td>

                                                <td className={`py-2 px-2 align-top font-semibold ${growthClass(row.pct_growth)}`}>
                                                    {formatPctGrowth(row.pct_growth)}
                                                </td>

                                                <td className="py-2 px-2 align-top">{formatNumber(row.value_end)}</td>

                                                <td className="py-2 px-2 align-top">{String(row.days_observed)}</td>

                                                <td className="py-2 px-2 align-top">
                                                    <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.cls}`}>
                                {conf.label}
                              </span>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${fund.cls}`}>
                                {fund.label}
                              </span>
                                                    </div>
                                                </td>

                                                <td className="py-2 pl-2 pr-0 align-top text-right">
                                                    <Link
                                                        href={lensHref}
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

                                <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">Window:</span> {effectiveWindowDays}d •{" "}
                                    <span className="font-semibold">As-of (UTC):</span> {formatUtcMs(effectiveAsofDayMs)} •{" "}
                                    <span className="font-semibold">Leaders:</span> {leaders.length}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
