// hooks/useMfbParticipant.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { filter } from "rxjs";
import type {
    MfbPAoiDetail,
    MfbPSnapshot,
    MfbPEventsBlock,
    MfbPEvent,
    MfbPStateRow,
    MfbPFlowRow,
    MfbPWindow,
} from "@/types/mfb_p";

import { useMfbPWebsocket } from "@/hooks/useMfbPWebsocket";

export type MfbPMode = "aoi" | "ticker";

interface UseMfbParticipantOptions {
    mode: MfbPMode;
    aoiId?: number; // required when mode === "aoi"
    ticker: string; // e.g. "SOL-USD"
    period: string; // canonical period string
    lookbackMinutes: number;
    eventLimit?: number;
}

interface UseMfbParticipantResult {
    detail: MfbPAoiDetail | null;
    loading: boolean;
    error: string | null;
}

function normalizeEventsBlock(raw: unknown): MfbPEventsBlock {
    const empty: MfbPEventsBlock = {
        recent: [],
        summary: {
            event_counts_by_type: {},
            max_severity_in_window: null,
            has_recent_choa: false,
            has_recent_choch: false,
        },
    };

    if (raw && typeof raw === "object" && "recent" in (raw as any)) {
        const block = raw as MfbPEventsBlock;
        return {
            recent: Array.isArray(block.recent) ? block.recent : [],
            summary: block.summary ?? empty.summary,
        };
    }

    if (Array.isArray(raw)) {
        return { ...empty, recent: raw as MfbPEvent[] };
    }

    return empty;
}

function sortByTsAsc<T extends { ts_minute_ms: number }>(rows: T[]): T[] {
    const copy = rows.slice();
    copy.sort((a, b) => (a.ts_minute_ms ?? 0) - (b.ts_minute_ms ?? 0));
    return copy;
}

function last<T>(arr: T[] | null | undefined): T | null {
    if (!arr || !arr.length) return null;
    return arr[arr.length - 1] ?? null;
}

function coerceLatestFromBlock<T extends { ts_minute_ms: number }>(
    block: any,
): T | null {
    if (!block) return null;
    if (block.latest) return block.latest as T;
    const s = block.series as T[] | undefined;
    return last(s);
}

function makeSyntheticZeroFlow(ts_minute_ms: number, ticker?: string): MfbPFlowRow {
    return {
        ts_minute_ms,
        ticker,
        trade_count_total: 0,
        trade_count_buy: 0,
        trade_count_sell: 0,
        notional_vol_total: 0,
        notional_vol_buy: 0,
        notional_vol_sell: 0,
        net_signed_volume: 0,
        synthetic: true,
    };
}

function trimByWindow<T extends { ts_minute_ms: number }>(
    rows: T[],
    window: MfbPWindow | null,
): T[] {
    if (!window) return rows;
    const { start_ts_ms, end_ts_ms } = window;
    return rows.filter((r) => r.ts_minute_ms >= start_ts_ms && r.ts_minute_ms < end_ts_ms);
}

function inferWindowFallback(lookbackMinutes: number): MfbPWindow {
    const end = Date.now();
    const start = end - lookbackMinutes * 60_000;
    return {
        start_ts_ms: start,
        end_ts_ms: end,
        lookback_minutes: lookbackMinutes,
    };
}

function dedupeByTs<T extends { ts_minute_ms: number }>(rows: T[]): T[] {
    const m = new Map<number, T>();
    for (const r of rows) m.set(r.ts_minute_ms, r); // keep last occurrence
    return Array.from(m.values()).sort((a, b) => a.ts_minute_ms - b.ts_minute_ms);
}

function upsertByTs<T extends { ts_minute_ms: number }>(rows: T[], point: T): T[] {
    if (!rows.length) return [point];
    const out = rows.slice();
    const lastIdx = out.length - 1;
    const lastTs = out[lastIdx].ts_minute_ms;

    if (point.ts_minute_ms === lastTs) {
        out[lastIdx] = point; // ✅ replace
        return out;
    }
    if (point.ts_minute_ms > lastTs) {
        out.push(point); // ✅ append
        return out;
    }

    // out-of-order correction: insert + dedupe
    out.push(point);
    return dedupeByTs(out);
}

export function useMfbParticipant({
                                      mode,
                                      aoiId,
                                      ticker,
                                      period,
                                      lookbackMinutes,
                                      eventLimit = 20,
                                  }: UseMfbParticipantOptions): UseMfbParticipantResult {
    const [detail, setDetail] = useState<MfbPAoiDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Dedicated MFB_P AOI websocket (canonical)
    // hooks/useMfbParticipant.ts (inside the hook body)

// ... inside useMfbParticipant(...)
    const depsKey = `${mode}|${aoiId ?? ""}|${ticker}|${period}|${lookbackMinutes}`;

    const { snapshot$ } = useMfbPWebsocket(
        {
            aoiId,
            ticker,
            period,
            lookbackMinutes,
        },
        depsKey
    );

    function canonicalizeWindow(
        input: any,
        lookbackMinutes: number
    ) {
        if (!input) return null;

        const end = typeof input.end_ts_ms === "number" ? input.end_ts_ms : null;
        const start = typeof input.start_ts_ms === "number" ? input.start_ts_ms : null;

        // Prefer an explicit end, otherwise fall back to start+lookback
        const endTs =
            end ??
            (start != null ? start + lookbackMinutes * 60_000 : null);

        if (endTs == null) return null;

        const startTs = endTs - lookbackMinutes * 60_000;

        return {
            start_ts_ms: startTs,
            end_ts_ms: endTs,
            lookback_minutes: lookbackMinutes,
            // IMPORTANT: prevent the 120-point cap from ever being applied
            max_points: lookbackMinutes, // 1 point per minute in v1.1
        };
    }



    // HTTP Seed (canonical history)
    useEffect(() => {
        let cancelled = false;

        async function fetchDetail() {
            try {
                setLoading(true);
                setError(null);

                if (mode === "aoi" && typeof aoiId !== "number") {
                    throw new Error("aoiId is required when mode='aoi'");
                }

                const params = new URLSearchParams({
                    ticker,
                    lookback_minutes: String(lookbackMinutes),
                    limit: String(eventLimit), // ✅ canonical
                });

                if (mode === "aoi" && aoiId != null) {
                    params.append("aoi_id", String(aoiId));
                }

                const base =
                    process.env.NEXT_PUBLIC_MFBP_HTTP_ORIGIN?.replace(/\/$/, "") ??
                    ""; // empty => same-origin
                const url = `https://api.a3therflow.com/api/mfb-p/aoi-detail/?${params.toString()}`;
                console.log('BASE: ', process.env.NEXT_PUBLIC_MFBP_HTTP_ORIGIN, 'URL: ',  url);

                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} when fetching AOI detail`);

                const raw = await res.json();
                if (cancelled) return;

                const normalizedEvents = normalizeEventsBlock(raw.events);

                const stateRows = Array.isArray(raw?.series?.state) ? sortByTsAsc(raw.series.state) : [];
                const flowRows = Array.isArray(raw?.series?.flow) ? sortByTsAsc(raw.series.flow) : [];

                const normalized: MfbPAoiDetail = {
                    ...raw,
                    events: normalizedEvents,
                    series: {
                        state: stateRows,
                        flow: flowRows,
                    },
                    meta: {
                        ...(raw.meta ?? {}),
                        // ensure we always have *some* window to trim against
                        window: raw?.meta?.window ?? inferWindowFallback(lookbackMinutes),
                    },
                };

                setDetail(normalized);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? "Failed to load AOI detail");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchDetail();
        return () => {
            cancelled = true;
        };
    }, [mode, aoiId, ticker, lookbackMinutes, eventLimit]);

    // WS Live Append (single newest minute point; window-trim)
    useEffect(() => {
        if (mode === "aoi" && typeof aoiId !== "number") return;

        const sub = snapshot$
            .pipe(
                filter((msg: any) => msg && msg.type === "update_data" && msg.payload),
                filter((msg: any) => (msg.payload as any).kind === "mfb_p_snapshot"),
                filter((msg: any) => {
                    const p = msg.payload as any;

                    if (mode === "aoi" && p?.aoi?.id !== aoiId) return false;

                    // ✅ Hard-drop mismatches to avoid cross-ticker/period contamination
                    if (p?.ticker && p.ticker !== ticker) {
                        console.warn("[MFB_P][WS] ticker mismatch (dropping)", { ws: p.ticker, fe: ticker });
                        return false;
                    }
                    if (p?.period && p.period !== period) {
                        console.warn("[MFB_P][WS] period mismatch (dropping)", { ws: p.period, fe: period });
                        return false;
                    }

                    return true;
                })
            )
            .subscribe({
                next: (msg: any) => {
                    const payload = msg.payload as any;

                    setDetail((prev) => {
                        if (!prev) return prev;

                        const rawWindow = payload.window ?? prev.meta?.window ?? null;
                        if (payload?.window?.lookback_minutes && payload.window.lookback_minutes !== lookbackMinutes) {
                            console.warn("[MFB_P] WS lookback_minutes differs from UI; using UI lookbackMinutes", {
                                ws: payload.window.lookback_minutes,
                                ui: lookbackMinutes,
                                period,
                                ticker,
                            });
                        }
                        const nextWindow = canonicalizeWindow(rawWindow, lookbackMinutes);

                        // ✅ STATE: merge WS into prev (never shrink history)
                        const prevState = prev.series.state ?? [];
                        let nextState = prevState;

                        if (Array.isArray(payload?.state?.series) && payload.state.series.length) {
                            // Union-by-ts: WS points overwrite older points with same ts after dedupe
                            nextState = dedupeByTs([...prevState, ...payload.state.series]);
                        }

                        if (payload?.state?.latest) {
                            // Latest is authoritative for its timestamp
                            nextState = upsertByTs(nextState, payload.state.latest);
                        }

                        // ✅ FLOW: merge WS into prev (never shrink history)
                        const prevFlow = prev.series.flow ?? [];
                        let nextFlow = prevFlow;

                        if (Array.isArray(payload?.flow?.series) && payload.flow.series.length) {
                            nextFlow = dedupeByTs([...prevFlow, ...payload.flow.series]);
                        }

                        if (payload?.flow?.latest) {
                            nextFlow = upsertByTs(nextFlow, payload.flow.latest);
                        }

                        // optional: if flow is missing but state advanced, add a synthetic 0 bar
                        if (!payload?.flow?.latest && (!Array.isArray(payload?.flow?.series) || !payload.flow.series.length)) {
                            const lastStateTs = nextState.length ? nextState[nextState.length - 1].ts_minute_ms : null;
                            const lastFlowTs = nextFlow.length ? nextFlow[nextFlow.length - 1].ts_minute_ms : null;
                            if (lastStateTs != null && (lastFlowTs == null || lastStateTs > lastFlowTs)) {
                                nextFlow = upsertByTs(nextFlow, makeSyntheticZeroFlow(lastStateTs, payload.ticker ?? prev.ticker));
                            }
                        }

                        // ✅ Trim to window if present
                        nextState = trimByWindow(nextState, nextWindow);
                        nextFlow = trimByWindow(nextFlow, nextWindow);

                        // ✅ Safety cap: ensure we never exceed expected 1-minute resolution points
                        if (nextState.length > lookbackMinutes) nextState = nextState.slice(-lookbackMinutes);
                        if (nextFlow.length > lookbackMinutes) nextFlow = nextFlow.slice(-lookbackMinutes);

                        // ✅ Events: accept array or block
                        const nextEvents = payload.events !== undefined
                            ? normalizeEventsBlock(payload.events)
                            : prev.events;

                        return {
                            ...prev,
                            // ✅ do NOT let WS mutate the displayed ticker/period identity
                            meta: { ...(prev.meta ?? {}), window: nextWindow ?? prev.meta?.window },
                            series: { state: nextState, flow: nextFlow },
                            events: nextEvents,
                        };
                    });
                    console.log("[MFB_P][WS] applying", {
                        aoi: payload?.aoi?.id,
                        wsTicker: payload?.ticker,
                        wsPeriod: payload?.period,
                        latestTs: payload?.state?.latest?.ts_minute_ms,
                        seriesLen: payload?.state?.series?.length,
                    });

                },
                error: (err) => console.error("[MFB_P][WS] error", err),
            });

        return () => sub.unsubscribe();
    }, [snapshot$, mode, aoiId, ticker, period]); // ✅ no `detail` dependency


    const effectiveLoading = useMemo(() => loading && !detail, [loading, detail]);

    return { detail, loading: effectiveLoading, error };
}
