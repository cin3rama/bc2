// components/mfb-p/MfbPParticipantClient.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useMfbParticipant } from "@/hooks/useMfbParticipant";
import type { MfbPSnapshot } from "@/types/mfb_p";

interface MfbPParticipantClientProps {
    aoiId: number;
}

function formatMs(ms: number | undefined): string {
    if (!ms) return "-";
    try {
        return new Date(ms).toISOString();
    } catch {
        return String(ms);
    }
}

/**
 * Display rule (FINAL): show only the last 5 characters of account_id.
 */
function accountTail5(full: string): string {
    if (!full) return "—";
    return full.slice(-5);
}

function formatNumber(val: number | string | null | undefined): string {
    if (val == null) return "-";
    const num = typeof val === "string" ? Number(val) : val;
    if (num == null || Number.isNaN(num)) return "-";

    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPercent(val: number | string | null | undefined): string {
    if (val == null) return "-";
    const num = typeof val === "string" ? Number(val) : val;
    if (num == null || Number.isNaN(num)) return "-";

    const pct = num * 100;
    return (
        pct.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + "%"
    );
}

type RawStateRow = {
    ts_minute_ms: number;
    equity_usd?: number | string;
    gross_notional_usd?: number | string;
    margin_used_usd?: number | string;
    withdrawable_usd?: number | string;
    maintenance_margin_usd?: number | string;
    gross_leverage?: number | string;
    margin_utilization?: number | string;

    position_size?: number | string;
    entry_px?: number | string;
    position_value?: number | string;
    unrealized_pnl?: number | string;
    liq_px?: number | string;
    mark_px?: number | string;

    available_to_trade_long_usd?: number | string;
    available_to_trade_short_usd?: number | string;
    max_trade_size_long?: number | string;
    max_trade_size_short?: number | string;

    is_gap_filled?: boolean;
    [key: string]: any;
};

type RawFlowRow = {
    ts_minute_ms: number;
    trade_count_total?: number | string;
    net_signed_volume?: number | string;
    synthetic?: boolean;
    [key: string]: any;
};

const CANON_PERIODS = ["15min", "1h", "4h", "1d", "1w"] as const;
type CanonPeriod = (typeof CANON_PERIODS)[number];

function coerceCanonPeriod(raw: any): CanonPeriod {
    if (typeof raw === "string" && (CANON_PERIODS as readonly string[]).includes(raw)) {
        return raw as CanonPeriod;
    }
    console.warn("[MFB_P] period missing/invalid; defaulting to '1h'", { raw });
    return "1h";
}

function lookbackMinutesForPeriod(period: CanonPeriod): number {
    // FINAL fixed mapping (v1.1)
    switch (period) {
        case "15min":
            return 15;
        case "1h":
            return 120; // changed to 120 from 60 until sorted out in backend
        case "4h":
            return 120; // changed to 120 from 240 until sorted out in backend
        case "1d":
            return 1440;
        case "1w":
            return 10080;
        default:
            console.warn("[MFB_P] unexpected period; defaulting lookback to 60", { period });
            return 60;
    }
}

function parseNum(val: any, fallback = 0): number {
    const n = typeof val === "string" ? Number(val) : Number(val);
    return Number.isFinite(n) ? n : fallback;
}

export default function MfbPParticipantClient({ aoiId }: MfbPParticipantClientProps) {
    const { setConfig } = useHeaderConfig();
    const { ticker, period: rawPeriod } = useTickerPeriod() as any;

    // Ensure header shows ticker + period selectors on this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    const period = useMemo(() => coerceCanonPeriod(rawPeriod), [rawPeriod]);
    const lookbackMinutes = useMemo(() => lookbackMinutesForPeriod(period), [period]);

    const { httpDetail, liveSnapshot, loading, error } = useMfbParticipant({
        mode: "aoi",
        aoiId,
        ticker,
        lookbackMinutes,
        eventLimit: 20,
    });

    // v1.1: HTTP is canonical for history. WS is optional separate “Live strip”.
    const snapshot: MfbPSnapshot | null = liveSnapshot;
    const aoi = httpDetail?.aoi ?? snapshot?.aoi ?? null;

    const meta = httpDetail?.meta ?? null;
    const healthState = meta?.series_health?.state ?? null;
    const healthFlow = meta?.series_health?.flow ?? null;

    const stateRowsRaw: RawStateRow[] = Array.isArray(httpDetail?.series?.state)
        ? (httpDetail!.series!.state as unknown as RawStateRow[])
        : [];

    // Architect rule: if ordering is not guaranteed, sort by ts_minute_ms asc then take last.
    const stateRows: RawStateRow[] = useMemo(() => {
        if (!stateRowsRaw?.length) return [];
        const copy = stateRowsRaw.slice();
        copy.sort((a, b) => (a.ts_minute_ms ?? 0) - (b.ts_minute_ms ?? 0));
        return copy;
    }, [stateRowsRaw]);

    const flowRows: RawFlowRow[] = Array.isArray(httpDetail?.series?.flow)
        ? (httpDetail!.series!.flow as unknown as RawFlowRow[])
        : [];

    const latestState = stateRows.length ? stateRows[stateRows.length - 1] : null;
    const latestFlowHttp = flowRows.length ? flowRows[flowRows.length - 1] : null;

    // Live strip (WS) latest values only (DO NOT splice into HTTP history)
    const liveLatestState = (snapshot as any)?.state?.latest ?? null;
    const liveLatestFlow = (snapshot as any)?.flow?.latest ?? null;
    const liveEventsBlock = snapshot?.events ?? null;

    if (loading && !httpDetail && !snapshot) {
        return <LoadingIndicator message="Loading participant data..." />;
    }

    if (!aoi && error) {
        return (
            <div className="p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Unable to load AOI</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!aoi) {
        return (
            <div className="p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>No AOI data found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">
                            No participant data is available for AOI ID {aoiId} and ticker {ticker}.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- Charts (HTTP history only) ---
    const equitySeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.equity_usd, 0)]);
    const leverageSeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.gross_leverage, 0)]);
    const marginUtilSeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.margin_utilization, 0) * 100]);

    // NEW (Deliverable A): position_size at-a-glance line chart
    const positionSizeSeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.position_size, 0)]);

    const tradeCountSeries = flowRows.map((r) => [r.ts_minute_ms, parseNum(r.trade_count_total, 0)]);
    const signedVolSeries = flowRows.map((r) => [r.ts_minute_ms, parseNum(r.net_signed_volume, 0)]);
    const maxTradeCount = tradeCountSeries.reduce((m, [, v]) => Math.max(m, Number(v) || 0), 0);
    const maxAbsSignedVol = signedVolSeries.reduce((m, [, v]) => Math.max(m, Math.abs(Number(v) || 0)), 0);
    const flowAllZero = maxTradeCount === 0 && maxAbsSignedVol === 0;


    const equityOptions =
        equitySeries.length > 0
            ? {
                chart: { height: 260, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: { title: { text: "Equity (USD)" } },
                legend: { enabled: false },
                tooltip: { shared: false, valueDecimals: 2 },
                series: [{ type: "line", name: "Equity", data: equitySeries }],
            }
            : null;

    const leverageOptions =
        leverageSeries.length > 0
            ? {
                chart: { height: 220, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: { title: { text: "Gross Leverage" } },
                legend: { enabled: false },
                tooltip: { shared: false, valueDecimals: 2 },
                series: [{ type: "line", name: "Gross Leverage", data: leverageSeries }],
            }
            : null;

    const marginUtilOptions =
        marginUtilSeries.length > 0
            ? {
                chart: { height: 220, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: { title: { text: "Margin Utilization (%)" } },
                legend: { enabled: false },
                tooltip: { shared: false, valueDecimals: 2 },
                series: [{ type: "line", name: "Margin Utilization", data: marginUtilSeries }],
            }
            : null;

    const positionSizeOptions =
        positionSizeSeries.length > 0
            ? {
                chart: { height: 220, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: {
                    title: { text: "Position Size" },
                    plotLines: [
                        {
                            value: 0,
                            width: 1,
                            color: "rgba(128,128,128,0.35)", // subtle baseline
                        },
                    ],
                },
                legend: { enabled: false },
                tooltip: {
                    shared: false,
                    formatter: function (this: any) {
                        const ts = this.x as number;
                        const idx = stateRows.findIndex((r) => r.ts_minute_ms === ts);
                        const row = idx >= 0 ? stateRows[idx] : null;

                        const pos = this.y;
                        const entryPx = row?.entry_px;
                        const markPx = row?.mark_px;
                        const upnl = row?.unrealized_pnl;

                        return [
                            `<b>${new Date(ts).toISOString()}</b>`,
                            `Position Size: <b>${formatNumber(pos)}</b>`,
                            entryPx != null ? `Entry Px: ${formatNumber(entryPx)}` : null,
                            markPx != null ? `Mark Px: ${formatNumber(markPx)}` : null,
                            upnl != null ? `Unrealized PnL: ${formatNumber(upnl)}` : null,
                        ]
                            .filter(Boolean)
                            .join("<br/>");
                    },
                },
                series: [
                    {
                        type: "line",
                        name: "Position Size",
                        data: positionSizeSeries,
                    },
                ],
            }
            : null;

    const flowCountOptions =
        tradeCountSeries.length > 0
            ? {
                chart: { height: 220, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: { title: { text: "Trades / minute" } },
                legend: { enabled: false },
                tooltip: { shared: false, valueDecimals: 0 },
                series: [{ type: "column", name: "Trade Count", data: tradeCountSeries }],
            }
            : null;

    const flowSignedVolOptions =
        signedVolSeries.length > 0
            ? {
                chart: { height: 220, zoomType: "x" },
                title: { text: undefined },
                xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
                yAxis: { title: { text: "Net Signed Volume" } },
                legend: { enabled: false },
                tooltip: { shared: false, valueDecimals: 2 },
                series: [{ type: "column", name: "Net Signed Volume", data: signedVolSeries }],
            }
            : null;

    // Events (prefer HTTP list; live strip also shows WS events separately)
    const httpEvents: any[] = Array.isArray((httpDetail as any)?.events?.recent)
        ? ((httpDetail as any).events.recent as any[])
        : Array.isArray((httpDetail as any)?.events)
            ? ((httpDetail as any).events as any[])
            : [];

    const sortedHttpEvents = httpEvents.slice().sort((a, b) => (b.ts_event_ms ?? 0) - (a.ts_event_ms ?? 0));

    function choaLabel(ev: any): string | null {
        if (!ev || ev.event_type !== "CHOA") return null;
        const dir = ev?.payload?.direction;
        if (dir === "idle_to_active") return "Idle → Active";
        if (dir === "active_to_idle") return "Active → Idle";
        return "CHOA";
    }

    function choaDetail(ev: any): string | null {
        if (!ev || ev.event_type !== "CHOA") return null;
        const idleCount = ev?.payload?.idle_window_count;
        const idleTh = ev?.payload?.idle_threshold_windows;
        const pieces: string[] = [];
        if (Number.isFinite(Number(idleCount))) pieces.push(`idle ${Number(idleCount)} min`);
        if (Number.isFinite(Number(idleTh))) pieces.push(`threshold ${Number(idleTh)} min`);
        return pieces.length ? pieces.join(" • ") : null;
    }

    // Severity styling: CHOA idle_to_active explicitly “info”
    function severityClass(ev: any): string {
        const isChoaInfo = ev?.event_type === "CHOA" && ev?.payload?.direction === "idle_to_active";
        const sev = (ev?.event_severity ?? "").toLowerCase();

        if (isChoaInfo) return "text-blue-600 dark:text-blue-400";
        if (sev === "error") return "text-red-600 dark:text-red-400";
        if (sev === "warning") return "text-yellow-600 dark:text-yellow-400";
        return "text-blue-600 dark:text-blue-400";
    }

    const upnlNum = parseNum(latestState?.unrealized_pnl, NaN);
    const upnlClass =
        Number.isFinite(upnlNum) && upnlNum > 0
            ? "text-green-600 dark:text-green-400"
            : Number.isFinite(upnlNum) && upnlNum < 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-800 dark:text-gray-200";

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            {/* Page header */}
            <section className="flex flex-col gap-1">
                <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                    AOI Detail — {accountTail5(aoi.account_id)} • {period}
                </h1>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                    Lookback: <span className="font-semibold">{lookbackMinutes}</span> minutes (UTC-ms canonical)
                </div>
            </section>

            {/* Health Banners */}
            {(healthState || healthFlow) && (
                <section className="space-y-2">
                    {healthState?.state_stale ? (
                        <div className="rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-100 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-900 dark:text-yellow-100">
                            <span className="font-semibold">State feed stale:</span>{" "}
                            stale by {healthState.stale_minutes} minutes • last seen{" "}
                            <span className="font-mono text-xs">{formatMs(healthState.last_seen_ts_ms)}</span>
                        </div>
                    ) : null}

                    {healthState?.has_gaps ? (
                        <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className="font-semibold">State series has gaps:</span>{" "}
                            missing {healthState.missing_points} of {healthState.expected_points} points (forward-filled rows may exist){" "}
                        </div>
                    ) : null}

                    {healthFlow?.has_gaps ? (
                        <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className="font-semibold">Flow series has gaps:</span>{" "}
                            missing {healthFlow.missing_points} of {healthFlow.expected_points} points (not an indicator of “quiet market”)
                        </div>
                    ) : null}
                </section>
            )}

            {/* AOI Identity */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>AOI Identity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1 text-sm">
                            <div>
                                <span className="font-semibold">AOI ID: </span>
                                <span>#{aoi.id}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Ticker: </span>
                                <span className="font-mono text-xs">{ticker}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Lifecycle: </span>
                                <span>{aoi.lifecycle_state ?? "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Type: </span>
                                <span>{aoi.aoi_type ?? "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Entry reason: </span>
                                <span>{aoi.entry_reason ?? "—"}</span>
                            </div>
                            {aoi.notes ? (
                                <div>
                                    <span className="font-semibold">Notes: </span>
                                    <span>{aoi.notes}</span>
                                </div>
                            ) : null}
                            <div>
                                <span className="font-semibold">First seen: </span>
                                <span className="text-xs">{formatMs(aoi.first_seen_ts_ms)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Optional WS Live Strip (separate from HTTP history) */}
                <Card className="md:col-span-1 xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Live Strip (WS) — latest only</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {snapshot ? (
                            <div className="grid gap-3 md:grid-cols-3 text-sm">
                                <div className="space-y-1">
                                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                        Live State
                                    </div>
                                    <div>
                                        As of:{" "}
                                        <span className="font-mono text-xs">{formatMs(liveLatestState?.ts_minute_ms)}</span>
                                    </div>
                                    {"equity_usd" in (liveLatestState ?? {}) ? (
                                        <div>Equity: {formatNumber(liveLatestState?.equity_usd)}</div>
                                    ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">No live state yet.</div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                        Live Flow
                                    </div>
                                    {liveLatestFlow ? (
                                        <>
                                            <div>Trades: {liveLatestFlow.trade_count_total}</div>
                                            <div
                                                className={
                                                    parseNum(liveLatestFlow.net_signed_volume, 0) >= 0
                                                        ? "text-green-600 dark:text-green-400"
                                                        : "text-red-600 dark:text-red-400"
                                                }
                                            >
                                                Net Signed Vol: {formatNumber(liveLatestFlow.net_signed_volume)}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">No live flow yet.</div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                        Live Events
                                    </div>
                                    {liveEventsBlock?.recent?.length ? (
                                        <div className="text-xs">
                                            Latest: <span className="font-mono">{liveEventsBlock.recent[0]?.event_type}</span>{" "}
                                            <span className={severityClass(liveEventsBlock.recent[0])}>
                        {(choaLabel(liveEventsBlock.recent[0]) ??
                            liveEventsBlock.recent[0]?.event_severity ??
                            "info"
                        ).toString()}
                      </span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">No live events yet.</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">WS not connected or no snapshot received yet.</p>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* NEW: Portfolio Snapshot (full width) */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                            <span>Portfolio Snapshot</span>
                            {latestState?.ts_minute_ms ? (
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  Last update: {formatMs(latestState.ts_minute_ms)}
                </span>
                            ) : null}
                            {healthState?.state_stale ? (
                                <span className="ml-auto rounded-full border border-yellow-200 dark:border-yellow-800 bg-yellow-100 dark:bg-yellow-900/20 px-2 py-0.5 text-[11px] text-yellow-900 dark:text-yellow-100">
                  State stale: {healthState.stale_minutes}m
                </span>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {latestState ? (
                            <div className="grid gap-3 md:grid-cols-3 text-sm">
                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Balance</div>
                                    <div>Equity: {formatNumber(latestState.equity_usd)}</div>
                                    <div className={upnlClass}>
                                        Unrealized PnL: {formatNumber(latestState.unrealized_pnl)}
                                    </div>
                                    <div>Withdrawable: {formatNumber(latestState.withdrawable_usd)}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Margin</div>
                                    <div>Gross Notional: {formatNumber(latestState.gross_notional_usd)}</div>
                                    <div>Margin Used: {formatNumber(latestState.margin_used_usd)}</div>
                                    <div>Maint. Margin: {formatNumber(latestState.maintenance_margin_usd)}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Risk</div>
                                    <div>Gross Leverage: {formatNumber(latestState.gross_leverage)}</div>
                                    <div>Margin Utilization: {formatPercent(latestState.margin_utilization)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        is_gap_filled: {String(Boolean(latestState.is_gap_filled))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No state data in window.</p>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* NEW: Position Snapshot (full width) */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Position Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {latestState ? (
                            <div className="grid gap-3 md:grid-cols-3 text-sm">
                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Position</div>
                                    <div>Position Size: {formatNumber(latestState.position_size)}</div>
                                    <div>Position Value: {formatNumber(latestState.position_value)}</div>
                                    <div>Entry Px: {formatNumber(latestState.entry_px)}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Pricing</div>
                                    <div>Mark Px: {formatNumber(latestState.mark_px)}</div>
                                    <div>Liq Px: {formatNumber(latestState.liq_px)}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Capacity</div>
                                    <div className="text-xs">
                                        Ammo L: {formatNumber(latestState.available_to_trade_long_usd)} | S:{" "}
                                        {formatNumber(latestState.available_to_trade_short_usd)}
                                    </div>
                                    <div className="text-xs">
                                        Max Trade L: {formatNumber(latestState.max_trade_size_long)} | S:{" "}
                                        {formatNumber(latestState.max_trade_size_short)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No state data in window.</p>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* State Charts (HTTP) */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            State (HTTP history) — {ticker}
                            {latestState?.ts_minute_ms ? (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  last point {formatMs(latestState.ts_minute_ms)}
                </span>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {equityOptions ? (
                            <div className="mb-4">
                                <HighchartsReact highcharts={Highcharts} options={equityOptions} />
                            </div>
                        ) : (
                            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">No state history in the current lookback window.</p>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            {leverageOptions ? (
                                <HighchartsReact highcharts={Highcharts} options={leverageOptions} />
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No leverage series.</p>
                            )}

                            {marginUtilOptions ? (
                                <HighchartsReact highcharts={Highcharts} options={marginUtilOptions} />
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No margin utilization series.</p>
                            )}
                        </div>

                        {/* NEW: Position size time-series (at-a-glance) */}
                        <div className="mt-4">
                            <div className="mb-2 text-sm font-semibold">Position Size (at-a-glance)</div>
                            {positionSizeOptions ? (
                                <HighchartsReact highcharts={Highcharts} options={positionSizeOptions} />
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No position history in the current lookback window.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Flow Charts (HTTP) */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Flow (HTTP history) — densified zeros are normal
                            {latestFlowHttp?.ts_minute_ms ? (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  last point {formatMs(latestFlowHttp.ts_minute_ms)}
                </span>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {flowAllZero ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Flow in this window is all zeros (mostly densified synthetic minutes). No trades detected.
                                </p>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {flowCountOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={flowCountOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No flow series (counts).</p>
                                    )}

                                    {flowSignedVolOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={flowSignedVolOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No flow series (signed volume).</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Events Timeline (HTTP) */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Events (HTTP) — newest first</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sortedHttpEvents.length > 0 ? (
                            <div className="space-y-2 text-sm">
                                {sortedHttpEvents.map((ev) => {
                                    const label = choaLabel(ev);
                                    const detail = choaDetail(ev);
                                    const sevClass = severityClass(ev);

                                    return (
                                        <div
                                            key={ev.id ?? ev.event_id ?? `${ev.event_type}-${ev.ts_event_ms}`}
                                            className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">{ev.event_type}</span>
                                                    <span className={`${sevClass} text-xs`}>
                            {label ?? (ev.event_severity ?? "info")}
                          </span>
                                                    {detail ? (
                                                        <span className="text-[11px] text-gray-600 dark:text-gray-300">{detail}</span>
                                                    ) : null}
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatMs(ev.ts_event_ms)}</span>
                                            </div>

                                            {ev.payload?.note ? (
                                                <div className="mt-1 text-xs text-gray-800 dark:text-gray-200">{ev.payload.note}</div>
                                            ) : null}

                                            {ev.event_type === "CHOA" ? (
                                                <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-300">
                                                    {ev.payload?.last_active_ts_ms ? (
                                                        <span className="mr-3">
                              last_active:{" "}
                                                            <span className="font-mono">{formatMs(ev.payload.last_active_ts_ms)}</span>
                            </span>
                                                    ) : null}
                                                    {ev.payload?.resumed_at_ts_ms ? (
                                                        <span className="mr-3">
                              resumed_at:{" "}
                                                            <span className="font-mono">{formatMs(ev.payload.resumed_at_ts_ms)}</span>
                            </span>
                                                    ) : null}
                                                    {ev.payload?.became_idle_at_ts_ms ? (
                                                        <span className="mr-3">
                              became_idle_at:{" "}
                                                            <span className="font-mono">{formatMs(ev.payload.became_idle_at_ts_ms)}</span>
                            </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No recent events in the current window.</p>
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
