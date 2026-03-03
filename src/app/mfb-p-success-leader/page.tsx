// app/mfb-p-success-leader/page.tsx
"use client"; // MUST be the first non-empty line

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { EMPTY, Observable, Subject, timer } from "rxjs";
import { retry, takeUntil, shareReplay } from "rxjs/operators";

import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { API_BASE, WS_BASE } from "@/lib/env";

import type {
    DecimalLike,
    SuccessLeaderLeaderboardSnapshotV1,
    SuccessLeaderWindowDays,
    WsUpdateDataEnvelope,
} from "@/types/mfb_p_success_leader";
import {
    isSuccessLeaderLeaderboardSnapshotV1,
    SUCCESS_LEADER_LEADERBOARD_KIND,
} from "@/types/mfb_p_success_leader";

type SeedResponse = {
    asof_day_ms: number | null;
    window_days: SuccessLeaderWindowDays;
};

const WINDOWS: SuccessLeaderWindowDays[] = [7, 30, 60];

function toWsOrigin(base: string): string {
    const b = (base ?? "").trim().replace(/\/$/, "");
    if (b.startsWith("https://")) return `wss://${b.slice("https://".length)}`;
    if (b.startsWith("https://")) return `ws://${b.slice("https://".length)}`;
    return b; // assume already ws/wss
}

function formatUtcMs(ms: number | null | undefined): string {
    if (ms == null) return "—";
    try {
        return new Date(ms).toISOString(); // ✅ UTC
    } catch {
        return String(ms);
    }
}

function shortAccountId(full: string): string {
    if (!full?.startsWith("0x") || full.length <= 10) return full || "—";
    return `0x…${full.slice(-5)}`;
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

function formatPercentGrowth(pctGrowth: DecimalLike | null | undefined): string {
    const n = parseDecimalLike(pctGrowth);
    if (n == null) return "—";
    const pct = n * 100;
    return (
        pct.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + "%"
    );
}

function growthClass(pctGrowth: DecimalLike | null | undefined): string {
    const n = parseDecimalLike(pctGrowth);
    if (n == null) return "text-gray-800 dark:text-gray-200";
    if (n > 0) return "text-green-600 dark:text-green-400";
    if (n < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-800 dark:text-gray-200";
}

function buildLeaderboardWsUrl(windowDays: SuccessLeaderWindowDays, asofDayMs: number): string {
    const origin = toWsOrigin(WS_BASE);
    const qs = new URLSearchParams({
        window_days: String(windowDays),
        asof_day_ms: String(asofDayMs),
    });
    return `${origin}/ws/mfb_p_success_leader/?${qs.toString()}`;
}

export default function MfbPSuccessLeaderHubPage() {
    const { setConfig } = useHeaderConfig();

    const [windowDays, setWindowDays] = useState<SuccessLeaderWindowDays>(30);
    const [seed, setSeed] = useState<SeedResponse | null>(null);
    const [seedLoading, setSeedLoading] = useState(false);
    const [seedError, setSeedError] = useState<string | null>(null);

    const [snapshot, setSnapshot] = useState<SuccessLeaderLeaderboardSnapshotV1 | null>(null);
    const [wsError, setWsError] = useState<string | null>(null);

    // Header: show ticker, hide period (Success Leader uses 7/30/60 window selector in-page)
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
    }, [setConfig]);

    // Seed fetch (HTTP only)
    useEffect(() => {
        let cancelled = false;

        async function fetchSeed() {
            try {
                setSeedLoading(true);
                setSeedError(null);
                setSnapshot(null);
                setWsError(null);

                const url = `${API_BASE}/api/mfb_p_success_leader/seed?window_days=${encodeURIComponent(
                    String(windowDays)
                )}`;

                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching Success Leader seed`);

                const raw = (await res.json()) as unknown;
                if (cancelled) return;

                const r = raw as any;
                const next: SeedResponse = {
                    asof_day_ms: typeof r?.asof_day_ms === "number" ? r.asof_day_ms : null,
                    window_days:
                        r?.window_days === 7 || r?.window_days === 30 || r?.window_days === 60
                            ? r.window_days
                            : windowDays,
                };

                setSeed(next);
            } catch (err: any) {
                if (!cancelled) setSeedError(err?.message ?? "Failed to load seed");
            } finally {
                if (!cancelled) setSeedLoading(false);
            }
        }

        fetchSeed();
        return () => {
            cancelled = true;
        };
    }, [windowDays]);

    // WS subscription (leaderboard)
    useEffect(() => {
        // No seed yet / no eligible day => do not open WS (LOCKED rule)
        if (!seed || seed.asof_day_ms == null) return;

        const stop$ = new Subject<void>();
        const wsUrl = buildLeaderboardWsUrl(seed.window_days, seed.asof_day_ms);

        const ws: WebSocketSubject<any> = webSocket({
            url: wsUrl,
            openObserver: { next: (e) => console.log("[SuccessLeader][WS] open", wsUrl, e) },
            closeObserver: { next: (e) => console.log("[SuccessLeader][WS] close", wsUrl, e) },
        });

        const replayCfg = {
            bufferSize: 1,
            refCount: true,
            resetOnRefCountZero: true,
            resetOnComplete: true,
            resetOnError: true,
        } as const;

        const stream = (ws.pipe(
            retry({ delay: () => timer(4000) }),
            takeUntil(stop$),
            shareReplay(replayCfg)
        ) as unknown) as Observable<WsUpdateDataEnvelope<any>>;

        const sub = stream.subscribe({
            next: (msg: any) => {
                try {
                    if (!msg || msg.type !== "update_data" || !msg.payload) return;

                    const payload = msg.payload as any;

                    // Kind/version gate
                    if (payload.kind !== SUCCESS_LEADER_LEADERBOARD_KIND) return;
                    if (!isSuccessLeaderLeaderboardSnapshotV1(payload)) return;

                    // Hard-drop mismatches (defensive)
                    if (payload.window_days !== seed.window_days) return;
                    if (payload.asof_day_ms !== seed.asof_day_ms) return;

                    setSnapshot(payload);
                    setWsError(null);
                } catch (e: any) {
                    console.error("[SuccessLeader][WS] apply error", e);
                    setWsError(e?.message ?? "WS apply error");
                }
            },
            error: (err) => {
                console.error("[SuccessLeader][WS] error", err);
                setWsError("WebSocket error");
            },
        });

        return () => {
            stop$.next();
            stop$.complete();
            sub.unsubscribe();
            ws.complete();
        };
    }, [seed?.asof_day_ms, seed?.window_days]);

    const headerSubtitle = useMemo(() => {
        if (seedLoading) return "Loading seed…";
        if (seedError) return seedError;
        if (!seed) return "—";
        if (seed.asof_day_ms == null) return "No eligible day available yet.";
        return `As-of day (UTC): ${formatUtcMs(seed.asof_day_ms)}`;
    }, [seedLoading, seedError, seed]);

    const leaders = snapshot?.leaders ?? [];
    const hasLeaders = leaders.length > 0;

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            {/* Page header */}
            <section className="flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                            MFB_P – Success Leaderboard
                        </h1>
                        <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                            Top accounts by <span className="font-semibold">pct_growth</span> over the selected window. Times are UTC.
                        </p>
                    </div>

                    {/* In-page window selector (7/30/60) */}
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
                    </div>
                </div>

                <div className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400">{headerSubtitle}</div>
            </section>

            {/* Leaderboard */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Leaders</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {seedLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                        ) : seedError ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{seedError}</p>
                        ) : !seed || seed.asof_day_ms == null ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No leaders available yet.</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    The backend will emit leaders once an eligible as-of day exists (coverage-gated).
                                </p>
                            </div>
                        ) : wsError ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{wsError}</p>
                        ) : !snapshot ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for leaderboard…</p>
                        ) : !hasLeaders ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No leaders returned for this window.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">Rank</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">Pct Growth</th>
                                        <th className="py-2 px-2 text-left font-semibold">Value End</th>
                                        <th className="py-2 px-2 text-left font-semibold">Equity Start</th>
                                        <th className="py-2 px-2 text-left font-semibold">Equity End</th>
                                        <th className="py-2 px-2 text-left font-semibold">Cashflow Cum</th>
                                        <th className="py-2 px-2 text-left font-semibold">Days Obs</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Actions</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {leaders.map((r, idx) => {
                                        const rank = r.rank ?? idx + 1;

                                        const lensHref =
                                            seed.asof_day_ms != null
                                                ? `/mfb-p-success-leader/lens?account_id=${encodeURIComponent(
                                                    r.account_id
                                                )}&window_days=${encodeURIComponent(String(seed.window_days))}&asof_day_ms=${encodeURIComponent(
                                                    String(seed.asof_day_ms)
                                                )}`
                                                : "#";

                                        return (
                                            <tr
                                                key={`${r.account_id}-${idx}`}
                                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                            >
                                                <td className="py-2 pr-4 align-top">
                                                    <span className="font-medium">#{rank}</span>
                                                </td>

                                                <td className="py-2 px-2 align-top">
                                                    <span className="font-mono text-[11px]">{shortAccountId(r.account_id)}</span>
                                                </td>

                                                <td className={`py-2 px-2 align-top font-semibold ${growthClass(r.pct_growth)}`}>
                                                    {formatPercentGrowth(r.pct_growth)}
                                                </td>

                                                <td className="py-2 px-2 align-top">{formatNumber(r.value_end)}</td>
                                                <td className="py-2 px-2 align-top">{formatNumber(r.equity_start)}</td>
                                                <td className="py-2 px-2 align-top">{formatNumber(r.equity_end)}</td>
                                                <td className="py-2 px-2 align-top">{formatNumber(r.cashflow_cumulative)}</td>
                                                <td className="py-2 px-2 align-top">{String(r.days_observed ?? "—")}</td>

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
                                    <span className="font-semibold">Window:</span> {snapshot.window_days}d •{" "}
                                    <span className="font-semibold">As-of (UTC):</span> {formatUtcMs(snapshot.asof_day_ms)} •{" "}
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