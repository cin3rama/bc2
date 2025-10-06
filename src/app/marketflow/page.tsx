"use client";


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import dynamic from "next/dynamic";


// Lazy-load chart components to reduce initial bundle
const MarketflowNetChart = dynamic(() => import("./MarketflowNetChart"), { ssr: false });
const MarketflowCandlesChart = dynamic(() => import("./MarketflowCandlesChart"), { ssr: false });


const API_URL = "https://botpilot--8000.ngrok.io/marketflow";


// Types
type PeriodLabel = "15min" | "15 min" | "15 Min" | "1 hour" | "4 hours" | "1 day" | "1 week";
type XY = [number, number];
type CandlestickTuple = [number, number | null, number | null, number | null, number | null];


interface MaObjUnified {
    ticker: string;
    period: string; // e.g. "1h" (source period of nets)
    range: { start_ms: number; end_ms: number }; // full data span returned
    plot_window: { start_ms: number; end_ms: number }; // window both charts should use
    net_bucket_ms: number; // 60000
    candles_period_ms: number; // 3600000 for 1h
    net_points: number; // expected length of net series in window
    candle_points: number; // expected number of candles
    mm_net_data: XY[];
    acc_dis_net_data: XY[];
    candles: {
        period: string; // '1h'
        ohlc: CandlestickTuple[]; // hourly candles
        volume: [number, number][]; // [ts, vol]
        meta: { last_candle_start_ms: number; next_candle_expected_ms: number; interval_minutes: number };
    };
}


function sortByTime<T extends [number, ...any[]]>(arr: T[]): T[] {
    return [...arr].sort((a, b) => a[0] - b[0]);
}


export default function MarketflowPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker: headerTicker, period: headerPeriod, setPeriod } = useTickerPeriod();

    useEffect(() => { setConfig({ showTicker: true, showPeriod: true }); }, [setConfig]);


// Normalize the header period once (keeps current behavior — no global changes)
    useEffect(() => {
        const p = (headerPeriod || "").toLowerCase();
        if (["15min", "15min"].includes(p)) setPeriod("15min");
        else if (["1h", "1h"].includes(p)) setPeriod("1h");
        else if (["4h", "4h"].includes(p)) setPeriod("4h");
        else if (["1d", "1d"].includes(p)) setPeriod("1d");
        else if (["1w", "1w"].includes(p)) setPeriod("1w");
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
    const candleRef = useRef<{ getChart: () => any } | null>(null);


    const effectiveTicker = manualOpen && manualTicker.trim() ? manualTicker.trim() : headerTicker;


// Use manual window if provided, else derive from header period (only for the API query)
    const queryWindow = useMemo(() => {
        if (manualOpen && manualStartMs && manualEndMs) {
            const s = Number(manualStartMs); const e = Number(manualEndMs);
            if (Number.isFinite(s) && Number.isFinite(e) && e > s) return { start_ms: s, end_ms: e };
        }
// Let backend decide based on current header period; we do not compute here anymore
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
// Optionally include period hint so backend can choose cadence
            if (headerPeriod) params.set("period", String(headerPeriod));


            const res = await fetch(`${API_URL}?${params.toString()}`);

            console.log(res);
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            const json: MaObjUnified = await res.json();
            setMa(json);
        } catch (err: any) {
            setError(err?.message ?? "Unknown error");
            setMa(null);
        } finally { setLoading(false); }
    }, [effectiveTicker, headerPeriod, queryWindow]);

    useEffect(() => {
        if (!manualOpen) { fetchData(); return; }
        const s = Number(manualStartMs); const e = Number(manualEndMs);
        if (Number.isFinite(s) && Number.isFinite(e) && e > s && manualTicker.trim()) fetchData();
    }, [fetchData, manualOpen, manualStartMs, manualEndMs, manualTicker]);


// Derived, sorted series + unified window for axes
    const { mmNet, adNet, ohlc, windowStart, windowEnd } = useMemo(() => {
        if (!ma) return { mmNet: [], adNet: [], ohlc: [], windowStart: undefined as number | undefined, windowEnd: undefined as number | undefined };
        const mm = sortByTime(ma.mm_net_data as XY[]);
        const ad = sortByTime(ma.acc_dis_net_data as XY[]);
        const candles = sortByTime((ma.candles?.ohlc ?? []) as CandlestickTuple[]);
        const ws = ma.plot_window?.start_ms ?? ma.range.start_ms;
        const we = ma.plot_window?.end_ms ?? ma.range.end_ms;
// Optionally clamp candle domain if needed; typically not necessary now.
        return { mmNet: mm, adNet: ad, ohlc: candles, windowStart: ws, windowEnd: we };
    }, [ma]);


// Initial x‑axis alignment when both charts mount/update
    useEffect(() => {
        if (!windowStart || !windowEnd) return;
        const net = netRef.current?.getChart?.();
        const cd = candleRef.current?.getChart?.();
        if (net?.xAxis?.[0] && cd?.xAxis?.[0]) {
            net.xAxis[0].setExtremes(windowStart, windowEnd, true, false, { trigger: "sync" });
            cd.xAxis[0].setExtremes(windowStart, windowEnd, true, false, { trigger: "sync" });
        }
    }, [windowStart, windowEnd]);


// Crosshair/tooltip sync (mouse move binding)
    useEffect(() => {
        const net = netRef.current?.getChart?.();
        const cd = candleRef.current?.getChart?.();
        if (!net || !cd) return;


        const bind = (from: any, to: any) => {
            const el: HTMLElement | null = (from as any).renderTo ?? (from.container as HTMLElement | null) ?? null;
            if (!el) return () => {};
            const onMove = (e: MouseEvent) => { const evt = to.pointer?.normalize(e); (to.pointer as any)?.onContainerMouseMove(evt); };
            const onLeave = () => { to.tooltip?.hide(0); to.xAxis?.[0]?.hideCrosshair(); };
            el.addEventListener("mousemove", onMove); el.addEventListener("mouseleave", onLeave);
            return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
        };


        const un1 = bind(net, cd);
        const un2 = bind(cd, net);
        return () => { un1 && un1(); un2 && un2(); };
    }, [netRef.current, candleRef.current]);


    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

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
                    <div className="text-xs opacity-70">Endpoint: <code>{API_URL}</code></div>
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
                            const other = candleRef.current?.getChart?.();
                            const a = other?.xAxis?.[0];
                            if (a && (a.min !== min || a.max !== max)) a.setExtremes(min, max, true, false, { trigger: "sync" });
                        }}
                    />
                )}
                {!loading && !error && !ma && <div className="p-3 text-sm opacity-80">No data available for the selected range.</div>}
            </section>


            {/* Chart 2: Candles */}
            <section className="rounded-2xl border border-gray-300 dark:border-gray-700 p-2 md:p-3 bg-white dark:bg-gray-900">
                {loading && <LoadingIndicator message="Loading candles…" />}
                {!loading && !error && ma?.candles && (
                    <MarketflowCandlesChart
                        ref={candleRef as any}
                        ohlc={ohlc as any}
                        isDark={isDark}
                        onSetExtremes={(min, max) => {
                            const other = netRef.current?.getChart?.();
                            const a = other?.xAxis?.[0];
                            if (a && (a.min !== min || a.max !== max)) a.setExtremes(min, max, true, false, { trigger: "sync" });
                        }}
                    />
                )}
                {!loading && !error && !ma?.candles && <div className="p-3 text-sm opacity-80">No candle data.</div>}
            </section>


            {ma && (
                <section className="text-xs opacity-70">
                    <div>
                        Loaded: {ma.ticker} · period: {ma.period} · window: {ma.plot_window.start_ms} → {ma.plot_window.end_ms} (UTC ms) · nets/min: {Math.round((ma.plot_window.end_ms - ma.plot_window.start_ms) / ma.net_bucket_ms) + 1}
                    </div>
                </section>
            )}
        </main>
    );
}
