// hooks/useMfbParticipant.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { filter } from "rxjs";
import { useWebsocket } from "@/hooks/useWebsocket";
import type { MfbPAoiDetail, MfbPSnapshot, MfbPEventsBlock } from "@/types/mfb_p";

export type MfbPMode = "aoi" | "ticker";

interface UseMfbParticipantOptions {
    mode: MfbPMode;
    aoiId?: number; // required when mode === "aoi"
    ticker: string; // e.g. "SOL-USD"
    lookbackMinutes?: number;
    eventLimit?: number;
}

interface UseMfbParticipantResult {
    httpDetail: MfbPAoiDetail | null;
    liveSnapshot: MfbPSnapshot | null;
    loading: boolean;
    error: string | null;
}

/**
 * Normalize the "events" field into a canonical MfbPEventsBlock shape.
 * Handles:
 *  - bare array (legacy/dev)
 *  - canonical block { recent: [...], summary: {...} }
 */
function normalizeEventsBlock(raw: unknown): MfbPEventsBlock {
    if (raw && typeof raw === "object" && "recent" in (raw as any)) {
        const block = raw as MfbPEventsBlock;
        return {
            recent: Array.isArray(block.recent) ? block.recent : [],
            summary:
                block.summary ?? {
                    event_counts_by_type: {},
                    max_severity_in_window: null,
                    has_recent_choa: false,
                    has_recent_choch: false,
                },
        };
    }

    if (Array.isArray(raw)) {
        return {
            recent: raw as MfbPEventsBlock["recent"],
            summary: {
                event_counts_by_type: {},
                max_severity_in_window: null,
                has_recent_choa: false,
                has_recent_choch: false,
            },
        };
    }

    return {
        recent: [],
        summary: {
            event_counts_by_type: {},
            max_severity_in_window: null,
            has_recent_choa: false,
            has_recent_choch: false,
        },
    };
}

export function useMfbParticipant({
                                      mode,
                                      aoiId,
                                      ticker,
                                      lookbackMinutes = 120,
                                      eventLimit = 20,
                                  }: UseMfbParticipantOptions): UseMfbParticipantResult {
    // Pass AOI into useWebsocket only when in AOI mode
    const { mfbParticipant$, sendMessage } = useWebsocket(mode === "aoi" ? aoiId : undefined);

    const [httpDetail, setHttpDetail] = useState<MfbPAoiDetail | null>(null);
    const [liveSnapshot, setLiveSnapshot] = useState<MfbPSnapshot | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Initial HTTP fetch (canonical for v1.1 history)
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
                    limit: String(eventLimit), // was event_limit by mistake I changed it - need to address with events
                });

                if (mode === "aoi" && aoiId != null) {
                    params.append("aoi_id", String(aoiId));
                }

                const res = await fetch(`https://botpilot--8000.ngrok.io/api/mfb-p/aoi-detail/?${params.toString()}`);

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} when fetching AOI detail`);
                }

                const raw = await res.json();
                if (cancelled) return;

                const normalizedEvents = normalizeEventsBlock(raw.events);

                const normalizedDetail: MfbPAoiDetail = {
                    ...raw,
                    events: normalizedEvents,
                };

                setHttpDetail(normalizedDetail);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message ?? "Failed to load AOI detail");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchDetail();

        return () => {
            cancelled = true;
        };
    }, [mode, aoiId, ticker, lookbackMinutes, eventLimit]);

    // WebSocket subscription (optional live strip)
    useEffect(() => {
        if (mode === "aoi" && typeof aoiId !== "number") {
            return;
        }

        const sub = mfbParticipant$
            .pipe(
                filter((msg: any) => msg && msg.type === "update_data"),
                filter((msg: any) => {
                    const payload = msg.payload;
                    if (!payload) return false;
                    if (payload.ticker !== ticker) return false;
                    if (mode === "aoi" && payload.aoi?.id !== aoiId) return false;
                    return true;
                })
            )
            .subscribe({
                next: (msg: any) => {
                    const payload = msg.payload;

                    const normalizedEvents = normalizeEventsBlock(payload.events);

                    const normalizedSnapshot: MfbPSnapshot = {
                        ...payload,
                        events: normalizedEvents,
                    };

                    setLiveSnapshot(normalizedSnapshot);
                },
                error: (err) => {
                    console.error("[MFB_P] mfbParticipant$ error", err);
                    setError("WebSocket error in participant stream");
                },
            });

        // Canonical subscribe message per v1.1 contract
        const subscriptionMessage =
            mode === "aoi"
                ? { action: "subscribe", aoi_id: aoiId }
                : { action: "subscribe", ticker };

        try {
            sendMessage(subscriptionMessage);
        } catch (err) {
            console.error("[MFB_P] Failed to send subscribe message", err);
        }

        return () => {
            sub.unsubscribe();
        };
    }, [mode, aoiId, ticker, mfbParticipant$, sendMessage]);

    const effectiveLoading = useMemo(
        () => loading && !httpDetail && !liveSnapshot,
        [loading, httpDetail, liveSnapshot]
    );

    return {
        httpDetail,
        liveSnapshot,
        loading: effectiveLoading,
        error,
    };
}
