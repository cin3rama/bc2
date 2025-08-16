'use client';

import { useMemo, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { useDonchianHttpHook, Period, RawSeries } from '@/hooks/useDonchianHttpHook';
import LoadingIndicator from '@/components/LoadingIndicator';

// Allowed period options
const PERIODS: Period[] = ['5min', '15min', '30min', '1h', '4h', '1d'];

/** ----- Controls (Header) ----- */
function DonchianControls({
                              ticker,
                              period,
                              onChange,
                          }: {
    ticker: string;
    period: Period;
    onChange: (next: { ticker?: string; period?: Period }) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-600">Ticker</label>
                <input
                    className="border rounded px-2 py-1 text-sm"
                    value={ticker}
                    onChange={(e) => onChange({ ticker: e.target.value })}
                    placeholder="e.g. SOL-USD"
                    spellCheck={false}
                />
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-600">Period</label>
                <select
                    className="border rounded px-2 py-1 text-sm"
                    value={period}
                    onChange={(e) => onChange({ period: e.target.value as Period })}
                >
                    {PERIODS.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

/** ----- Chart (decoupled from header) ----- */
function DonchianChart({ ticker, period }: { ticker: string; period: Period }) {
    const { data, isLoading, error } = useDonchianHttpHook(ticker, period);

    const options = useMemo(() => {
        const series: Highcharts.SeriesOptionsType[] =
            (data ?? []).map((s: RawSeries) => {
                const common = {
                    id: s.id,
                    name: s.name ?? s.id,
                    yAxis: s.yAxis ?? (s.id.includes('ensemble') ? 1 : 0),
                    tooltip: s.tooltip ?? { valueDecimals: 2 },
                    linkedTo: s.linkedTo,
                    zIndex: s.type === 'candlestick' ? 3 : s.name?.toLowerCase().includes('mid') ? 2 : 1,
                } as const;

                if (s.type === 'candlestick') {
                    return {
                        ...common,
                        type: 'candlestick',
                        data: s.data as [number, number, number, number, number][],
                    } satisfies Highcharts.SeriesCandlestickOptions;
                }

                return {
                    ...common,
                    type: 'line',
                    data: s.data as [number, number][],
                    dashStyle: s.dashStyle as any,
                    step: s.step as any,
                    lineWidth: 2,
                    enableMouseTracking: true,
                } satisfies Highcharts.SeriesLineOptions;
            }) ?? [];

        return {
            chart: { height: 640 },
            rangeSelector: { selected: 4 },
            legend: { enabled: true },
            yAxis: [
                {
                    title: { text: `${ticker} (${period})` },
                    height: '70%',
                    resize: { enabled: true },
                    lineWidth: 1,
                },
                {
                    title: { text: 'Ensemble' },
                    top: '72%',
                    height: '28%',
                    offset: 0,
                    lineWidth: 1,
                },
            ],
            xAxis: { type: 'datetime' },
            tooltip: { split: true },
            plotOptions: {
                series: {
                    dataGrouping: { enabled: false },
                    turboThreshold: 0,
                },
                candlestick: {
                    color: '#d9534f',
                    upColor: '#5cb85c',
                },
            },
            series,
            credits: { enabled: false },
        } satisfies Highcharts.Options; // keep types happy without @ts-ignore
    }, [data, ticker, period]);

    if (isLoading) return <LoadingIndicator message={`Loading ${ticker} • ${period}…`} />;
    if (error) return <div className="p-4 text-sm text-red-500">Error: {error.message}</div>;
    if (!data || data.length === 0)
        return <div className="p-4 text-sm text-zinc-500">No data for {ticker} • {period}</div>;

    return (
        <HighchartsReact
            highcharts={Highcharts}
            constructorType="stockChart"
            options={options}
        />
    );
}

/** ----- Page (wires controls + chart) ----- */
export default function DonchianPage() {
    const [ticker, setTicker] = useState<string>('SOL-USD');
    const [period, setPeriod] = useState<Period>('1h');

    return (
        <div className="w-full">
            <DonchianControls
                ticker={ticker}
                period={period}
                onChange={(next) => {
                    if (next.ticker !== undefined) setTicker(next.ticker);
                    if (next.period !== undefined) setPeriod(next.period);
                }}
            />
            <div className="p-4">
                <DonchianChart ticker={ticker} period={period} />
            </div>
        </div>
    );
}
