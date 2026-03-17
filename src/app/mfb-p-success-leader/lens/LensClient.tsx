// app/mfb-p-success-leader/lens/LensClient.tsx
"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";

import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import {useHeaderConfig} from "@/contexts/HeaderConfigContext";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/Card";
import {API_BASE} from "@/lib/env";

import type {
    DecimalLike,
    SuccessLeaderAccountSnapshotV1,
    SuccessLeaderLeaderboardSnapshotV1,
    SuccessLeaderWindowDays,
} from "@/types/mfb_p_success_leader";
import {isSuccessLeaderLeaderboardSnapshotV1, SUCCESS_LEADER_SNAPSHOT_KIND} from "@/types/mfb_p_success_leader";

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

function formatPctGrowthForCards(pctGrowth: DecimalLike | null | undefined): string {
    const n = parseDecimalLike(pctGrowth);
    if (n == null) return "—";
    // Existing display rule (kept): if magnitude > 1, assume already percent-ish; else ratio*100.
    const displayPct = Math.abs(n) > 1 ? n : n * 100;
    return (
        displayPct.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) +
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

// Derived UI field: Confidence badge
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

// Derived UI field: Funding badge
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
 * Seed can arrive as:
 * - Envelope: { type:"update_data", payload:<leaderboard_snapshot> }
 * - Raw payload: <leaderboard_snapshot>
 * - Minimal: { asof_day_ms, window_days, leaders }
 */
function extractLeaderboardSeed(raw: any): {
    leaderboard: SuccessLeaderLeaderboardSnapshotV1 | null;
    minimal: { asof_day_ms: number | null; window_days: SuccessLeaderWindowDays; leaders: any[] } | null;
} {
    // Envelope
    if (raw && typeof raw === "object" && raw.type === "update_data" && raw.payload) {
        if (isSuccessLeaderLeaderboardSnapshotV1(raw.payload)) {
            return {leaderboard: raw.payload, minimal: null};
        }
    }
    // Raw payload
    if (isSuccessLeaderLeaderboardSnapshotV1(raw)) {
        return {leaderboard: raw, minimal: null};
    }
    // Minimal
    const wd = raw?.window_days;
    const asof = raw?.asof_day_ms;
    const leaders = raw?.leaders;
    if (
        (wd === 7 || wd === 30 || wd === 60) &&
        (asof == null || typeof asof === "number") &&
        Array.isArray(leaders)
    ) {
        return {
            leaderboard: null,
            minimal: {
                asof_day_ms: typeof asof === "number" ? asof : null,
                window_days: wd,
                leaders,
            },
        };
    }
    return {leaderboard: null, minimal: null};
}

/** v2-only ROI points */
type RoiDailyPoint = [number, DecimalLike];

function isRoiDailyArray(x: any): x is RoiDailyPoint[] {
    if (!Array.isArray(x)) return false;
    // empty is allowed; backend guarantees order when present
    return x.every(
        (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            typeof p[0] === "number" &&
            (typeof p[1] === "number" || typeof p[1] === "string")
    );
}

/**
 * ✅ Strict v2 snapshot type (LOCAL ONLY)
 * Avoid intersection with SuccessLeaderAccountSnapshotV1.version === 1 by omitting "version".
 */
type SuccessLeaderAccountSnapshotV2 = Omit<SuccessLeaderAccountSnapshotV1, "version"> & {
    version: 2;
    roi_daily: RoiDailyPoint[];
};

function isStrictV2Snapshot(x: any): x is SuccessLeaderAccountSnapshotV2 {
    return (
        !!x &&
        x.kind === SUCCESS_LEADER_SNAPSHOT_KIND &&
        x.version === 2 &&
        typeof x.account_id === "string" &&
        typeof x.asof_day_ms === "number" &&
        (x.window_days === 7 || x.window_days === 30 || x.window_days === 60) &&
        typeof x.days_observed === "number" &&
        isRoiDailyArray(x.roi_daily) // must exist and be array (may be empty)
    );
}

export default function LensClient() {
    const {setConfig} = useHeaderConfig();
    const sp = useSearchParams();

    useEffect(() => {
        setConfig({showTicker: true, showPeriod: false});
    }, [setConfig]);

    const accountId = sp.get("account_id") ?? "";
    const windowDaysRaw = sp.get("window_days");
    const asofDayRaw = sp.get("asof_day_ms");

    const windowDays: SuccessLeaderWindowDays | null = useMemo(() => {
        const n = windowDaysRaw ? Number(windowDaysRaw) : NaN;
        return n === 7 || n === 30 || n === 60 ? (n as SuccessLeaderWindowDays) : null;
    }, [windowDaysRaw]);

    const asofDayMs: number | null = useMemo(() => {
        const n = asofDayRaw ? Number(asofDayRaw) : NaN;
        return Number.isFinite(n) ? n : null;
    }, [asofDayRaw]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ Strict v2 only
    const [leader, setLeader] = useState<SuccessLeaderAccountSnapshotV2 | null>(null);

    const [seedAsof, setSeedAsof] = useState<number | null>(null);
    const [seedRunId, setSeedRunId] = useState<string | null>(null);

    const [detected, setDetected] = useState<{ kind?: any; version?: any; roi_daily_type?: string } | null>(null);

    const fetchSeedAndSelect = useCallback(async () => {
        if (!windowDays) return;

        try {
            setLoading(true);
            setError(null);
            setLeader(null);
            setDetected(null);

            const url = `${API_BASE}/api/mfb-p-success-leader/seed?window_days=${encodeURIComponent(String(windowDays))}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching Success Leader seed`);

            const raw = await res.json();
            const extracted = extractLeaderboardSeed(raw);

            const leadersAny = extracted.leaderboard?.leaders ?? extracted.minimal?.leaders ?? [];
            const asof = extracted.leaderboard?.asof_day_ms ?? extracted.minimal?.asof_day_ms ?? null;
            const runId = extracted.leaderboard?.meta?.run_id ?? null;

            setSeedAsof(typeof asof === "number" ? asof : null);
            setSeedRunId(runId);

            if (asof == null) {
                setError("No leaders available yet (asof_day_ms is null).");
                return;
            }

            if (asofDayMs != null && asofDayMs !== asof) {
                setError(
                    `Lens params asof_day_ms (${asofDayMs}) does not match current seed asof_day_ms (${asof}). Go back and reopen lens from the leaderboard.`
                );
                return;
            }

            const foundAny = leadersAny.find((x: any) => {
                return (
                    x &&
                    x.kind === SUCCESS_LEADER_SNAPSHOT_KIND &&
                    typeof x.account_id === "string" &&
                    x.account_id.toLowerCase() === accountId.toLowerCase()
                );
            });

            if (!foundAny) {
                setError("Account not found in current seed leaders list.");
                return;
            }

            // ✅ STRICT v2 enforcement
            if (!isStrictV2Snapshot(foundAny)) {
                setDetected({
                    kind: foundAny?.kind,
                    version: foundAny?.version,
                    roi_daily_type: Array.isArray(foundAny?.roi_daily) ? "array" : typeof foundAny?.roi_daily,
                });
                setError("Unsupported Success Leader snapshot contract");
                return;
            }

            setLeader(foundAny);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load lens");
        } finally {
            setLoading(false);
        }
    }, [accountId, asofDayMs, windowDays]);

    useEffect(() => {
        if (!accountId || !windowDays) return;
        fetchSeedAndSelect();
    }, [accountId, windowDays, fetchSeedAndSelect]);

    // Param validation
    if (!accountId?.startsWith("0x")) {
        return (
            <div className="p-4 text-sm text-red-600 dark:text-red-400">
                Missing/invalid <span className="font-mono">account_id</span>.
            </div>
        );
    }
    if (!windowDays || !WINDOWS.includes(windowDays)) {
        return (
            <div className="p-4 text-sm text-red-600 dark:text-red-400">
                Missing/invalid <span className="font-mono">window_days</span> (must be 7, 30, or 60).
            </div>
        );
    }
    if (asofDayRaw && asofDayMs == null) {
        return (
            <div className="p-4 text-sm text-red-600 dark:text-red-400">
                Invalid <span className="font-mono">asof_day_ms</span>.
            </div>
        );
    }

    // ROI chart options (strict v2 only)
    const roiChartOptions = useMemo(() => {
        if (!leader) return null;

        const seriesData = leader.roi_daily.map(([dayMs, pct]) => {
            const n = parseDecimalLike(pct);
            return [dayMs, n == null ? null : n * 100] as [number, number | null]; // pct -> %
        });

        return {
            chart: {height: 260, zoomType: "x"},
            title: {text: undefined},
            xAxis: {type: "datetime", title: {text: "Day (UTC)"}},
            yAxis: {
                title: {text: "ROI (%)"},
                labels: {
                    formatter: function (this: any) {
                        const v = typeof this.value === "number" ? this.value : Number(this.value);
                        if (!Number.isFinite(v)) return String(this.value);
                        return v.toFixed(0) + "%";
                    },
                },
            },
            legend: {enabled: false},
            plotOptions: {
                series: {
                    marker: {enabled: false},
                    lineWidth: 2,
                },
            },
            tooltip: {
                shared: false,
                useHTML: true,
                formatter: function (this: any) {
                    const x = this.x as number;
                    const y = this.y as number;
                    const date = Highcharts.dateFormat("%b %e, %Y", x);
                    return `${date}: <b>${Number(y).toFixed(2)}%</b>`;
                },
            },
            series: [
                {
                    type: "line",
                    name: "ROI",
                    data: seriesData,
                    connectNulls: false,
                },
            ],
        } as Highcharts.Options;
    }, [leader]);

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            <section className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                    <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                        Success Leader Lens — …{accountTail5(accountId)} • {windowDays}d
                    </h1>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/mfb-p-success-leader"
                            className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Back
                        </Link>
                        <button
                            onClick={fetchSeedAndSelect}
                            className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-300">
                    As-of (UTC):{" "}
                    <span className="font-mono text-[11px]">{formatUtcMs(seedAsof ?? asofDayMs)}</span>
                    {seedRunId ? (
                        <>
                            {" "}
                            • run_id: <span className="font-mono text-[11px]">{seedRunId}</span>
                        </>
                    ) : null}
                </div>
            </section>

            {loading && !leader ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading lens…</p>
            ) : error ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Unsupported Success Leader snapshot contract</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            <div>
                                Expected:{" "}
                                <span className="font-mono">kind="{SUCCESS_LEADER_SNAPSHOT_KIND}"</span>,{" "}
                                <span className="font-mono">version=2</span>,{" "}
                                <span className="font-mono">roi_daily: [[day_ms, pct_growth], ...]</span>
                            </div>
                            {detected ? (
                                <div>
                                    Detected:{" "}
                                    <span className="font-mono">kind={String(detected.kind)}</span> •{" "}
                                    <span className="font-mono">version={String(detected.version)}</span> •{" "}
                                    <span className="font-mono">roi_daily={String(detected.roi_daily_type)}</span>
                                </div>
                            ) : null}
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                This lens is intentionally strict to surface contract mismatches during testing.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : !leader ? (
                <Card>
                    <CardHeader>
                        <CardTitle>No lens data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No snapshot found for this account.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Summary cards */}
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Growth</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-xl font-semibold ${growthClass(leader.pct_growth)}`}>
                                    {formatPctGrowthForCards(leader.pct_growth)}
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    days_observed: {leader.days_observed} • window_days: {leader.window_days}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Ending Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-semibold">{formatNumber(leader.value_end)}</div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    value_start: {formatNumber(leader.value_start)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>External Cashflow</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-semibold">{formatNumber(leader.cashflow_cumulative)}</div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    affects value_end = equity_end - cashflow_cumulative
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Badges</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const conf = confidenceBadge(leader.days_observed, leader.window_days);
                                    const fund = fundingBadge(leader.cashflow_cumulative);
                                    return (
                                        <div className="flex flex-wrap gap-2">
                      <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.cls}`}>
                        {conf.label}
                      </span>
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${fund.cls}`}>
                        {fund.label}
                      </span>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </section>

                    {/* ROI Chart (STRICT v2: roi_daily must exist) */}
                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>ROI ({leader.window_days}D)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {leader.roi_daily.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No ROI data available.</p>
                                ) : roiChartOptions ? (
                                    <>
                                        <HighchartsReact highcharts={Highcharts} options={roiChartOptions}/>
                                        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                            Daily cumulative ROI (%) • UTC day boundaries
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No ROI data available.</p>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {/* Detailed metrics */}
                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>Detailed Metrics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
                                    <div>
                                        <div
                                            className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Identity
                                        </div>
                                        <div className="mt-1">
                                            <span className="font-semibold">Account:</span>{" "}
                                            <span className="font-mono text-[11px]">{leader.account_id}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold">As-of (UTC):</span>{" "}
                                            <span
                                                className="font-mono text-[11px]">{formatUtcMs(leader.asof_day_ms)}</span>
                                        </div>
                                        <div>
                                            <span className="font-semibold">Window:</span> {leader.window_days}d
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">version: 2</div>
                                    </div>

                                    <div>
                                        <div
                                            className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Equity
                                        </div>
                                        <div className="mt-1">equity_start: {formatNumber(leader.equity_start)}</div>
                                        <div>equity_end: {formatNumber(leader.equity_end)}</div>
                                    </div>

                                    <div>
                                        <div
                                            className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Value
                                            / Cashflow
                                        </div>
                                        <div className="mt-1">value_start: {formatNumber(leader.value_start)}</div>
                                        <div>value_end: {formatNumber(leader.value_end)}</div>
                                        <div>cashflow_cumulative: {formatNumber(leader.cashflow_cumulative)}</div>
                                    </div>

                                    <div>
                                        <div
                                            className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Return
                                        </div>
                                        <div className={`mt-1 font-semibold ${growthClass(leader.pct_growth)}`}>
                                            pct_growth: {formatPctGrowthForCards(leader.pct_growth)}
                                        </div>
                                        <div>days_observed: {leader.days_observed}</div>
                                    </div>

                                    <div className="md:col-span-2 xl:col-span-2">
                                        <div
                                            className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Meta
                                        </div>
                                        <div className="mt-1">
                                            run_id: <span
                                            className="font-mono text-[11px]">{leader.meta?.run_id ?? "—"}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </>
            )}
        </main>
    );
}
