// /components/mfb-p/MfbPParticipantClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useMfbParticipant } from "@/hooks/useMfbParticipant";
import { API_BASE } from "@/lib/env";
import type {
    MfbPStateRow,
    MfbPFlowRow,
    MfbPAoiHistoryPeriod,
} from "@/types/mfb_p";

interface MfbPParticipantClientProps {
    aoiId: number;
}

type PortfolioPanelView = "portfolio" | "tokenArray";
type StatePanelView = "current" | "history";

type AoiTokenArrayRow = {
    token: string;
    side: string;
    szi: string;
    position_value?: string;
    entry_px?: string;
    unrealized_pnl?: string;
    leverage_value?: string;
    leverage_type?: string;
    funding_all_time?: string;
    funding_since_open?: string;
    funding_since_change?: string;
};

type AoiTokenArrayResponse = {
    token_array: AoiTokenArrayRow[];
};

const AOI_HISTORY_PERIODS: readonly MfbPAoiHistoryPeriod[] = [
    "15min",
    "1h",
    "4h",
    "1d",
];

function isAoiTokenArrayResponse(x: any): x is AoiTokenArrayResponse {
    return (
        !!x &&
        typeof x === "object" &&
        Array.isArray(x.token_array) &&
        x.token_array.every(
            (row: any) =>
                row &&
                typeof row === "object" &&
                typeof row.token === "string" &&
                typeof row.side === "string" &&
                typeof row.szi === "string"
        )
    );
}

function formatMs(ms: number | undefined): string {
    if (!ms) return "-";
    try {
        return new Date(ms).toISOString();
    } catch {
        return String(ms);
    }
}

function accountTail5(full: string): string {
    if (!full) return "—";
    return full.slice(-5);
}

function formatNumber(val: number | string | null | undefined): string {
    if (val == null) return "-";
    const num = typeof val === "string" ? Number(val) : val;
    if (!Number.isFinite(num)) return "-";
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPercent(val: number | string | null | undefined): string {
    if (val == null) return "-";
    const num = typeof val === "string" ? Number(val) : val;
    if (!Number.isFinite(num)) return "-";
    return (
        (num * 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + "%"
    );
}

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
    switch (period) {
        case "15min":
            return 15;
        case "1h":
            return 60;
        case "4h":
            return 240;
        case "1d":
            return 1440;
        case "1w":
            return 10080;
        default:
            console.warn("[MFB_P] unexpected period; defaulting lookback to 60", { period });
            return 60;
    }
}

function historyXAxisLabelFormat(period: MfbPAoiHistoryPeriod): string {
    switch (period) {
        case "15min":
        case "1h":
            return "{value:%H:%M}";
        case "4h":
            return "{value:%m-%d %H:%M}";
        case "1d":
            return "{value:%Y-%m-%d}";
        default:
            return "{value:%H:%M}";
    }
}

function parseNum(val: any, fallback = 0): number {
    const n = typeof val === "string" ? Number(val) : Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function parseNumOrNull(val: any): number | null {
    const n = typeof val === "string" ? Number(val) : Number(val);
    return Number.isFinite(n) ? n : null;
}

function readPositionSize(row: any): number | null {
    return parseNumOrNull(row?.position_size ?? row?.positionSize);
}

export default function MfbPParticipantClient({ aoiId }: MfbPParticipantClientProps) {
    const { setConfig } = useHeaderConfig();
    const { ticker, period: rawPeriod } = useTickerPeriod() as any;

    const [portfolioView, setPortfolioView] = useState<PortfolioPanelView>("portfolio");
    const [stateView, setStateView] = useState<StatePanelView>("current");
    const [historyPeriod, setHistoryPeriod] =
        useState<MfbPAoiHistoryPeriod>("15min");
    const [tokenArray, setTokenArray] = useState<AoiTokenArrayRow[]>([]);
    const [tokenArrayLoading, setTokenArrayLoading] = useState(false);
    const [tokenArrayError, setTokenArrayError] = useState<string | null>(null);
    const [hasFetchedTokenArray, setHasFetchedTokenArray] = useState(false);

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    useEffect(() => {
        setStateView("current");
        setHistoryPeriod("15min");
    }, [aoiId, ticker]);

    const period = useMemo(() => coerceCanonPeriod(rawPeriod), [rawPeriod]);
    const lookbackMinutes = useMemo(() => lookbackMinutesForPeriod(period), [period]);
    const historyXAxisFormat = useMemo(
        () => historyXAxisLabelFormat(historyPeriod),
        [historyPeriod]
    );

    const { detail, loading, error } = useMfbParticipant({
        mode: "aoi",
        aoiId,
        ticker,
        period,
        lookbackMinutes,
        eventLimit: 20,
        historyPeriod,
    });

    const aoiAccountId = detail?.aoi?.account_id ?? null;

    const fetchTokenArray = useCallback(async () => {
        if (!aoiAccountId) return;

        try {
            setTokenArrayLoading(true);
            setTokenArrayError(null);
            setTokenArray([]);

            const url = `${API_BASE}/api/mfb-p-success-leader/token-array/?account_id=${encodeURIComponent(
                String(aoiAccountId)
            )}`;
            const res = await fetch(url);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status} fetching AOI token array`);
            }

            const raw = await res.json();

            if (!isAoiTokenArrayResponse(raw)) {
                throw new Error("AOI token array response did not match expected contract");
            }

            setTokenArray(raw.token_array);
            setHasFetchedTokenArray(true);
        } catch (e: any) {
            setTokenArrayError(e?.message ?? "Failed to load token array");
            setHasFetchedTokenArray(true);
        } finally {
            setTokenArrayLoading(false);
        }
    }, [aoiAccountId]);

    useEffect(() => {
        setPortfolioView("portfolio");
        setTokenArray([]);
        setTokenArrayError(null);
        setTokenArrayLoading(false);
        setHasFetchedTokenArray(false);
    }, [aoiId]);

    useEffect(() => {
        if (portfolioView !== "tokenArray") return;
        if (hasFetchedTokenArray) return;
        fetchTokenArray();
    }, [portfolioView, hasFetchedTokenArray, fetchTokenArray]);

    const visibleTokenArray = useMemo(() => {
        return [...tokenArray]
            .filter((row) => {
                const positionValue = parseNumOrNull(row.position_value);
                if (positionValue == null) return false;
                return Math.abs(positionValue) >= 100;
            })
            .sort((a, b) => {
                const aAbs = Math.abs(parseNumOrNull(a.position_value) ?? 0);
                const bAbs = Math.abs(parseNumOrNull(b.position_value) ?? 0);
                return bAbs - aAbs;
            });
    }, [tokenArray]);

    if (loading && !detail) {
        return <LoadingIndicator message="Loading participant data..." />;
    }

    if (!detail && error) {
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

    if (!detail) {
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

    const aoi = detail.aoi;
    const meta = detail.meta ?? {};
    const window = meta.window ?? null;

    const healthState = meta?.series_health?.state ?? null;
    const healthFlow = meta?.series_health?.flow ?? null;

    const stateRows: MfbPStateRow[] = Array.isArray(detail.series?.state)
        ? detail.series.state
        : [];
    const historyStateRows: MfbPStateRow[] = Array.isArray(detail.history_state)
        ? detail.history_state
        : [];
    const flowRows: MfbPFlowRow[] = Array.isArray(detail.series?.flow)
        ? detail.series.flow
        : [];

    const latestState = stateRows.length ? stateRows[stateRows.length - 1] : null;
    const latestFlow = flowRows.length ? flowRows[flowRows.length - 1] : null;

    const currentEquitySeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.equity_usd, 0)]);
    const currentLeverageSeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.gross_leverage, 0)]);
    const currentMarginUtilSeries = stateRows.map((r) => [r.ts_minute_ms, parseNum(r.margin_utilization, 0) * 100]);
    const currentPositionSizeSeries = stateRows.map((r) => [r.ts_minute_ms, readPositionSize(r)]);

    const historyEquitySeries = historyStateRows.map((r) => [r.ts_minute_ms, parseNum(r.equity_usd, 0)]);
    const historyLeverageSeries = historyStateRows.map((r) => [r.ts_minute_ms, parseNum(r.gross_leverage, 0)]);
    const historyMarginUtilSeries = historyStateRows.map((r) => [r.ts_minute_ms, parseNum(r.margin_utilization, 0) * 100]);
    const historyPositionSizeSeries = historyStateRows.map((r) => [r.ts_minute_ms, readPositionSize(r)]);

    const tradeCountSeries = flowRows.map((r) => [r.ts_minute_ms, parseNum(r.trade_count_total, 0)]);
    const signedVolSeries = flowRows.map((r) => [r.ts_minute_ms, parseNum(r.net_signed_volume, 0)]);

    const maxTradeCount = tradeCountSeries.reduce((m, [, v]) => Math.max(m, Number(v) || 0), 0);
    const maxAbsSignedVol = signedVolSeries.reduce((m, [, v]) => Math.max(m, Math.abs(Number(v) || 0)), 0);
    const flowAllZero = maxTradeCount === 0 && maxAbsSignedVol === 0;

    const currentEquityOptions = currentEquitySeries.length
        ? {
            chart: { height: 260, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", labels: { format: "{value:%H:%M}" }, title: { text: "Time (UTC)" } },
            yAxis: { title: { text: "Equity (USD)" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Equity", data: currentEquitySeries }],
        }
        : null;

    const currentLeverageOptions = currentLeverageSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", labels: { format: "{value:%H:%M}" }, title: { text: "Time (UTC)" } },
            yAxis: { title: { text: "Gross Leverage" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Gross Leverage", data: currentLeverageSeries }],
        }
        : null;

    const currentMarginUtilOptions = currentMarginUtilSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", labels: { format: "{value:%H:%M}" }, title: { text: "Time (UTC)" } },
            yAxis: { title: { text: "Margin Utilization (%)" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Margin Utilization", data: currentMarginUtilSeries }],
        }
        : null;

    const currentPositionSizeOptions = currentPositionSizeSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", labels: { format: "{value:%H:%M}" }, title: { text: "Time (UTC)" } },
            yAxis: {
                title: { text: "Position Size" },
                plotLines: [{ value: 0, width: 1, color: "rgba(128,128,128,0.35)" }],
            },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Position Size", data: currentPositionSizeSeries, connectNulls: false }],
        }
        : null;

    const historyEquityOptions = historyEquitySeries.length
        ? {
            chart: { height: 260, zoomType: "x" },
            title: { text: undefined },
            xAxis: {
                type: "datetime",
                labels: { format: historyXAxisFormat },
                title: { text: "Time (UTC)" },
            },
            yAxis: { title: { text: "Equity (USD)" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Equity", data: historyEquitySeries }],
        }
        : null;

    const historyLeverageOptions = historyLeverageSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: {
                type: "datetime",
                labels: { format: historyXAxisFormat },
                title: { text: "Time (UTC)" },
            },
            yAxis: { title: { text: "Gross Leverage" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Gross Leverage", data: historyLeverageSeries }],
        }
        : null;

    const historyMarginUtilOptions = historyMarginUtilSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: {
                type: "datetime",
                labels: { format: historyXAxisFormat },
                title: { text: "Time (UTC)" },
            },
            yAxis: { title: { text: "Margin Utilization (%)" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Margin Utilization", data: historyMarginUtilSeries }],
        }
        : null;

    const historyPositionSizeOptions = historyPositionSizeSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: {
                type: "datetime",
                labels: { format: historyXAxisFormat },
                title: { text: "Time (UTC)" },
            },
            yAxis: {
                title: { text: "Position Size" },
                plotLines: [{ value: 0, width: 1, color: "rgba(128,128,128,0.35)" }],
            },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "line", name: "Position Size", data: historyPositionSizeSeries, connectNulls: false }],
        }
        : null;

    const flowCountOptions = tradeCountSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", labels: { format: "{value:%H:%M}" }, title: { text: "Time (UTC)" } },
            yAxis: { title: { text: "Trades / minute" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 0 },
            series: [{ type: "column", name: "Trade Count", data: tradeCountSeries }],
        }
        : null;

    const flowSignedVolOptions = signedVolSeries.length
        ? {
            chart: { height: 220, zoomType: "x" },
            title: { text: undefined },
            xAxis: { type: "datetime", title: { text: "Time (UTC)" } },
            yAxis: { title: { text: "Net Signed Volume" } },
            legend: { enabled: false },
            tooltip: { shared: false, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
            series: [{ type: "column", name: "Net Signed Volume", data: signedVolSeries }],
        }
        : null;

    const events = detail.events?.recent ?? [];
    const sortedEvents = events.slice().sort((a, b) => (b.ts_event_ms ?? 0) - (a.ts_event_ms ?? 0));

    const upnlNum = parseNum(latestState?.unrealized_pnl, NaN);
    const upnlClass =
        Number.isFinite(upnlNum) && upnlNum > 0
            ? "text-green-600 dark:text-green-400"
            : Number.isFinite(upnlNum) && upnlNum < 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-800 dark:text-gray-200";

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            <section className="flex flex-col gap-1">
                <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                    AOI Detail — {accountTail5(aoi.account_id)} • {period}
                </h1>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                    Lookback: <span className="font-semibold">{lookbackMinutes}</span> minutes • Window:{" "}
                    <span className="font-mono">{formatMs(window?.start_ts_ms)}</span> →{" "}
                    <span className="font-mono">{formatMs(window?.end_ts_ms)}</span>
                </div>
            </section>

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
                            missing {healthState.missing_points} of {healthState.expected_points} points
                        </div>
                    ) : null}

                    {healthFlow?.has_gaps ? (
                        <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <span className="font-semibold">Flow series has gaps:</span>{" "}
                            missing {healthFlow.missing_points} of {healthFlow.expected_points} points
                        </div>
                    ) : null}
                </section>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader><CardTitle>AOI Identity</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-1 text-sm">
                            <div><span className="font-semibold">AOI ID: </span><span>#{aoi.id}</span></div>
                            <div><span className="font-semibold">Ticker: </span><span className="font-mono text-xs">{ticker}</span></div>
                            <div><span className="font-semibold">Lifecycle: </span><span>{aoi.lifecycle_state ?? "—"}</span></div>
                            <div><span className="font-semibold">Type: </span><span>{aoi.aoi_type ?? "—"}</span></div>
                            <div><span className="font-semibold">Account: </span><span>{aoi.account_id ?? "—"}</span></div>
                            <div><span className="font-semibold">Entry reason: </span><span>{aoi.entry_reason ?? "—"}</span></div>
                            {aoi.notes ? (
                                <div><span className="font-semibold">Notes: </span><span>{aoi.notes}</span></div>
                            ) : null}
                            {aoi.first_seen_ts_ms ? (
                                <div><span className="font-semibold">First seen: </span><span className="text-xs">{formatMs(aoi.first_seen_ts_ms)}</span></div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-1 xl:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>
                                Portfolio Snapshot{" "}
                                {latestState?.ts_minute_ms ? (
                                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                        last point {formatMs(latestState.ts_minute_ms)}
                                    </span>
                                ) : null}
                            </CardTitle>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPortfolioView("portfolio")}
                                    className={`text-[11px] px-2 py-1 rounded-full ${
                                        portfolioView === "portfolio"
                                            ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
                                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                                    }`}
                                >
                                    Portfolio Snapshot
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPortfolioView("tokenArray")}
                                    className={`text-[11px] px-2 py-1 rounded-full ${
                                        portfolioView === "tokenArray"
                                            ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
                                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                                    }`}
                                >
                                    Token Array
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {portfolioView === "portfolio" ? (
                            latestState ? (
                                <div className="grid gap-3 md:grid-cols-3 text-sm">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">Balance</div>
                                        <div>Equity: {formatNumber(latestState.equity_usd)}</div>
                                        <div className={upnlClass}>Unrealized PnL: {formatNumber(latestState.unrealized_pnl)}</div>
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
                            )
                        ) : tokenArrayLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading token array…</p>
                        ) : tokenArrayError ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{tokenArrayError}</p>
                        ) : visibleTokenArray.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No active token positions</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left font-semibold">Token</th>
                                            <th className="py-2 px-2 text-left font-semibold">Side</th>
                                            <th className="py-2 px-2 text-left font-semibold">Size</th>
                                            <th className="py-2 pl-2 text-left font-semibold">$Vol</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {visibleTokenArray.map((row, idx) => {
                                            const sideLower = row.side.toLowerCase();
                                            const sideClass =
                                                sideLower === "long"
                                                    ? "text-green-600 dark:text-green-400"
                                                    : sideLower === "short"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : "text-gray-800 dark:text-gray-200";

                                            return (
                                                <tr
                                                    key={`${row.token}-${row.side}-${idx}`}
                                                    className="border-b border-gray-100 dark:border-gray-800"
                                                >
                                                    <td className="py-2 pr-4">{row.token}</td>
                                                    <td className={`py-2 px-2 font-semibold ${sideClass}`}>
                                                        {row.side}
                                                    </td>
                                                    <td className="py-2 px-2">{row.szi}</td>
                                                    <td className="py-2 pl-2">{formatNumber(row.position_value)}</td>
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                                    Small positions under $100 hidden
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </section>

            <section>
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>State — {ticker}</CardTitle>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStateView("current")}
                                    className={`text-[11px] px-2 py-1 rounded-full ${
                                        stateView === "current"
                                            ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
                                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                                    }`}
                                >
                                    Current State
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStateView("history")}
                                    className={`text-[11px] px-2 py-1 rounded-full ${
                                        stateView === "history"
                                            ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
                                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                                    }`}
                                >
                                    History
                                </button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {stateView === "current" ? (
                            <>
                                {currentEquityOptions ? (
                                    <div className="mb-4">
                                        <HighchartsReact highcharts={Highcharts} options={currentEquityOptions} />
                                    </div>
                                ) : (
                                    <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">No equity series in window.</p>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    {currentLeverageOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={currentLeverageOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No leverage series.</p>
                                    )}

                                    {currentMarginUtilOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={currentMarginUtilOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No margin utilization series.</p>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 text-sm font-semibold">Position Size (critical)</div>
                                    {currentPositionSizeOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={currentPositionSizeOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No position series in window.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        AOI History
                                    </span>

                                    <div className="flex items-center gap-2">
                                        {AOI_HISTORY_PERIODS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setHistoryPeriod(option)}
                                                className={`text-[11px] px-2 py-1 rounded-full ${
                                                    historyPeriod === option
                                                        ? "bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted"
                                                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {historyEquityOptions ? (
                                    <div className="mb-4">
                                        <HighchartsReact highcharts={Highcharts} options={historyEquityOptions} />
                                    </div>
                                ) : (
                                    <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                                        No history_state series for the selected AOI history period.
                                    </p>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                    {historyLeverageOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={historyLeverageOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No leverage series.</p>
                                    )}

                                    {historyMarginUtilOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={historyMarginUtilOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No margin utilization series.</p>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 text-sm font-semibold">Position Size (critical)</div>
                                    {historyPositionSizeOptions ? (
                                        <HighchartsReact highcharts={Highcharts} options={historyPositionSizeOptions} />
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No position series in history_state.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </section>

            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Flow — densified zeros are normal
                            {latestFlow?.ts_minute_ms ? (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                    last point {formatMs(latestFlow.ts_minute_ms)}
                                </span>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {flowAllZero ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Flow in this window is all zeros (mostly densified synthetic minutes). No trades detected.
                            </p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {flowCountOptions ? (
                                    <HighchartsReact highcharts={Highcharts} options={flowCountOptions} />
                                ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">No flow count series.</p>
                                )}

                                {flowSignedVolOptions ? (
                                    <HighchartsReact highcharts={Highcharts} options={flowSignedVolOptions} />
                                ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">No signed volume series.</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>

            <section>
                <Card>
                    <CardHeader><CardTitle>Events — newest first</CardTitle></CardHeader>
                    <CardContent>
                        {sortedEvents.length ? (
                            <div className="space-y-2 text-sm">
                                {sortedEvents.map((ev) => (
                                    <div
                                        key={ev.id ?? `${ev.event_type}-${ev.ts_event_ms}`}
                                        className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs">{ev.event_type}</span>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatMs(ev.ts_event_ms)}</span>
                                            </div>
                                        </div>
                                        {ev.payload?.note ? (
                                            <div className="mt-1 text-xs text-gray-800 dark:text-gray-200">{ev.payload.note}</div>
                                        ) : null}
                                    </div>
                                ))}
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
