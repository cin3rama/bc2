'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import LoadingIndicator from '@/components/LoadingIndicator';

type Period = '5min' | '15min' | '30min' | '1h' | '4h' | '1d';
type Ticker = 'BTC-USD' | 'ETH-USD' | 'SOL-USD';
type Indicator =
    | 'ts_mom'
    | 'rsi'
    | 'rsi50'
    | 'ts_ema'
    | 'ema_cross' // <-- UI option that maps to indicator=ema&fast=&slow=
    | 'sma_cross'
    | 'donchian_break';

type Backtest = {
    CAGR: number;
    Sharpe: number;
    MaxDrawdown: number;   // e.g. -0.036 -> -3.6%
    TotalReturn: number;   // e.g. 0.12 -> 12%
    sig_col: string;
    costs_bps: number;
    slippage_bps: number;
};

type TrendFollowResponse = {
    ticker: Ticker;
    period: Period;
    indicator: string; // backend may echo 'ema&fast=8&slow=21' etc.
    ohlc: [number, number, number, number, number?][];
    buys: [number, number, string][];
    sells: [number, number, string][];
    // optional extras (present for certain indicators)
    ema?: [number, number][];      // non-configurable EMA for ts_mom
    backtest?: Backtest;           // backtest summary
};

const periods: Period[] = ['5min', '15min', '30min', '1h', '4h', '1d'];
const tickers: Ticker[] = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
const indicators: Indicator[] = [
    'ts_mom',
    'rsi',
    'rsi50',
    'ts_ema',
    'ema_cross',
    'sma_cross',
    'donchian_break'
];

const ENDPOINT = 'https://botpilot--9000.ngrok.io/trend-follow';

// helpers
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const toIntOr = (v: string, fallback: number) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

// formatting helpers for cards
const fmt2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
const fmt4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : '—');
const fmtPct2 = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—');

export default function TrendFollowPage() {
    const [ticker, setTicker] = useState<Ticker>('SOL-USD');
    const [period, setPeriod] = useState<Period>('15min');
    const [indicator, setIndicator] = useState<Indicator>('ema_cross');

    // EMA param state (only used when indicator === 'ema_cross')
    const [emaFast, setEmaFast] = useState<number>(8);
    const [emaSlow, setEmaSlow] = useState<number>(21);

    const [data, setData] = useState<TrendFollowResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);

    const chartRef = useRef<HighchartsReact.RefObject>(null);

    const buildUrl = useCallback(() => {
        const url = new URL(ENDPOINT);
        url.searchParams.set('ticker', ticker);
        url.searchParams.set('period', period);

        if (indicator === 'ema_cross') {
            const f = clamp(emaFast | 0, 1, 90);
            const s = clamp(emaSlow | 0, 1, 90);
            url.searchParams.set('indicator', 'ema_cross');
            url.searchParams.set('fast', String(f));
            url.searchParams.set('slow', String(s));
        } else {
            url.searchParams.set('indicator', indicator);
        }

        return url.toString();
    }, [ticker, period, indicator, emaFast, emaSlow]);

    const fetchData = useCallback(
        async (signal?: AbortSignal) => {
            setLoading(true);
            setErr(null);
            setData(null);
            try {
                const res = await fetch(buildUrl(), {
                    method: 'GET',
                    signal,
                    headers: { Accept: 'application/json' }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                const json = (await res.json()) as TrendFollowResponse;
                setData(json);
            } catch (e: any) {
                if (e?.name !== 'AbortError') setErr(e?.message ?? 'Failed to load data');
            } finally {
                setLoading(false);
            }
        },
        [buildUrl]
    );

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);

    // Derived indicator label for the title
    const indicatorLabel = useMemo(() => {
        if (indicator === 'ema_cross') {
            const f = clamp(emaFast | 0, 1, 90);
            const s = clamp(emaSlow | 0, 1, 90);
            return `ema(${f},${s})`;
        }
        return indicator;
    }, [indicator, emaFast, emaSlow]);

    // Transform backend data into Highcharts series
    const series = useMemo<Highcharts.SeriesOptionsType[]>(() => {
        if (!data) return [];

        const candleId = `${data.ticker}:${data.period}:candles`;

        const ohlc: Highcharts.SeriesCandlestickOptions = {
            type: 'candlestick',
            id: candleId,
            name: `${data.ticker} ${data.period}`,
            data: data.ohlc.map((d) => {
                const [x, o, h, l, c] = d;
                return [x, o, h, l, c];
            }) as any,
            tooltip: { valueDecimals: 2 }
        };

        const buyFlags: Highcharts.SeriesFlagsOptions = {
            type: 'flags',
            name: 'Buy',
            onSeries: candleId,
            shape: 'flag',
            color: '#16a34a',
            fillColor: 'rgba(22,163,74,0.15)',
            y: 0,
            data: data.buys.map(([x, price, text]) => ({
                x,
                y: price,
                title: 'B',
                text
            })),
            tooltip: { pointFormat: '<b>Buy</b><br/>{point.text}<br/>@ {point.y:.2f}' }
        };

        const sellFlags: Highcharts.SeriesFlagsOptions = {
            type: 'flags',
            name: 'Sell',
            onSeries: candleId,
            shape: 'flag',
            color: '#dc2626',
            fillColor: 'rgba(220,38,38,0.15)',
            y: 0,
            data: data.sells.map(([x, price, text]) => ({
                x,
                y: price,
                title: 'S',
                text
            })),
            tooltip: { pointFormat: '<b>Sell</b><br/>{point.text}<br/>@ {point.y:.2f}' }
        };

        const out: Highcharts.SeriesOptionsType[] = [ohlc, buyFlags, sellFlags];

        // Non-configurable EMA line for ts_mom when provided
        if (data.indicator?.toLowerCase().includes('ts_mom') && Array.isArray(data.ema) && data.ema.length) {
            const emaLine: Highcharts.SeriesLineOptions = {
                type: 'line',
                name: 'EMA',
                data: data.ema as any, // [timestamp, value]
                color: '#ffd700',
                lineWidth: 1.5,
                tooltip: { valueDecimals: 2 },
                zIndex: 3
            };
            out.push(emaLine);
        }

        return out;
    }, [data]);

    const options = useMemo<Highcharts.Options>(() => {
        return {
            chart: {
                backgroundColor: 'transparent',
                height: '70%'
            },
            title: {
                text: data ? `${data.ticker} – ${data.period} (${indicatorLabel})` : 'Trend Follow'
            },
            rangeSelector: {
                selected: 4,
                inputEnabled: true
            },
            legend: {
                enabled: true
            },
            xAxis: { type: 'datetime' },
            yAxis: [{ title: { text: 'Price' }, opposite: false }],
            tooltip: { split: true },
            navigator: { enabled: true },
            scrollbar: { enabled: true },
            plotOptions: {
                candlestick: {
                    color: '#dc2626',
                    upColor: '#16a34a',
                    lineColor: '#991b1b',
                    upLineColor: '#166534'
                },
                series: { turboThreshold: 0 }
            },
            series
        };
    }, [series, data, indicatorLabel]);

    // UI: whether to show EMA inputs
    const showEmaInputs = indicator === 'ema_cross';

    // Simple visual validation: ensure values are in [1,90]
    const fastOk = emaFast >= 1 && emaFast <= 90;
    const slowOk = emaSlow >= 1 && emaSlow <= 90;

    // Build backtest cards
    const cards = useMemo(() => {
        const bt = data?.backtest;
        if (!bt) return [];
        return [
            { label: 'CAGR', value: fmt2(bt.CAGR) },
            { label: 'Sharpe Ratio', value: fmt2(bt.Sharpe) },
            { label: 'MaxDrawdown', value: fmtPct2(bt.MaxDrawdown) },
            { label: 'TotalReturn', value: fmtPct2(bt.TotalReturn) },
            { label: 'sig_col', value: bt.sig_col || '—' },
            { label: 'costs_bps', value: fmt4(bt.costs_bps) },
            { label: 'slippage_bps', value: fmt4(bt.slippage_bps) }
        ];
    }, [data?.backtest]);

    return (
        <main className="flex min-h-screen flex-col">
            {/* Controls */}
            <section className="w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur supports-[backdrop-filter]:bg-white/40 supports-[backdrop-filter]:dark:bg-neutral-950/40">
                <div className="mx-auto max-w-7xl px-4 py-4 flex flex-wrap items-center gap-3">
                    {/* Ticker */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="ticker" className="text-sm text-neutral-700 dark:text-neutral-200">
                            Ticker
                        </label>
                        <div className="relative inline-block">
                            <select
                                id="ticker"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value as Ticker)}
                                className="appearance-none border rounded-md px-3 py-2
                           bg-white text-neutral-900
                           dark:bg-neutral-900 dark:text-neutral-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {tickers.map((t) => (
                                    <option
                                        key={t}
                                        value={t}
                                        className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                                    >
                                        {t}
                                    </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 dark:text-neutral-300">
                ▾
              </span>
                        </div>
                    </div>

                    {/* Period */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="period" className="text-sm text-neutral-700 dark:text-neutral-200">
                            Period
                        </label>
                        <div className="relative inline-block">
                            <select
                                id="period"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value as Period)}
                                className="appearance-none border rounded-md px-3 py-2
                           bg-white text-neutral-900
                           dark:bg-neutral-900 dark:text-neutral-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {periods.map((p) => (
                                    <option
                                        key={p}
                                        value={p}
                                        className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                                    >
                                        {p}
                                    </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 dark:text-neutral-300">
                ▾
              </span>
                        </div>
                    </div>

                    {/* Indicator */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="indicator" className="text-sm text-neutral-700 dark:text-neutral-200">
                            Indicator
                        </label>
                        <div className="relative inline-block">
                            <select
                                id="indicator"
                                value={indicator}
                                onChange={(e) => setIndicator(e.target.value as Indicator)}
                                className="appearance-none border rounded-md px-3 py-2
                           bg-white text-neutral-900
                           dark:bg-neutral-900 dark:text-neutral-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {indicators.map((i) => (
                                    <option
                                        key={i}
                                        value={i}
                                        className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                                    >
                                        {i}
                                    </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 dark:text-neutral-300">
                ▾
              </span>
                        </div>
                    </div>

                    {/* EMA fast/slow inputs (conditional) */}
                    {indicator === 'ema_cross' && (
                        <>
                            <div className="flex items-center gap-2">
                                <label htmlFor="emaFast" className="text-sm text-neutral-700 dark:text-neutral-200">
                                    Fast
                                </label>
                                <input
                                    id="emaFast"
                                    type="number"
                                    min={1}
                                    max={90}
                                    step={1}
                                    value={emaFast}
                                    onChange={(e) => setEmaFast(clamp(toIntOr(e.target.value, 8), 1, 90))}
                                    className={`w-20 rounded-md border px-3 py-2 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                        fastOk ? 'border-neutral-300 dark:border-neutral-700' : 'border-red-500'
                                    }`}
                                    title="EMA fast window (1–90)"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label htmlFor="emaSlow" className="text-sm text-neutral-700 dark:text-neutral-200">
                                    Slow
                                </label>
                                <input
                                    id="emaSlow"
                                    type="number"
                                    min={1}
                                    max={90}
                                    step={1}
                                    value={emaSlow}
                                    onChange={(e) => setEmaSlow(clamp(toIntOr(e.target.value, 21), 1, 90))}
                                    className={`w-20 rounded-md border px-3 py-2 bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                        slowOk ? 'border-neutral-300 dark:border-neutral-700' : 'border-red-500'
                                    }`}
                                    title="EMA slow window (1–90)"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            const f = clamp(emaFast | 0, 1, 90);
                            const s = clamp(emaSlow | 0, 1, 90);
                            if (indicator === 'ema_cross' && f > s) {
                                setErr('Fast window should be ≤ Slow window.');
                                return;
                            }
                            setErr(null);
                            const controller = new AbortController();
                            fetchData(controller.signal);
                        }}
                        className="ml-auto rounded-md border px-3 py-2 text-sm
                       border-neutral-300 bg-white text-neutral-900
                       hover:bg-neutral-50
                       dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                       dark:hover:bg-neutral-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        Refresh
                    </button>
                </div>

                {/* Backtest key:value cards (only if present) */}
                {cards.length > 0 && (
                    <div className="mx-auto max-w-7xl px-4 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            {cards.map(({ label, value }) => (
                                <div
                                    key={label}
                                    className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 px-3 py-2"
                                >
                                    <div className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                        {label}
                                    </div>
                                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Chart area */}
            <section className="flex-1">
                <div className="mx-auto max-w-7xl px-4 py-6">
                    {loading && (
                        <div className="py-16">
                            <LoadingIndicator message="Loading trend-follow data…" />
                        </div>
                    )}

                    {err && !loading && (
                        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                            {err}
                        </div>
                    )}

                    {!loading && !err && (
                        <div className="w-full" style={{ height: '70vh' }}>
                            <HighchartsReact
                                ref={chartRef as any}
                                highcharts={Highcharts}
                                constructorType="stockChart"
                                options={options}
                            />
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
