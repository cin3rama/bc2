// components/mfb-p/MfbPParticipantClient.tsx
"use client";

import React, { useEffect } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/Card";
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

function shortAccountId(full: string): string {
    if (!full?.startsWith("0x") || full.length <= 10) return full;
    const tail = full.slice(-5);
    return `0x…${tail}`;
}

function formatNumber(
    val: number | string | null | undefined,
): string {
    if (val == null) return "-";
    const num = typeof val === "string" ? Number(val) : val;
    if (num == null || Number.isNaN(num)) return "-";

    return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPercent(
    val: number | string | null | undefined,
): string {
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
    position_size?: number | string;
    [key: string]: any;
};

export default function MfbPParticipantClient({
                                                  aoiId,
                                              }: MfbPParticipantClientProps) {
    const { setConfig } = useHeaderConfig();
    const { ticker } = useTickerPeriod();

    // Ensure header shows ticker + period selectors on this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    const {
        httpDetail,
        liveSnapshot,
        loading,
        error,
    } = useMfbParticipant({
        mode: "aoi",
        aoiId,
        ticker,
        lookbackMinutes: 120,
        eventLimit: 20,
    });

    const snapshot: MfbPSnapshot | null = liveSnapshot;
    const aoi = snapshot?.aoi ?? httpDetail?.aoi ?? null;

    // Snapshot events are already normalized into a block shape by useMfbParticipant
    const eventsBlock = snapshot?.events ?? httpDetail?.events ?? null;

    if (loading && !snapshot && !httpDetail) {
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
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
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
                            No participant data is available for AOI ID {aoiId} and ticker{" "}
                            {ticker}.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- State / Flow / Analysis ---

    // 1) Get raw minute-by-minute state rows.
    //    Prefer WS snapshot series (once backend supports it), otherwise fall back
    //    to the HTTP seed: httpDetail.series.state (array of RawStateRow).
    const stateRows: RawStateRow[] =
        (snapshot &&
        (snapshot as any).state &&
        Array.isArray((snapshot as any).state.series)
            ? ((snapshot as any).state.series as RawStateRow[])
            : Array.isArray(httpDetail?.series?.state)
                ? (httpDetail!.series!.state as RawStateRow[])
                : []);

    const hasStateRows = Array.isArray(stateRows) && stateRows.length > 0;

    // 2) Latest state:
    //    Prefer snapshot.state.latest if present; otherwise derive from the last state row.
    const latestState =
        (snapshot as any)?.state?.latest ??
        (hasStateRows ? stateRows[stateRows.length - 1] : null);

    const latestFlow = snapshot?.flow?.latest ?? null;
    const analysis = snapshot?.analysis ?? null;

    // 3) Build position_size time series for the chart: [ts_minute_ms, position_size].
    const positionSeries = hasStateRows
        ? stateRows.map((row) => {
            const rawPos = row.position_size ?? 0;
            const pos =
                typeof rawPos === "string" ? Number(rawPos) : Number(rawPos);
            return [row.ts_minute_ms, pos];
        })
        : [];

    const hasPositionSeries =
        Array.isArray(positionSeries) && positionSeries.length > 0;

    const positionSizeOptions = hasPositionSeries
        ? {
            chart: {
                height: 260,
                zoomType: "x",
            },
            title: {
                text: undefined,
            },
            xAxis: {
                type: "datetime",
                title: { text: "Time (UTC)" },
            },
            yAxis: {
                title: { text: "Position Size" },
            },
            legend: {
                enabled: false,
            },
            tooltip: {
                shared: false,
                valueDecimals: 2,
            },
            series: [
                {
                    type: "line",
                    name: "Position Size",
                    data: positionSeries,
                },
            ],
        }
        : null;

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            {/* Row 1: AOI Identity */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>AOI Identity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1 text-sm">
                            <div>
                                <span className="font-semibold">Label: </span>
                                <span>{aoi.label ?? "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold">Account: </span>
                                <span className="font-mono text-xs break-all">
                                    {shortAccountId(aoi.account_id)}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold">Status: </span>
                                <span className="uppercase text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                                    {aoi.status}
                                </span>
                            </div>
                            <div>
                                <span className="font-semibold">Type: </span>
                                <span>{aoi.aoi_type ?? "—"}</span>
                            </div>
                            <div>
                                <span className="font-semibold">First seen: </span>
                                <span className="text-xs">
                                    {formatMs(aoi.first_seen_ts_ms)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Row 2: Current State – full-width card with chart + info */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Current State – {ticker}
                            {latestState && latestState.ts_minute_ms && (
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                    as of {formatMs(latestState.ts_minute_ms)}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Chart section */}
                        {positionSizeOptions ? (
                            <div className="mb-4">
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={positionSizeOptions}
                                />
                            </div>
                        ) : (
                            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                                No position history in the current lookback window.
                            </p>
                        )}

                        {/* Information section (latest datapoint) */}
                        {latestState ? (
                            <div className="grid gap-3 md:grid-cols-3 text-sm">
                                {/* Equity / Margin */}
                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                                        Balance
                                    </div>
                                    <div>
                                        Equity:{" "}
                                        {formatNumber(latestState.equity_usd)}
                                    </div>
                                    <div>
                                        Gross Notional:{" "}
                                        {formatNumber(
                                            latestState.gross_notional_usd,
                                        )}
                                    </div>
                                    <div>
                                        Margin Used:{" "}
                                        {formatNumber(
                                            latestState.margin_used_usd,
                                        )}
                                    </div>
                                    <div>
                                        Withdrawable:{" "}
                                        {formatNumber(
                                            latestState.withdrawable_usd,
                                        )}
                                    </div>
                                    <div>
                                        Maint. Margin:{" "}
                                        {formatNumber(
                                            latestState.maintenance_margin_usd,
                                        )}
                                    </div>
                                </div>

                                {/* Leverage / Utilization */}
                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                                        Leverage &amp; Risk
                                    </div>
                                    <div>
                                        Gross Leverage:{" "}
                                        {formatNumber(
                                            latestState.gross_leverage,
                                        )}
                                    </div>
                                    <div>
                                        Margin Utilization:{" "}
                                        {formatPercent(
                                            latestState.margin_utilization,
                                        )}
                                    </div>
                                    <div>
                                        Liq Px:{" "}
                                        {formatNumber(latestState.liq_px)}
                                    </div>
                                    <div>
                                        Mark Px:{" "}
                                        {formatNumber(latestState.mark_px)}
                                    </div>
                                </div>

                                {/* Position / PnL / Ammo */}
                                <div className="space-y-1">
                                    <div className="font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                                        Position &amp; Ammo
                                    </div>
                                    <div>
                                        Position Size:{" "}
                                        {formatNumber(
                                            latestState.position_size,
                                        )}
                                    </div>
                                    <div>
                                        Entry Px:{" "}
                                        {formatNumber(latestState.entry_px)}
                                    </div>
                                    <div>
                                        Position Value:{" "}
                                        {formatNumber(
                                            latestState.position_value,
                                        )}
                                    </div>
                                    <div
                                        className={
                                            Number(
                                                latestState.unrealized_pnl,
                                            ) >= 0
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                        }
                                    >
                                        Unrealized PnL:{" "}
                                        {formatNumber(
                                            latestState.unrealized_pnl,
                                        )}
                                    </div>
                                    <div className="mt-1 text-xs">
                                        Ammo L:{" "}
                                        {formatNumber(
                                            latestState.available_to_trade_long_usd,
                                        )}{" "}
                                        | S:{" "}
                                        {formatNumber(
                                            latestState.available_to_trade_short_usd,
                                        )}
                                    </div>
                                    <div className="text-xs">
                                        Max Trade L:{" "}
                                        {formatNumber(
                                            latestState.max_trade_size_long,
                                        )}{" "}
                                        | S:{" "}
                                        {formatNumber(
                                            latestState.max_trade_size_short,
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No live snapshot yet. Waiting for WebSocket update…
                            </p>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* Row 3: Flow Summary + Analysis */}
            <section className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Flow (latest window)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {latestFlow ? (
                            <div className="space-y-1 text-sm">
                                <div>
                                    <span className="font-semibold">Trades: </span>
                                    <span>
                                        total {latestFlow.trade_count_total} → buy{" "}
                                        {latestFlow.trade_count_buy} / sell{" "}
                                        {latestFlow.trade_count_sell}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-semibold">Notional: </span>
                                    <span>
                                        total{" "}
                                        {formatNumber(
                                            latestFlow.notional_vol_total,
                                        )}{" "}
                                        → buy{" "}
                                        {formatNumber(
                                            latestFlow.notional_vol_buy,
                                        )}{" "}
                                        / sell{" "}
                                        {formatNumber(
                                            latestFlow.notional_vol_sell,
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-semibold">
                                        Net Signed Volume:{" "}
                                    </span>
                                    <span
                                        className={
                                            Number(
                                                latestFlow.net_signed_volume,
                                            ) >= 0
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                        }
                                    >
                                        {formatNumber(
                                            latestFlow.net_signed_volume,
                                        )}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No flow snapshot yet.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Flags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analysis ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(analysis.flags || {}).map(
                                        ([key, val]) => (
                                            <span
                                                key={key}
                                                className={`px-2 py-0.5 rounded-full text-xs ${
                                                    val
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                }`}
                                            >
                                                {key}: {val ? "true" : "false"}
                                            </span>
                                        ),
                                    )}
                                </div>
                                {"activity_score" in (analysis.scores || {}) && (
                                    <div>
                                        Activity Score:{" "}
                                        <span className="font-semibold">
                                            {analysis.scores.activity_score?.toFixed(
                                                2,
                                            )}
                                        </span>
                                    </div>
                                )}
                                {analysis.notes?.length ? (
                                    <ul className="mt-1 list-disc pl-5">
                                        {analysis.notes.map((note, idx) => (
                                            <li key={idx}>{note}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No analysis flags available yet.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* Row 4: Events */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {eventsBlock && eventsBlock.recent.length > 0 ? (
                            <div className="space-y-2 text-sm">
                                {eventsBlock.recent
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            b.ts_event_ms - a.ts_event_ms,
                                    )
                                    .map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">
                                                        {ev.event_type}
                                                    </span>
                                                    <span
                                                        className={
                                                            ev.event_severity ===
                                                            "error"
                                                                ? "text-red-600 dark:text-red-400 text-xs"
                                                                : ev.event_severity ===
                                                                "warning"
                                                                    ? "text-yellow-600 dark:text-yellow-400 text-xs"
                                                                    : "text-blue-600 dark:text-blue-400 text-xs"
                                                        }
                                                    >
                                                        {ev.event_severity}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    {formatMs(ev.ts_event_ms)}
                                                </span>
                                            </div>
                                            {ev.payload?.note && (
                                                <div className="mt-1 text-xs text-gray-800 dark:text-gray-200">
                                                    {ev.payload.note}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No recent events in the current window.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
