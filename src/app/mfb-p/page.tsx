// /app/mfb-p/page.tsx
"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {useHeaderConfig} from "@/contexts/HeaderConfigContext";
import {useTickerPeriod} from "@/contexts/TickerPeriodContext";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/Card";
import {API_BASE} from "@/lib/env";
import {useWebsocket} from "@/hooks/useWebsocket";
import type {
    ActionMonitorCategory,
    ActionMonitorEnvelope,
    ActionMonitorParticipant,
    ActionMonitorSnapshot,
    ActorDirection,
    ActorEvent,
    ActorFeedItem,
    ActorSession,
    ActorState,
} from "@/types/actionMonitorTypes";

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

type WatchingNowRow = {
    aoi_id: number | null;
    account_id: string;
    label: string;
    aoi_type: string | null;
    state: ActorState;
    direction: ActorDirection | null;
    size: number | null;
    duration_ms: number | null;
    is_watched: boolean;
};

const ACTIVATION_THRESHOLD = 1;
const PROBE_WINDOW_MS = 45_000;
const ZERO_POSITION_EPSILON = 0.000001;
const MAX_FEED_ITEMS = 40;

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

function getActorDirectionFromPosition(value: number | null): ActorDirection | null {
    if (value === null || Math.abs(value) <= ZERO_POSITION_EPSILON) return null;
    return value > 0 ? "long" : "short";
}

function formatDurationMs(durationMs: number | null): string {
    if (durationMs === null) return "—";
    const seconds = Math.max(0, Math.floor(durationMs / 1000));
    return `${seconds}s`;
}

function formatMs(ms: number | undefined): string {
    if (!ms) return "-";
    try {
        return new Date(ms).toISOString();
    } catch {
        return String(ms);
    }
}

function getStateBadgeClass(state: ActorState): string {
    switch (state) {
        case "confirmed":
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        case "probe":
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
        case "exited":
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        default:
            return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
}

function getEventBadgeClass(event: ActorEvent): string {
    switch (event) {
        case "confirmed":
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        case "add":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        case "reduce":
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
        case "exit":
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        default:
            return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
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

export default function MfbPHubPage() {
    const {setConfig} = useHeaderConfig();
    const {ticker} = useTickerPeriod();
    const {actionMonitor$} = useWebsocket();

    const [aois, setAois] = useState<AoiApiRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<AoiSortMode>("aoi_id_asc");

    const [watchModeAccounts, setWatchModeAccounts] = useState<Set<string>>(new Set());
    const [actorSessions, setActorSessions] = useState<Record<string, ActorSession>>({});
    const [actorFeed, setActorFeed] = useState<ActorFeedItem[]>([]);
    const [liveActorsByAccount, setLiveActorsByAccount] = useState<Record<string, LiveActorSnapshot>>({});
    const [liveAsofMs, setLiveAsofMs] = useState<number | null>(null);
    const [isLiveConnected, setIsLiveConnected] = useState(false);

    const actorSessionsRef = useRef<Record<string, ActorSession>>({});
    const prevPositionsRef = useRef<Record<string, number | null>>({});
    const eventCounterRef = useRef(0);

    useEffect(() => {
        setConfig({showTicker: true, showPeriod: true});
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

    useEffect(() => {
        actorSessionsRef.current = {};
        prevPositionsRef.current = {};
        setActorSessions({});
        setActorFeed([]);
        setLiveActorsByAccount({});
        setLiveAsofMs(null);
        setIsLiveConnected(false);
    }, [ticker]);

    useEffect(() => {
        const sub = actionMonitor$.subscribe({
            next: (msg: ActionMonitorEnvelope) => {
                if (!msg?.payload || msg.type !== "update_data") return;

                const snapshot = msg.payload;
                if (snapshot.meta?.ticker && snapshot.meta.ticker !== ticker) {
                    return;
                }

                const asofMs =
                    snapshot.meta?.asof_ms ??
                    snapshot.meta?.generated_ts_ms ??
                    Date.now();

                const nextLiveActors = buildLiveActorMap(snapshot);
                setLiveActorsByAccount(nextLiveActors);
                setLiveAsofMs(asofMs);
                setIsLiveConnected(true);

                const trackedAccounts = Array.from(
                    new Set<string>([
                        ...aois.map((row) => row.account_id),
                        ...Array.from(watchModeAccounts),
                    ]),
                );

                const nextSessions: Record<string, ActorSession> = {
                    ...actorSessionsRef.current,
                };
                const nextFeedItems: ActorFeedItem[] = [];

                trackedAccounts.forEach((accountId) => {
                    const currentPosition = nextLiveActors[accountId]?.position_size ?? null;
                    const previousPosition = prevPositionsRef.current[accountId] ?? null;
                    const existingSession = nextSessions[accountId];

                    if (currentPosition === null) {
                        return;
                    }

                    if (previousPosition === null) {
                        prevPositionsRef.current[accountId] = currentPosition;
                        return;
                    }

                    const delta = currentPosition - previousPosition;
                    const absDelta = Math.abs(delta);
                    const currentDirection = getActorDirectionFromPosition(currentPosition);
                    const isNowZero = Math.abs(currentPosition) <= ZERO_POSITION_EPSILON;

                    if (!existingSession) {
                        if (!isNowZero && currentDirection && absDelta >= ACTIVATION_THRESHOLD) {
                            nextSessions[accountId] = {
                                account_id: accountId,
                                state: "probe",
                                direction: currentDirection,
                                start_ts_ms: asofMs,
                                last_update_ts_ms: asofMs,
                                initial_size: currentPosition,
                                current_size: currentPosition,
                            };

                            nextFeedItems.push({
                                id: ++eventCounterRef.current,
                                account_id: accountId,
                                event: "activation",
                                state: "probe",
                                direction: currentDirection,
                                ts_ms: asofMs,
                                size: currentPosition,
                                delta,
                            });
                        }

                        prevPositionsRef.current[accountId] = currentPosition;
                        return;
                    }

                    if (isNowZero || !currentDirection) {
                        nextFeedItems.push({
                            id: ++eventCounterRef.current,
                            account_id: accountId,
                            event: "exit",
                            state: "exited",
                            direction: existingSession.direction,
                            ts_ms: asofMs,
                            size: currentPosition,
                            delta,
                        });

                        delete nextSessions[accountId];
                        prevPositionsRef.current[accountId] = currentPosition;
                        return;
                    }

                    if (existingSession.direction !== currentDirection) {
                        nextFeedItems.push({
                            id: ++eventCounterRef.current,
                            account_id: accountId,
                            event: "exit",
                            state: "exited",
                            direction: existingSession.direction,
                            ts_ms: asofMs,
                            size: previousPosition,
                            delta,
                        });

                        nextSessions[accountId] = {
                            account_id: accountId,
                            state: "probe",
                            direction: currentDirection,
                            start_ts_ms: asofMs,
                            last_update_ts_ms: asofMs,
                            initial_size: currentPosition,
                            current_size: currentPosition,
                        };

                        nextFeedItems.push({
                            id: ++eventCounterRef.current,
                            account_id: accountId,
                            event: "activation",
                            state: "probe",
                            direction: currentDirection,
                            ts_ms: asofMs,
                            size: currentPosition,
                            delta,
                        });

                        prevPositionsRef.current[accountId] = currentPosition;
                        return;
                    }

                    const updatedSession: ActorSession = {
                        ...existingSession,
                        direction: currentDirection,
                        current_size: currentPosition,
                        last_update_ts_ms: asofMs,
                    };

                    if (existingSession.state === "probe") {
                        const probeAgeMs = asofMs - existingSession.start_ts_ms;
                        const expandedBeyondInitial =
                            Math.abs(currentPosition) >
                            Math.abs(existingSession.initial_size) + ZERO_POSITION_EPSILON;

                        if (probeAgeMs >= PROBE_WINDOW_MS || expandedBeyondInitial) {
                            updatedSession.state = "confirmed";
                            nextSessions[accountId] = updatedSession;

                            nextFeedItems.push({
                                id: ++eventCounterRef.current,
                                account_id: accountId,
                                event: "confirmed",
                                state: "confirmed",
                                direction: currentDirection,
                                ts_ms: asofMs,
                                size: currentPosition,
                                delta,
                            });
                        } else {
                            nextSessions[accountId] = updatedSession;
                        }

                        prevPositionsRef.current[accountId] = currentPosition;
                        return;
                    }

                    const previousMagnitude = Math.abs(previousPosition);
                    const currentMagnitude = Math.abs(currentPosition);

                    if (currentMagnitude - previousMagnitude >= ACTIVATION_THRESHOLD) {
                        nextFeedItems.push({
                            id: ++eventCounterRef.current,
                            account_id: accountId,
                            event: "add",
                            state: "confirmed",
                            direction: currentDirection,
                            ts_ms: asofMs,
                            size: currentPosition,
                            delta,
                        });
                    } else if (
                        previousMagnitude - currentMagnitude >= ACTIVATION_THRESHOLD &&
                        !isNowZero
                    ) {
                        nextFeedItems.push({
                            id: ++eventCounterRef.current,
                            account_id: accountId,
                            event: "reduce",
                            state: "confirmed",
                            direction: currentDirection,
                            ts_ms: asofMs,
                            size: currentPosition,
                            delta,
                        });
                    }

                    nextSessions[accountId] = updatedSession;
                    prevPositionsRef.current[accountId] = currentPosition;
                });

                actorSessionsRef.current = nextSessions;
                setActorSessions(nextSessions);

                if (nextFeedItems.length > 0) {
                    nextFeedItems.sort((a, b) => b.ts_ms - a.ts_ms);
                    setActorFeed((prev) => [...nextFeedItems, ...prev].slice(0, MAX_FEED_ITEMS));
                }
            },
            error: () => {
                setIsLiveConnected(false);
            },
            complete: () => {
                setIsLiveConnected(false);
            },
        });

        return () => sub.unsubscribe();
    }, [actionMonitor$, aois, ticker, watchModeAccounts]);

    const rowsByAccount = useMemo(() => {
        const out: Record<string, AoiApiRow> = {};
        aois.forEach((row) => {
            out[row.account_id] = row;
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
                is_watched: watchModeAccounts.has(row.account_id),
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
    }, [aois, liveActorsByAccount, sortMode, watchModeAccounts]);

    const watchingNowRows = useMemo(() => {
        const accountIds = Array.from(
            new Set<string>([
                ...Array.from(watchModeAccounts),
                ...Object.keys(actorSessions),
            ]),
        );

        const rows: WatchingNowRow[] = accountIds.map((accountId) => {
            const baseRow = rowsByAccount[accountId];
            const liveActor = liveActorsByAccount[accountId];
            const session = actorSessions[accountId] ?? null;
            const effectivePosition =
                liveActor?.position_size ??
                parsePositionValue(baseRow?.position_size ?? null);

            return {
                aoi_id: baseRow?.aoi_id ?? null,
                account_id: accountId,
                label: baseRow ? displayLabel(baseRow) : shortAccountId(accountId),
                aoi_type: liveActor?.aoi_type ?? baseRow?.aoi_type ?? null,
                state: session ? session.state : "idle",
                direction: session?.direction ?? getActorDirectionFromPosition(effectivePosition),
                size: session ? session.current_size : effectivePosition,
                duration_ms:
                    session && liveAsofMs !== null
                        ? Math.max(0, liveAsofMs - session.start_ts_ms)
                        : null,
                is_watched: watchModeAccounts.has(accountId),
            };
        });

        rows.sort((a, b) => {
            if (a.is_watched !== b.is_watched) {
                return a.is_watched ? -1 : 1;
            }

            const stateRank: Record<ActorState, number> = {
                confirmed: 0,
                probe: 1,
                idle: 2,
                exited: 3,
            };
            const stateCmp = stateRank[a.state] - stateRank[b.state];
            if (stateCmp !== 0) return stateCmp;

            const aMagnitude = a.size === null ? 0 : Math.abs(a.size);
            const bMagnitude = b.size === null ? 0 : Math.abs(b.size);
            if (bMagnitude !== aMagnitude) return bMagnitude - aMagnitude;

            return a.account_id.localeCompare(b.account_id);
        });

        return rows;
    }, [actorSessions, liveActorsByAccount, liveAsofMs, rowsByAccount, watchModeAccounts]);

    const hasAois = displayedAois.length > 0;

    function toggleWatchMode(accountId: string) {
        setWatchModeAccounts((prev) => {
            const next = new Set(prev);
            if (next.has(accountId)) {
                next.delete(accountId);
            } else {
                next.add(accountId);
            }
            return next;
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
                        Monitor key participants for <span className="font-semibold">{ticker}</span> and drill into
                        their live
                        behavior and events.
                    </p>
                </div>
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Note:</span> This hub lists AOIs. Click a row to open a dedicated
                    participant
                    lens.
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Watching Now</CardTitle>
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
                    </CardHeader>
                    <CardContent>
                        {watchingNowRows.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No watched actors or active sessions yet.
                            </p>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {watchingNowRows.map((row) => (
                                    <div
                                        key={row.account_id}
                                        className="rounded border border-gray-200 dark:border-gray-800 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-medium text-sm">{row.label}</div>
                                                <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                                    {shortAccountId(row.account_id)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {row.is_watched ? (
                                                    <span
                                                        className="inline-flex items-center rounded-full bg-primary-light dark:bg-primary-dark px-2 py-0.5 text-[10px] font-semibold text-black dark:text-text-inverted">
                                                        WATCH
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStateBadgeClass(row.state)}`}>
                                                    {row.state.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 space-y-1 text-xs md:text-sm">
                                            <div>
                                                <span className="font-semibold">Type: </span>
                                                <span>{row.aoi_type ?? "—"}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">Direction: </span>
                                                <span>{row.direction ?? "—"}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">Size: </span>
                                                <span
                                                    className={`font-medium tabular-nums ${getPositionClass(row.size)}`}>
                                                    {formatPositionValue(row.size)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">Time active: </span>
                                                <span>{formatDurationMs(row.duration_ms)}</span>
                                            </div>
                                        </div>

                                        {row.aoi_id !== null ? (
                                            <div className="mt-3">
                                                <Link
                                                    href={`/mfb-p/lens?aoiId=${row.aoi_id}`}
                                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    Open Lens
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lifecycle Feed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {actorFeed.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No lifecycle events yet.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {actorFeed.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col gap-1 rounded border border-gray-200 dark:border-gray-800 px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getEventBadgeClass(item.event)}`}>
                                                    {item.event.toUpperCase()}
                                                </span>
                                                <span className="font-mono text-[11px]">
                                                    {shortAccountId(item.account_id)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                {formatMs(item.ts_ms)}
                                            </span>
                                        </div>
                                        <div className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-semibold">State:</span> {item.state}
                                            {" · "}
                                            <span className="font-semibold">Direction:</span> {item.direction ?? "—"}
                                            {" · "}
                                            <span className="font-semibold">Size:</span>{" "}
                                            <span className={`font-medium tabular-nums ${getPositionClass(item.size)}`}>
                                                {formatPositionValue(item.size)}
                                            </span>
                                            {" · "}
                                            <span className="font-semibold">Δ:</span>{" "}
                                            <span
                                                className={`font-medium tabular-nums ${getPositionClass(item.delta)}`}>
                                                {formatPositionValue(item.delta)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
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
                                        <th className="py-2 pr-2 text-left font-semibold">Watch</th>
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
                                                    onChange={() => toggleWatchMode(aoi.account_id)}
                                                    aria-label={`Watch ${aoi.account_id}`}
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
                                                <span
                                                    className="font-mono text-[11px]">{shortAccountId(aoi.account_id)}</span>
                                            </td>

                                            <td className="py-2 px-2 align-top">
                                                <span>{aoi.effective_aoi_type ?? "—"}</span>
                                            </td>

                                            <td className="py-2 px-2 align-top text-right">
                                                    <span
                                                        className={`font-medium tabular-nums ${getPositionClass(aoi.effective_position_size)}`}>
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
