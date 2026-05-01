// /app/mfb-p/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { API_BASE } from "@/lib/env";
import { useWebsocket } from "@/hooks/useWebsocket";
import { useMfbParticipant } from "@/hooks/useMfbParticipant";
import type {
    ActionMonitorCategory,
    ActionMonitorEnvelope,
    ActionMonitorParticipant,
    ActionMonitorSnapshot,
} from "@/types/actionMonitorTypes";
import type { MfbPStateRow } from "@/types/mfb_p";

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

type LiveActorSnapshot = {
    account_id: string;
    aoi_type: string | null;
    position_size: number | null;
    is_active_aoi: boolean;
};

type DisplayAoiRow = AoiApiRow & {
    effective_aoi_type: string | null;
    effective_position_size: number | null;
    is_watched: boolean;
    live_available: boolean;
};

const CANON_PERIODS = ["15min", "1h", "4h", "1d", "1w"] as const;
type CanonPeriod = (typeof CANON_PERIODS)[number];

const WATCHED_AOI_IDS_STORAGE_KEY = "mfb_p_watch_mode_watched_aoi_ids_v1";
const AOI_SORT_MODE_STORAGE_KEY = "mfb_p_watch_mode_sort_v1";
const DEFAULT_SORT_MODE: AoiSortMode = "aoi_id_asc";

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

function buildLiveActorMap(snapshot: ActionMonitorSnapshot): Record<string, LiveActorSnapshot> {
    const byAccount: Record<string, LiveActorSnapshot> = {};
    const categories: ActionMonitorCategory[] = snapshot.categories
        ? Object.values(snapshot.categories)
        : [];

    categories.forEach((category: ActionMonitorCategory) => {
        category.participants.forEach((participant: ActionMonitorParticipant) => {
            const accountId = participant.account_id;
            if (!accountId) return;

            const candidatePosition = parsePositionValue(participant.position_size);
            const candidateType =
                typeof participant.aoi_type === "string" && participant.aoi_type.trim().length > 0
                    ? participant.aoi_type.trim()
                    : null;

            const nextValue: LiveActorSnapshot = {
                account_id: accountId,
                aoi_type: candidateType,
                position_size: candidatePosition,
                is_active_aoi: Boolean(participant.is_active_aoi),
            };

            const current = byAccount[accountId];
            if (!current) {
                byAccount[accountId] = nextValue;
                return;
            }

            const currentMagnitude = current.position_size === null ? -1 : Math.abs(current.position_size);
            const candidateMagnitude =
                candidatePosition === null ? -1 : Math.abs(candidatePosition);

            if (candidateMagnitude > currentMagnitude) {
                byAccount[accountId] = nextValue;
                return;
            }

            if (!current.aoi_type && candidateType) {
                byAccount[accountId] = {
                    ...current,
                    aoi_type: candidateType,
                    is_active_aoi: current.is_active_aoi || nextValue.is_active_aoi,
                };
            }
        });
    });

    return byAccount;
}

function coerceCanonPeriod(raw: unknown): CanonPeriod {
    if (typeof raw === "string" && (CANON_PERIODS as readonly string[]).includes(raw)) {
        return raw as CanonPeriod;
    }
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
            return 60;
    }
}

function readPositionSize(row: MfbPStateRow | null | undefined): number | null {
    return parsePositionValue(row?.position_size);
}

function isValidSortMode(value: unknown): value is AoiSortMode {
    return (
        value === "aoi_id_asc" ||
        value === "aoi_type_asc" ||
        value === "position_signed_desc" ||
        value === "position_abs_desc"
    );
}

function normalizeWatchedAoiIds(values: unknown): number[] {
    if (!Array.isArray(values)) return [];

    const normalized = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.trunc(value));

    return Array.from(new Set(normalized)).sort((a, b) => a - b);
}

function readStoredWatchedAoiIds(): number[] {
    if (typeof window === "undefined") return [];

    try {
        const raw = window.localStorage.getItem(WATCHED_AOI_IDS_STORAGE_KEY);
        if (!raw) return [];
        return normalizeWatchedAoiIds(JSON.parse(raw));
    } catch {
        return [];
    }
}

function writeStoredWatchedAoiIds(ids: number[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        WATCHED_AOI_IDS_STORAGE_KEY,
        JSON.stringify(normalizeWatchedAoiIds(ids)),
    );
}

function readStoredSortMode(): AoiSortMode {
    if (typeof window === "undefined") return DEFAULT_SORT_MODE;

    try {
        const raw = window.localStorage.getItem(AOI_SORT_MODE_STORAGE_KEY);
        return isValidSortMode(raw) ? raw : DEFAULT_SORT_MODE;
    } catch {
        return DEFAULT_SORT_MODE;
    }
}

function writeStoredSortMode(sortMode: AoiSortMode) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AOI_SORT_MODE_STORAGE_KEY, sortMode);
}

function buildWatchedPositionChartOptions(
    accountId: string,
    data: Array<[number, number | null]>,
    chartAccent: string,
): Highcharts.Options {
    return {
        chart: {
            backgroundColor: "transparent",
            height: 280,
        },
        time: { timezone: "UTC" },
        title: {
            text: "Signed Position Size",
            style: {
                color: chartAccent,
                fontSize: "14px",
                fontWeight: "600",
            },
        },
        credits: { enabled: false },
        legend: { enabled: false },
        xAxis: {
            type: "datetime",
            lineColor: chartAccent,
            tickColor: chartAccent,
            gridLineColor: chartAccent,
            labels: {
                format: "{value:%H:%M}",
                style: {
                    color: chartAccent,
                },
            },
            title: {
                text: "Time (UTC)",
                style: {
                    color: chartAccent,
                },
            },
        },
        yAxis: {
            title: {
                text: "Position Size",
                style: {
                    color: chartAccent,
                },
            },
            gridLineColor: chartAccent,
            labels: {
                style: {
                    color: chartAccent,
                },
            },
            plotLines: [
                {
                    value: 0,
                    width: 1,
                    color: chartAccent,
                    zIndex: 3,
                },
            ],
        },
        tooltip: {
            shared: false,
            xDateFormat: "%Y-%m-%d %H:%M:%S UTC",
            pointFormat: `<span style="font-weight:600">${accountId}</span><br/>Position: {point.y:,.2f}`,
        },
        plotOptions: {
            series: {
                animation: false,
            },
            line: {
                lineWidth: 2,
                marker: {
                    enabled: false,
                },
                connectNulls: false,
            },
        },
        series: [
            {
                type: "line",
                name: "Signed Position Size",
                data,
            },
        ],
    };
}

function WatchedAoiCard({
                            aoi,
                            ticker,
                            period,
                            lookbackMinutes,
                            chartAccent,
                        }: {
    aoi: DisplayAoiRow;
    ticker: string;
    period: CanonPeriod;
    lookbackMinutes: number;
    chartAccent: string;
}) {
    const { detail, loading } = useMfbParticipant({
        mode: "aoi",
        aoiId: aoi.aoi_id,
        ticker,
        period,
        lookbackMinutes,
        eventLimit: 10,
    });

    const stateRows: MfbPStateRow[] = Array.isArray(detail?.series?.state)
        ? detail.series.state
        : [];

    const latestState = stateRows.length ? stateRows[stateRows.length - 1] : null;
    const currentSignedPosition = readPositionSize(latestState) ?? aoi.effective_position_size;
    const unrealizedPnl = parsePositionValue(latestState?.unrealized_pnl);
    const effectiveAoiType =
        detail?.aoi?.aoi_type ?? aoi.effective_aoi_type ?? "—";

    const positionSeries = stateRows.map((row) => [
        row.ts_minute_ms,
        readPositionSize(row),
    ]) as Array<[number, number | null]>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3">
                    <div className="font-mono text-sm md:text-base font-semibold break-all text-text dark:text-text-inverted">
                        {aoi.account_id}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs md:text-sm">
                        <div>
                            <div className="text-gray-500 dark:text-gray-400 font-semibold">AOI Type</div>
                            <div className="text-text dark:text-text-inverted">{effectiveAoiType}</div>
                        </div>

                        <div>
                            <div className="text-gray-500 dark:text-gray-400 font-semibold">Current Signed Position</div>
                            <div className={`font-medium tabular-nums ${getPositionClass(currentSignedPosition)}`}>
                                {formatPositionValue(currentSignedPosition)}
                            </div>
                        </div>

                        <div>
                            <div className="text-gray-500 dark:text-gray-400 font-semibold">Unrealized Gain/Loss</div>
                            <div className={`font-medium tabular-nums ${getPositionClass(unrealizedPnl)}`}>
                                {formatPositionValue(unrealizedPnl)}
                            </div>
                        </div>

                        <div>
                            <div className="text-gray-500 dark:text-gray-400 font-semibold">Description</div>
                            <div className="text-text dark:text-text-inverted">{displayLabel(aoi)}</div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {loading && positionSeries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Loading live AOI position chart…
                    </p>
                ) : positionSeries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No live signed position history available yet for this watched AOI.
                    </p>
                ) : (
                    <div className="w-full">
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={buildWatchedPositionChartOptions(
                                aoi.account_id,
                                positionSeries,
                                chartAccent,
                            )}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function MfbPHubPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker, period: rawPeriod } = useTickerPeriod();
    const { actionMonitor$ } = useWebsocket();

    const [aois, setAois] = useState<AoiApiRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<AoiSortMode>(DEFAULT_SORT_MODE);
    const [watchedAoiIds, setWatchedAoiIds] = useState<Set<number>>(new Set());
    const [liveActorsByAccount, setLiveActorsByAccount] = useState<Record<string, LiveActorSnapshot>>({});
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    useEffect(() => {
        setSortMode(readStoredSortMode());
        setWatchedAoiIds(new Set(readStoredWatchedAoiIds()));
        setHasLoadedPreferences(true);
    }, []);

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

    useEffect(() => {
        const sub = actionMonitor$.subscribe({
            next: (msg: ActionMonitorEnvelope) => {
                if (!msg?.payload || msg.type !== "update_data") return;

                const snapshot = msg.payload;
                if (snapshot.meta?.ticker && snapshot.meta.ticker !== ticker) {
                    return;
                }

                setLiveActorsByAccount(buildLiveActorMap(snapshot));
                setIsLiveConnected(true);
            },
            error: () => {
                setIsLiveConnected(false);
            },
            complete: () => {
                setIsLiveConnected(false);
            },
        });

        return () => sub.unsubscribe();
    }, [actionMonitor$, ticker]);

    useEffect(() => {
        const syncDarkMode = () => {
            if (typeof document !== "undefined") {
                setIsDarkMode(document.documentElement.classList.contains("dark"));
            }
        };

        syncDarkMode();

        const observer = new MutationObserver(syncDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!hasLoadedPreferences) return;
        writeStoredSortMode(isValidSortMode(sortMode) ? sortMode : DEFAULT_SORT_MODE);
    }, [hasLoadedPreferences, sortMode]);

    useEffect(() => {
        if (!hasLoadedPreferences) return;
        const validIds = new Set(aois.map((row) => row.aoi_id));

        setWatchedAoiIds((prev) => {
            const filtered = Array.from(prev).filter((id) => validIds.has(id));
            const normalized = normalizeWatchedAoiIds(filtered);

            if (
                filtered.length === prev.size &&
                filtered.every((id) => prev.has(id))
            ) {
                return prev;
            }

            return new Set(normalized);
        });
    }, [aois, hasLoadedPreferences]);

    useEffect(() => {
        if (!hasLoadedPreferences) return;
        writeStoredWatchedAoiIds(Array.from(watchedAoiIds));
    }, [hasLoadedPreferences, watchedAoiIds]);

    const period = useMemo(() => coerceCanonPeriod(rawPeriod), [rawPeriod]);
    const lookbackMinutes = useMemo(() => lookbackMinutesForPeriod(period), [period]);
    const chartAccent = isDarkMode ? "#d1d5db" : "#374151";

    const rowsById = useMemo(() => {
        const out: Record<number, AoiApiRow> = {};
        aois.forEach((row) => {
            out[row.aoi_id] = row;
        });
        return out;
    }, [aois]);

    const displayedAois = useMemo(() => {
        const rows: DisplayAoiRow[] = aois.map((row) => {
            const liveActor = liveActorsByAccount[row.account_id];

            return {
                ...row,
                effective_aoi_type: liveActor?.aoi_type ?? row.aoi_type,
                effective_position_size:
                    liveActor?.position_size ?? parsePositionValue(row.position_size),
                is_watched: watchedAoiIds.has(row.aoi_id),
                live_available: Boolean(liveActor),
            };
        });

        rows.sort((a, b) => {
            if (sortMode === "aoi_id_asc") {
                return a.aoi_id - b.aoi_id;
            }

            if (sortMode === "aoi_type_asc") {
                const aType = a.effective_aoi_type ?? "";
                const bType = b.effective_aoi_type ?? "";
                const cmp = aType.localeCompare(bType);
                return cmp !== 0 ? cmp : a.aoi_id - b.aoi_id;
            }

            if (sortMode === "position_signed_desc") {
                const cmp = compareNullableNumbersDesc(
                    a.effective_position_size,
                    b.effective_position_size,
                );
                return cmp !== 0 ? cmp : a.aoi_id - b.aoi_id;
            }

            const aAbs =
                a.effective_position_size === null
                    ? null
                    : Math.abs(a.effective_position_size);
            const bAbs =
                b.effective_position_size === null
                    ? null
                    : Math.abs(b.effective_position_size);

            const cmp = compareNullableNumbersDesc(aAbs, bAbs);
            if (cmp !== 0) return cmp;

            const signedCmp = compareNullableNumbersDesc(
                a.effective_position_size,
                b.effective_position_size,
            );
            return signedCmp !== 0 ? signedCmp : a.aoi_id - b.aoi_id;
        });

        return rows;
    }, [aois, liveActorsByAccount, sortMode, watchedAoiIds]);

    const watchedAois = useMemo(() => {
        return normalizeWatchedAoiIds(Array.from(watchedAoiIds))
            .map((aoiId) => rowsById[aoiId])
            .filter((row): row is AoiApiRow => Boolean(row))
            .map((row) => {
                const liveActor = liveActorsByAccount[row.account_id];

                return {
                    ...row,
                    effective_aoi_type: liveActor?.aoi_type ?? row.aoi_type,
                    effective_position_size:
                        liveActor?.position_size ?? parsePositionValue(row.position_size),
                    is_watched: true,
                    live_available: Boolean(liveActor),
                } satisfies DisplayAoiRow;
            });
    }, [watchedAoiIds, rowsById, liveActorsByAccount]);

    const hasAois = displayedAois.length > 0;

    function toggleWatchMode(aoiId: number) {
        setWatchedAoiIds((prev) => {
            const next = new Set(prev);
            if (next.has(aoiId)) {
                next.delete(aoiId);
            } else {
                next.add(aoiId);
            }
            return new Set(normalizeWatchedAoiIds(Array.from(next)));
        });
    }

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

            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-text dark:text-text-inverted">
                            Watch Mode
                        </h2>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            Full-width live position monitoring for watched AOIs using existing AOI websocket updates.
                        </p>
                    </div>

                    <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isLiveConnected
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                    >
                        {isLiveConnected ? "LIVE" : "WAITING"}
                    </span>
                </div>

                {watchedAois.length === 0 ? (
                    <Card>
                        <CardContent>
                            <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
                                No watched AOIs yet. Use the Watch Mode checkbox in the AOI Watchlist to pin live position cards here.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {watchedAois.map((aoi) => (
                            <WatchedAoiCard
                                key={aoi.aoi_id}
                                aoi={aoi}
                                ticker={String(ticker ?? "")}
                                period={period}
                                lookbackMinutes={lookbackMinutes}
                                chartAccent={chartAccent}
                            />
                        ))}
                    </div>
                )}
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
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        setSortMode(isValidSortMode(nextValue) ? nextValue : DEFAULT_SORT_MODE);
                                    }}
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
                                        <th className="py-2 pr-2 text-left font-semibold">Watch Mode</th>
                                        <th className="py-2 pr-4 text-left font-semibold">AOI</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">AOI Type</th>
                                        <th className="py-2 px-2 text-right font-semibold">Position</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {displayedAois.map((aoi) => (
                                        <tr
                                            key={aoi.aoi_id}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            <td className="py-2 pr-2 align-top">
                                                <input
                                                    type="checkbox"
                                                    checked={aoi.is_watched}
                                                    onChange={() => toggleWatchMode(aoi.aoi_id)}
                                                    aria-label={`Watch AOI ${aoi.aoi_id}`}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-700 dark:bg-gray-900"
                                                />
                                            </td>

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
                                                <span>{aoi.effective_aoi_type ?? "—"}</span>
                                            </td>

                                            <td className="py-2 px-2 align-top text-right">
                                                    <span className={`font-medium tabular-nums ${getPositionClass(aoi.effective_position_size)}`}>
                                                        {formatPositionValue(aoi.effective_position_size)}
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
