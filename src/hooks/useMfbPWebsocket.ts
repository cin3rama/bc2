// hooks/useMfbPWebsocket.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { Observable, EMPTY, Subject, timer } from "rxjs";
import { retry, takeUntil, shareReplay } from "rxjs/operators";
import { WS_BASE } from '@/lib/env';

import type { MfbPSnapshot } from "@/types/mfb_p";

// Hard-coded origin per current constraints.

export interface MfbPWebsocketParams {
    aoiId?: number;
    ticker?: string;
    period?: string;          // canonical: "15min" | "1h" | "4h" | "1d" | "1w"
    lookbackMinutes?: number; // from the mapping in MfbPParticipantClient
}

/**
 * AOI-detail WebSocket hook.
 *
 * NOTE: We *only* build a URL when we have an AOI id.
 *       Ticker/period/lookbackMinutes are optional but strongly recommended.
 */
export function useMfbPWebsocket(
    params: MfbPWebsocketParams,
    depsKey?: string
) {
    const [snapshot$, setSnapshot$] = useState<Observable<MfbPSnapshot>>(EMPTY);

    const url = useMemo(() => {
        const { aoiId, ticker, period, lookbackMinutes } = params;

        if (typeof aoiId !== "number") return null;

        const qs = new URLSearchParams();
        qs.set("mode", "aoi");
        qs.set("aoi_id", String(aoiId));

        if (ticker) qs.set("ticker", ticker);
        if (period) qs.set("period", period);
        if (typeof lookbackMinutes === "number" && Number.isFinite(lookbackMinutes)) {
            qs.set("lookback_minutes", String(lookbackMinutes));
        }

        const fullUrl = `${WS_BASE.replace(/\/$/, "")}/ws/mfb-p/?${qs.toString()}`;
        console.log("[MFB_P][WS] url", { fullUrl });
        return fullUrl;
    }, [params.aoiId, params.ticker, params.period, params.lookbackMinutes, depsKey]);

    useEffect(() => {
        if (!url) {
            setSnapshot$(EMPTY);
            return;
        }

        const stop$ = new Subject<void>();

        const ws: WebSocketSubject<any> = webSocket({
            url,
            openObserver: {
                next: (e) => console.log("[MFB_P][WS] open", url, e),
            },
            closeObserver: {
                next: (e) => console.log("[MFB_P][WS] close", url, e),
            },
        });

        const replayCfg = {
            bufferSize: 1,
            refCount: true,
            resetOnRefCountZero: true,
            resetOnComplete: true,
            resetOnError: true,
        } as const;

        const stream = ws.pipe(
            retry({ delay: () => timer(4000) }),
            takeUntil(stop$),
            shareReplay(replayCfg),
        ) as unknown as Observable<MfbPSnapshot>;

        setSnapshot$(stream);

        return () => {
            stop$.next();
            stop$.complete();
            ws.complete();
        };
    }, [url]);

    return { snapshot$ };
}
