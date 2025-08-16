'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import Header from '@/components/Header';
import LoadingIndicator from '@/components/LoadingIndicator';

type Period = '5min' | '15min' | '30min' | '1h' | '4h' | '1d';
type Ticker = 'BTC-USD' | 'ETH-USD' | 'SOL-USD';
type Indicator = 'ts_mom' | 'rsi' | 'rsi50' | 'ts_ema' | 'ema&fast=8&slow=21' | 'sma_cross' | 'donchian_break';

type TrendFollowResponse = {
    ticker: Ticker;
    period: Period;
    indicator: Indicator;
    ohlc: [number, number, number, number, number?][]; // [ts, open, high, low, close, (optional volume)]
    buys: [number, number, string][];
    sells: [number, number, string][];
};

const periods: Period[] = ['5min', '15min', '30min', '1h', '4h', '1d'];
const tickers: Ticker[] = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
const indicators: Indicator[] = ['ts_mom', 'rsi', 'rsi50', 'ts_ema', 'ema&fast=8&slow=21', 'sma_cross', 'donchian_break'];

const ENDPOINT = 'https://botpilot--9000.ngrok.io/trend-follow';

export default function TrendFollowPage() {
    const [ticker, setTicker] = useState<Ticker>('SOL-USD');
    const [period, setPeriod] = useState<Period>('15min');
    const [indicator, setIndicator] = useState<Indicator>('ema&fast=8&slow=21');

    const [data, setData] = useState<TrendFollowResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);

    const chartRef = useRef<HighchartsReact.RefObject>(null);

    const buildUrl = useCallback(() => {
        const url = new URL(ENDPOINT);
        url.searchParams.set('ticker', ticker);
        url.searchParams.set('period', period);
        url.searchParams.set('indicator', indicator);
        return url.toString();
    }, [ticker, period, indicator]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setErr(null);
        setData(null);
        const controller = new AbortController();
        try {
            const res = await fetch(buildUrl(), {
                method: 'GET',
                signal: controller.signal,
                // Rely on server CORS; credentials not needed here.
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            const json = (await res.json()) as TrendFollowResponse;
            setData(json);
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                setErr(e?.message ?? 'Failed to load data');
            }
        } finally {
            setLoading(false);
        }
        return () => controller.abort();
    }, [buildUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Transform backend data into Highcharts series
    const series = useMemo<Highcharts.SeriesOptionsType[]>(() => {
        if (!data) return [];

        const candleId = `${data.ticker}:${data.period}:candles`;

        const ohlc: Highcharts.SeriesCandlestickOptions = {
            type: 'candlestick',
            id: candleId,
            name: `${data.ticker} ${data.period}`,
            data: data.ohlc.map(d => {
                // Accept either OHLC or OCHLV; ignore volume if present
                // [ts, o, h, l, c, (v?)]
                const [x, o, h, l, c] = d;
                return [x, o, h, l, c];
            }) as any,
            tooltip: { valueDecimals: 2 }
        };

        // Map buys to flags
        const buyFlags: Highcharts.SeriesFlagsOptions = {
            type: 'flags',
            name: 'Buy',
            onSeries: candleId,
            shape: 'flag',
            color: '#16a34a', // green
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

        // Map sells to flags
        const sellFlags: Highcharts.SeriesFlagsOptions = {
            type: 'flags',
            name: 'Sell',
            onSeries: candleId,
            shape: 'flag',
            color: '#dc2626', // red
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

        return [ohlc, buyFlags, sellFlags];
    }, [data]);

    const options = useMemo<Highcharts.Options>(() => {
        return {
            chart: {
                backgroundColor: 'transparent',
                height: '70%'
            },
            title: {
                text: data ? `${data.ticker} – ${data.period} (${data.indicator})` : 'Trend Follow',
            },
            rangeSelector: {
                selected: 4, // default zoom
                inputEnabled: true
            },
            legend: {
                enabled: true
            },
            xAxis: {
                type: 'datetime'
            },
            yAxis: [
                {
                    title: { text: 'Price' },
                    opposite: false
                }
            ],
            tooltip: {
                split: true
            },
            navigator: {
                enabled: true
            },
            scrollbar: {
                enabled: true
            },
            plotOptions: {
                candlestick: {
                    color: '#dc2626',
                    upColor: '#16a34a',
                    lineColor: '#991b1b',
                    upLineColor: '#166534'
                },
                series: {
                    turboThreshold: 0
                }
            },
            series
        };
    }, [series, data]);

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

                    <button
                        type="button"
                        onClick={fetchData}
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
