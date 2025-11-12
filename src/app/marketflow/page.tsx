"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import MarketflowWidget from "@/components/MarketflowWidget";
import dynamic from "next/dynamic";

import { useWebsocket } from "@/hooks/useWebsocket";

// Lazy-load chart components to reduce initial bundle
const MarketflowNetChart = dynamic(() => import("./MarketflowNetChart"), { ssr: false });
const MarketflowDirectionalDiffChart = dynamic(() => import("./MarketflowDirectionalDiffChart"), { ssr: false });
const MarketflowCandlesChart = dynamic(() => import("./MarketflowCandlesChart"), { ssr: false });

const API_URL = "https://botpilot--8000.ngrok.io/marketflow";

// Types
type XY = [number, number | null];
type CandlestickTuple = [number, number | null, number | null, number | null, number | null];

interface MaObjUnified {
    ticker: string;
    period: string; // e.g. "15min"
    range: { start_ms: number; end_ms: number };
    plot_window: { start_ms: number; end_ms: number };
    net_bucket_ms: number; // e.g. 60000
    candles_period_ms: number; // e.g. 60000
    net_points: number;
    candle_points: number;
    mm_net_data: XY[];
    acc_dis_net_data: XY[];
    spread_data?: XY[];
    directional_diff_data?: XY[];
    directional_bias_ratio_data?: XY[];
    directional_bias_pct_data?: XY[];
    candles: {
        period: string; // '1min'
        ohlc: CandlestickTuple[];
        volume: [number, number][];
        meta: { last_candle_start_ms: number; next_candle_expected_ms?: number; interval_minutes: number };
    };
}

function sortByTime<T extends [number, ...any[]]>(arr: T[]): T[] {
    return [...arr].sort((a, b) => a[0] - b[0]);
}

function lastValue(series?: XY[] | null): number | null {
    if (!series || !series.length) return null;
    const [, v] = series[series.length - 1];
    return v ?? null;
}

export default function MarketflowPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker: headerTicker, period: headerPeriod, setPeriod } = useTickerPeriod();

    useEffect(() => { setConfig({ showTicker: true, showPeriod: true }); }, [setConfig]);

    // Normalize the header period once (keeps current behavior — no global changes)
    useEffect(() => {
        const p = (headerPeriod || "").toLowerCase();
        if (["15min"].includes(p)) setPeriod("15min");
        else if (["1h"].includes(p)) setPeriod("1h");
        else if (["4h"].includes(p)) setPeriod("4h");
        else if (["1d"].includes(p)) setPeriod("1d");
        else if (["1w"].includes(p)) setPeriod("1w");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Manual mode
    const [manualOpen, setManualOpen] = useState(false);
    const [manualTicker, setManualTicker] = useState("");
    const [manualStartMs, setManualStartMs] = useState("");
    const [manualEndMs, setManualEndMs] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ma, setMa] = useState<MaObjUnified | null>(null);

    const netRef = useRef<{ getChart: () => any } | null>(null);
    const diffRef = useRef<{ getChart: () => any } | null>(null);
    const candleRef = useRef<{ getChart: () => any } | null>(null);

    const effectiveTicker = manualOpen && manualTicker.trim() ? manualTicker.trim() : headerTicker;

    // --- Live series + window state (initialized from backend payload) ---
    const [windowStart, setWindowStart] = useState<number | undefined>(undefined);
    const [windowEnd, setWindowEnd] = useState<number | undefined>(undefined);

    const [liveMm, setLiveMm] = useState<XY[]>([]);
    const [liveAd, setLiveAd] = useState<XY[]>([]);
    const [liveDiff, setLiveDiff] = useState<XY[]>([]);
    const [liveSpread, setLiveSpread] = useState<XY[]>([]);
    const [liveBiasRatio, setLiveBiasRatio] = useState<XY[]>([]);
    const [liveBiasPct, setLiveBiasPct] = useState<XY[]>([]);
    const [liveOhlc, setLiveOhlc] = useState<CandlestickTuple[]>([]);

    // Use manual window if provided, else let backend decide
    const queryWindow = useMemo(() => {
        if (manualOpen && manualStartMs && manualEndMs) {
            const s = Number(manualStartMs); const e = Number(manualEndMs);
            if (Number.isFinite(s) && Number.isFinite(e) && e > s) return { start_ms: s, end_ms: e };
        }
        return null as unknown as { start_ms: number; end_ms: number } | null;
    }, [manualOpen, manualStartMs, manualEndMs]);

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const params = new URLSearchParams({ ticker: effectiveTicker });
            if (queryWindow) {
                params.set("start_ms", String(queryWindow.start_ms));
                params.set("end_ms", String(queryWindow.end_ms));
            }
            if (headerPeriod) params.set("period", String(headerPeriod));

            const res = await fetch(`${API_URL}?${params.toString()}`);
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            const json: MaObjUnified = await res.json();
            setMa(json);

            // --- Initialize live state from payload ---
            const mm = sortByTime(json.mm_net_data as XY[]);
            const ad = sortByTime(json.acc_dis_net_data as XY[]);
            const candles = sortByTime((json.candles?.ohlc ?? []) as CandlestickTuple[]);

            setLiveMm(mm);
            setLiveAd(ad);
            setLiveOhlc(candles);

            const initDiff = json.directional_diff_data ? sortByTime(json.directional_diff_data as XY[]) : [];
            const initSpread = json.spread_data ? sortByTime(json.spread_data as XY[]) : [];
            const initBiasRatio = json.directional_bias_ratio_data ? sortByTime(json.directional_bias_ratio_data as XY[]) : [];
            const initBiasPct = json.directional_bias_pct_data ? sortByTime(json.directional_bias_pct_data as XY[]) : [];

            // Derive if server didn't provide
            const derivedDiffInit: XY[] = mm.map((a, i) => {
                const b = ad[i]; if (!b) return [a[0], null];
                const v = a[1] == null || b[1] == null ? null : Number(a[1]) + Number(b[1]);
                return [a[0], v];
            });
            const derivedSpreadInit: XY[] = mm.map((a, i) => {
                const b = ad[i]; if (!b) return [a[0], null];
                const v = a[1] == null || b[1] == null ? null : Math.abs(Number(a[1])) + Math.abs(Number(b[1]));
                return [a[0], v];
            });
            const derivedBiasRatioInit: XY[] = mm.map((a, i) => {
                const b = ad[i]; if (!b) return [a[0], null];
                const va = a[1], vb = b[1]; if (va == null || vb == null) return [a[0], null];
                const denom = Math.abs(Number(vb)) || 1e-9;
                return [a[0], Math.abs(Number(va)) / denom];
            });
            const derivedBiasPctInit: XY[] = mm.map((a, i) => {
                const b = ad[i]; if (!b) return [a[0], null];
                const va = a[1], vb = b[1]; if (va == null || vb == null) return [a[0], null];
                const mmAbs = Math.abs(Number(va)), adAbs = Math.abs(Number(vb));
                const denom = (mmAbs + adAbs) || 1e-9;
                return [a[0], ((mmAbs - adAbs) / denom) * 100];
            });

            setLiveDiff(initDiff.length ? initDiff : derivedDiffInit);
            setLiveSpread(initSpread.length ? initSpread : derivedSpreadInit);
            setLiveBiasRatio(initBiasRatio.length ? initBiasRatio : derivedBiasRatioInit);
            setLiveBiasPct(initBiasPct.length ? initBiasPct : derivedBiasPctInit);

            setWindowStart(json.plot_window?.start_ms ?? json.range.start_ms);
            setWindowEnd(json.plot_window?.end_ms ?? json.range.end_ms);
        } catch (err: any) {
            setError(err?.message ?? "Unknown error");
            setMa(null);
            setLiveMm([]); setLiveAd([]); setLiveOhlc([]);
            setLiveDiff([]); setLiveSpread([]); setLiveBiasRatio([]); setLiveBiasPct([]);
        } finally { setLoading(false); }
    }, [effectiveTicker, headerPeriod, queryWindow]);

    useEffect(() => {
        if (!manualOpen) { fetchData(); return; }
        const s = Number(manualStartMs); const e = Number(manualEndMs);
        if (Number.isFinite(s) && Number.isFinite(e) && e > s && manualTicker.trim()) fetchData();
    }, [fetchData, manualOpen, manualStartMs, manualEndMs, manualTicker]);

    // Derived series for charts (always sorted)
    const mmNet = useMemo(() => sortByTime(liveMm), [liveMm]);
    const adNet = useMemo(() => sortByTime(liveAd), [liveAd]);

    // Always keep derived fallbacks in sync from current live mm/ad
    const derivedDiff = useMemo<XY[]>(() => {
        const len = Math.max(liveMm.length, liveAd.length);
        const out: XY[] = [];
        for (let i = 0; i < len; i++) {
            const a = liveMm[i], b = liveAd[i];
            if (!a || !b) continue;
            const v = a[1] == null || b[1] == null ? null : Number(a[1]) + Number(b[1]);
            out.push([a[0], v]);
        }
        return out;
    }, [liveMm, liveAd]);

    const derivedSpread = useMemo<XY[]>(() => {
        const len = Math.max(liveMm.length, liveAd.length);
        const out: XY[] = [];
        for (let i = 0; i < len; i++) {
            const a = liveMm[i], b = liveAd[i];
            if (!a || !b) continue;
            const v = a[1] == null || b[1] == null ? null : Math.abs(Number(a[1])) + Math.abs(Number(b[1]));
            out.push([a[0], v]);
        }
        return out;
    }, [liveMm, liveAd]);

    // Use live server-fed series if present, else derived
    const diffSeries = useMemo(() => (liveDiff.length ? sortByTime(liveDiff) : derivedDiff), [liveDiff, derivedDiff]);
    const spreadSeries = useMemo(() => (liveSpread.length ? sortByTime(liveSpread) : derivedSpread), [liveSpread, derivedSpread]);

    // Bias series for cards
    const biasRatioSeries = useMemo(() => (liveBiasRatio.length ? sortByTime(liveBiasRatio) : []), [liveBiasRatio]);
    const biasPctSeries = useMemo(() => (liveBiasPct.length ? sortByTime(liveBiasPct) : []), [liveBiasPct]);

    // Initial and subsequent x-axis alignment when window changes
    useEffect(() => {
        if (windowStart == null || windowEnd == null) return;
        const net = netRef.current?.getChart?.();
        const dif = diffRef.current?.getChart?.();
        const cd = candleRef.current?.getChart?.();
        if (net?.xAxis?.[0]) net.xAxis[0].setExtremes(windowStart, windowEnd, true, false, { trigger: "sync" });
        if (dif?.xAxis?.[0]) dif.xAxis[0].setExtremes(windowStart, windowEnd, true, false, { trigger: "sync" });
        if (cd?.xAxis?.[0]) cd.xAxis[0].setExtremes(windowStart, windowEnd, true, false, { trigger: "sync" });
    }, [windowStart, windowEnd]);

    // Crosshair/tooltip sync (mouse move binding)
    useEffect(() => {
        const net = netRef.current?.getChart?.();
        const dif = diffRef.current?.getChart?.();
        const cd = candleRef.current?.getChart?.();
        if (!net || !dif || !cd) return;

        const bind = (from: any, toList: any[]) => {
            const el: HTMLElement | null = (from as any).renderTo ?? (from.container as HTMLElement | null) ?? null;
            if (!el) return () => {};
            const onMove = (e: MouseEvent) => {
                toList.forEach((to) => {
                    const evt = to.pointer?.normalize(e);
                    (to.pointer as any)?.onContainerMouseMove(evt);
                });
            };
            const onLeave = () => {
                toList.forEach((to) => { to.tooltip?.hide(0); to.xAxis?.[0]?.hideCrosshair(); });
            };
            el.addEventListener("mousemove", onMove); el.addEventListener("mouseleave", onLeave);
            return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
        };

        const un1 = bind(net, [dif, cd]);
        const un2 = bind(dif, [net, cd]);
        const un3 = bind(cd, [net, dif]);
        return () => { un1 && un1(); un2 && un2(); un3 && un3(); };
    }, [netRef.current, diffRef.current, candleRef.current]);

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

    // --- Live minute updates via websocket ---
    const { marketflow$ } = require("@/hooks/useWebsocket").useWebsocket();

    useEffect(() => {
        if (!ma || !marketflow$) return;
        const NET_BUCKET = ma.net_bucket_ms || 60_000;
        const TARGET_POINTS = ma.net_points || Math.max(liveMm.length, 1);

        const padAllUntil = (fromTs: number, toTs: number) => {
            if (!Number.isFinite(fromTs)) return;
            let cursor = fromTs + NET_BUCKET;

            const pad = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, mk: (ts: number) => T) => {
                const tmp: T[] = [];
                let t = cursor;
                while (t < toTs) { tmp.push(mk(t)); t += NET_BUCKET; }
                if (tmp.length) setter(prev => [...prev, ...tmp]);
            };

            pad(setLiveMm,     (t) => [t, null] as any);
            pad(setLiveAd,     (t) => [t, null] as any);
            pad(setLiveDiff,   (t) => [t, null] as any);
            pad(setLiveSpread, (t) => [t, null] as any);
            pad(setLiveBiasRatio, (t) => [t, null] as any);
            pad(setLiveBiasPct,   (t) => [t, null] as any);
            pad(setLiveOhlc,   (t) => [t, null, null, null, null] as any);
        };

        const updateSeries = <T extends XY>(
            setSeries: React.Dispatch<React.SetStateAction<T[]>>,
            ts: number,
            value: number | null,
            targetPoints = TARGET_POINTS
        ) => {
            setSeries(prev => {
                const out = prev.slice();
                const last = out[out.length - 1] as any;
                const lastTs = last ? last[0] : undefined as number | undefined;
                if (lastTs == null) return [[ts, value] as any];
                if (ts < lastTs) {
                    const idx = (out as any[]).findIndex(p => (p as any)[0] === ts);
                    if (idx >= 0) (out as any)[idx] = [ts, value];
                    return out;
                }
                if (ts > lastTs) padAllUntil(lastTs, ts);
                if (ts === lastTs) (out as any)[out.length - 1] = [ts, value];
                else out.push([ts, value] as any);
                while (out.length > targetPoints) out.shift();
                return out;
            });
        };

        const sub = marketflow$.subscribe((msg: any) => {
            try {
                if (!msg || msg.type !== "minute_update") return;
                if (msg.ticker && ma.ticker && msg.ticker !== ma.ticker) return;
                console.log('[MF] ws ticker: ', msg.ticker, '& ma.ticker: ', ma.ticker);
                const ts: number = Number(msg.ts_ms);
                if (!Number.isFinite(ts)) return;

                const mmVal = Number(msg.nets?.mm_net_value ?? null) as any;
                const adVal = Number(msg.nets?.acc_dis_net_value ?? null) as any;

                // NEW: server-fed metrics carried in the minute update
                const diffVal = Number(msg.nets?.directional_diff ?? null) as any;
                const spreadVal = Number(msg.nets?.spread ?? null) as any;
                const biasRatioVal = Number(msg.nets?.directional_bias_ratio ?? null) as any;
                const biasPctVal = Number(msg.nets?.directional_bias_pct ?? null) as any;

                // MM / AD
                updateSeries(setLiveMm, ts, mmVal);
                updateSeries(setLiveAd, ts, adVal);

                // Metrics
                updateSeries(setLiveDiff, ts, diffVal);
                updateSeries(setLiveSpread, ts, spreadVal);
                if (!Number.isNaN(biasRatioVal)) updateSeries(setLiveBiasRatio, ts, biasRatioVal);
                if (!Number.isNaN(biasPctVal))   updateSeries(setLiveBiasPct, ts, biasPctVal);

                // Candles
                setLiveOhlc(prev => {
                    const out = prev.slice();
                    const last = out[out.length - 1];
                    const lastTs = last ? last[0] : undefined as number | undefined;
                    const o = Number(msg.candle?.o ?? null) as any;
                    const h = Number(msg.candle?.h ?? null) as any;
                    const l = Number(msg.candle?.l ?? null) as any;
                    const c = Number(msg.candle?.c ?? null) as any;
                    if (lastTs == null) return [[ts, o, h, l, c]];
                    if (ts < lastTs) {
                        const idx = out.findIndex(p => p[0] === ts);
                        if (idx >= 0) out[idx] = [ts, o, h, l, c];
                        return out;
                    }
                    if (ts > lastTs) padAllUntil(lastTs, ts);
                    if (ts === lastTs) out[out.length - 1] = [ts, o, h, l, c];
                    else out.push([ts, o, h, l, c]);
                    while (out.length > TARGET_POINTS) out.shift();
                    return out;
                });

                // Slide window when new point exceeds current windowEnd
                setWindowEnd(prevEnd => {
                    if (prevEnd == null) return prevEnd;
                    if (ts <= prevEnd) return prevEnd;
                    const steps = Math.ceil((ts - prevEnd) / NET_BUCKET);
                    const newEnd = prevEnd + steps * NET_BUCKET;
                    const spanPoints = TARGET_POINTS - 1;
                    const newStart = (windowStart ?? (prevEnd - spanPoints * NET_BUCKET)) + steps * NET_BUCKET;
                    setWindowStart(newStart);
                    return newEnd;
                });
            } catch (e) {
                console.error("[minute_update] handler error", e);
            }
        });
        return () => sub.unsubscribe();
    }, [ma, marketflow$, windowStart, liveMm.length]);

    // --- Card values (prefer live series) ---
    const lastMm = lastValue(mmNet);
    const lastAd = lastValue(adNet);
    const lastSpread = lastValue(spreadSeries);
    const lastDiff = lastValue(diffSeries);
    const lastBiasRatio = lastValue(biasRatioSeries);
    const lastBiasPct = lastValue(biasPctSeries);

    const fmtNum = (v: number | null, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }) =>
        v == null || !Number.isFinite(v) ? "—" : new Intl.NumberFormat("en-US", opts).format(v);


    return (
        <main className="flex flex-col gap-4 p-2 md:p-4 lg:p-6">
            <section className="flex flex-col gap-2">
                <h1 className="text-xl md:text-2xl font-semibold">Marketflow</h1>
                <p className="text-sm opacity-80">Compare NET values between Market Makers and Accumulators/Distributors over time.</p>
            </section>

            {/* Manual mode */}
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-3 md:p-4 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <label className="font-medium">Manual mode (UTC ms)</label>
                        <input type="checkbox" checked={manualOpen} onChange={() => setManualOpen((v) => !v)} />
                    </div>
                    {/*<div className="text-xs opacity-70">Endpoint: <code>{API_URL}</code></div>*/}
                </div>

                {manualOpen && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="flex flex-col">
                            <label className="text-xs mb-1">Ticker</label>
                            <input className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2" placeholder="BTC-USD" value={manualTicker} onChange={(e) => setManualTicker(e.target.value)} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs mb-1">Start (ms, UTC)</label>
                            <input className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2" placeholder="e.g. 1757134800000" value={manualStartMs} onChange={(e) => setManualStartMs(e.target.value)} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs mb-1">End (ms, UTC)</label>
                            <input className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2" placeholder="e.g. 1757480400000" value={manualEndMs} onChange={(e) => setManualEndMs(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                            <button className="w-full rounded-xl bg-primary dark:bg-primary-dark text-black dark:text-white px-4 py-2" onClick={() => { fetchData(); }}>
                                Fetch
                            </button>
                        </div>
                    </div>
                )}
            </section>
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-2 md:p-3 bg-white dark:bg-gray-900">

                <MarketflowWidget
                    marketflow$={marketflow$}
                    httpBase="https://botpilot--8000.ngrok.io"
                    ticker={headerTicker}
                    period="1h"
                    seedMinutes={60}
                    onAlert={(alerts, payload) => console.log("ALERT", alerts, payload)}
                />
            </section>

            {/* Chart 1: Net */}
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-2 md:p-3 bg-white dark:bg-gray-900">
                {loading && <LoadingIndicator message="Loading net values…" />}
                {!loading && error && <div className="text-red-600 dark:text-red-400 p-3">Error: {error}</div>}
                {!loading && !error && ma && (
                    <MarketflowNetChart
                        ref={netRef as any}
                        mmNet={mmNet as any}
                        adNet={adNet as any}
                        isDark={isDark}
                        onSetExtremes={(min, max) => {
                            const dif = diffRef.current?.getChart?.();
                            const cd = candleRef.current?.getChart?.();
                            const a1 = dif?.xAxis?.[0]; if (a1 && (a1.min !== min || a1.max !== max)) a1.setExtremes(min, max, true, false, { trigger: "sync" });
                            const a2 = cd?.xAxis?.[0];  if (a2 && (a2.min !== min || a2.max !== max)) a2.setExtremes(min, max, true, false, { trigger: "sync" });
                        }}
                    />
                )}
                {!loading && !error && !ma && <div className="p-3 text-sm opacity-80">No data available for the selected range.</div>}
            </section>

            {/* Chart 2: Directional Difference */}
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-2 md:p-3 bg-white dark:bg-gray-900">
                {loading && <LoadingIndicator message="Loading directional difference…" />}
                {!loading && !error && ma && (
                    <MarketflowDirectionalDiffChart
                        ref={diffRef as any}
                        diff={diffSeries as any}
                        isDark={isDark}
                        onSetExtremes={(min, max) => {
                            const net = netRef.current?.getChart?.();
                            const cd = candleRef.current?.getChart?.();
                            const a1 = net?.xAxis?.[0]; if (a1 && (a1.min !== min || a1.max !== max)) a1.setExtremes(min, max, true, false, { trigger: "sync" });
                            const a2 = cd?.xAxis?.[0];  if (a2 && (a2.min !== min || a2.max !== max)) a2.setExtremes(min, max, true, false, { trigger: "sync" });
                        }}
                    />
                )}
                {!loading && !error && !ma && <div className="p-3 text-sm opacity-80">No directional difference data.</div>}
            </section>

            {/* Chart 3: Candles */}
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-2 md:p-3 bg-white dark:bg-gray-900">
                {loading && <LoadingIndicator message="Loading candles…" />}
                {!loading && !error && ma?.candles && (
                    <MarketflowCandlesChart
                        ref={candleRef as any}
                        ohlc={sortByTime(liveOhlc) as any}
                        isDark={isDark}
                        onSetExtremes={(min, max) => {
                            const net = netRef.current?.getChart?.();
                            const dif = diffRef.current?.getChart?.();
                            const a1 = net?.xAxis?.[0]; if (a1 && (a1.min !== min || a1.max !== max)) a1.setExtremes(min, max, true, false, { trigger: "sync" });
                            const a2 = dif?.xAxis?.[0]; if (a2 && (a2.min !== min || a2.max !== max)) a2.setExtremes(min, max, true, false, { trigger: "sync" });
                        }}
                    />
                )}
                {!loading && !error && !ma?.candles && <div className="p-3 text-sm opacity-80">No candle data.</div>}
            </section>

            {ma && (
                <section className="text-xs opacity-70">
                    <div>
                        {/*Loaded: {ma.ticker} · period: {ma.period} · window: {windowStart} → {windowEnd} (UTC ms) · target points: {ma.net_points}*/}
                    </div>
                </section>
            )}
        </main>
    );
}