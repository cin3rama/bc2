// src/hooks/useMarketflowRuntime.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Observable, Subscription } from "rxjs";
import { adaptSnapshot, buildSnapshotURL, fetchSnapshot } from "@/lib/marketflow/snapshot";
import { adaptTick, LiveMinute } from "@/lib/marketflow/tick";
import type { Regime, Tick as WorkerTick } from "@/utils/marketflow.worker";
import { nowUtcMs } from "@/lib/marketflow/constants";

export function useMarketflowRuntime(params?: {
    httpBase?: string;
    marketflow$?: Observable<LiveMinute>;
    ticker?: string;
    period?: "15min" | "1h" | "4h" | "1d";
    seedMinutes?: number;
    onAlert?: (alerts: string[], payload: any) => void;
}) {
    const {
        httpBase = "https://botpilot--8000.ngrok.io",
        marketflow$,
        ticker = "SOL-USD",
        period = "1h",
        seedMinutes = 60,
        onAlert,
    } = params ?? {};

    const [state, setState] = useState<Regime>("Balance");
    const [baseSpread, setBaseSpread] = useState<number>(0);
    const [lastTick, setLastTick] = useState<WorkerTick | null>(null);
    const [alerts, setAlerts] = useState<string[]>([]);

    const workerRef = useRef<Worker | null>(null);

    const snapshotURL = useMemo(() => {
        const end = nowUtcMs();
        const start = end - seedMinutes * 60_000;
        return buildSnapshotURL(httpBase, ticker, period, start, end);
    }, [httpBase, ticker, period, seedMinutes]);

    // 1) Worker lifecycle (mount → unmount)
    useEffect(() => {
        const worker = new Worker(
            new URL("../utils/marketflow.worker.ts", import.meta.url),
            { type: "module" }
        );
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent<any>) => {
            const msg = e.data;
            if (msg?.type === "state") {
                setState(msg.state);
                setBaseSpread(msg.baseSpread);
                setLastTick(msg.tick);
            } else if (msg?.type === "alerts") {
                setAlerts(prev => [...prev.slice(-20), ...msg.alerts]);
                onAlert?.(msg.alerts, msg);
            }
        };

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
        // onAlert is stable enough, or wrap in useCallback if needed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) Seed snapshot whenever URL changes (and worker exists)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!workerRef.current) return;
            try {
                const obj = await fetchSnapshot(snapshotURL);
                const ticks = adaptSnapshot(obj);
                if (cancelled) return;
                for (const t of ticks) workerRef.current?.postMessage(t);
            } catch (err) {
                console.error("[MF] snapshot seed failed:", err);
            }
        })();
        return () => { cancelled = true; };
    }, [snapshotURL]);

    // 3) Subscribe to RxJS stream (single subscription)
    useEffect(() => {
        if (!marketflow$) return;
        let sub: Subscription | undefined;
        let lastTs = -1;
        //@ts-ignore
        sub = marketflow$.subscribe((raw) => {

            try {
                if (raw?.type !== "minute_update") return;
                if (raw.ts_ms === lastTs) return;     // de-dupe same-minute repeats
                lastTs = raw.ts_ms;

                const t = adaptTick(raw);
                // DEBUG (keep briefly):
                // console.debug("[MF] minute_update mapped", t);
                workerRef.current?.postMessage(t);
            } catch (e) {
                console.error("[MF] minute_update parse/map error:", e, raw);
            }
        });

        return () => sub?.unsubscribe();
    }, [marketflow$]);

    // DEBUG: you can keep this while testing
    // console.log("MF Runtime lastTick", lastTick?.ts, lastTick?.dd, lastTick?.spread);

    return { state, baseSpread, lastTick, alerts };
}
