'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { useWebsocket } from '@/hooks/useWebsocket';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import HHIMMChart, {
    TimeSeriesPoint as HHIMMPoint,
    HHIMMChartHandle,
} from '@/components/marketflow/HHIMMChart';
import HHIADChart, {
    TimeSeriesPoint as HHIADPoint,
    HHIADChartHandle,
} from '@/components/marketflow/HHIADChart';
import CompareHHIChart, {
    TimeSeriesPoint as CompareHHIPoint,
    CompareHHIChartHandle,
} from '@/components/marketflow/CompareHHIChart';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/Card';

interface MarketflowAnalyticsCharts {
    hhi_mm_chart?: HHIMMPoint[];
    hhi_ad_chart?: HHIADPoint[];
    compare_chart?: CompareHHIPoint[];
}

interface MarketflowAnalyticsMeta {
    generated_at_ms?: number;
    [key: string]: unknown;
}

interface MarketflowAnalyticsPayload {
    ticker?: string;
    charts?: MarketflowAnalyticsCharts;
    meta?: MarketflowAnalyticsMeta;
    [key: string]: unknown;
}

interface MarketflowAnalyticsMessage {
    type: string;
    payload?: MarketflowAnalyticsPayload;
}

type WebsocketStatus = 'connecting' | 'open' | 'closed' | 'error';

const PERIOD_OPTIONS = ['15min', '1h', '4h', '1d', '1w'] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

const isValidPeriod = (value: string | null): value is PeriodOption =>
    !!value && (PERIOD_OPTIONS as readonly string[]).includes(value);

const MarketflowAnalyticsChartsPage: React.FC = () => {
    const { setConfig } = useHeaderConfig();
    const { ticker, period, setPeriod } = useTickerPeriod();
    const { marketflowAnalytics$ } = useWebsocket();

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [hhiMmData, setHhiMmData] = useState<HHIMMPoint[]>([]);
    const [hhiAdData, setHhiAdData] = useState<HHIADPoint[]>([]);
    const [compareData, setCompareData] = useState<CompareHHIPoint[]>([]);
    const [generatedAtMs, setGeneratedAtMs] = useState<number | null>(null);
    const [wsStatus, setWsStatus] = useState<WebsocketStatus>('connecting');

    // Refs to underlying Highcharts instances (via getChart() handle)
    const mmRef = useRef<HHIMMChartHandle | null>(null);
    const adRef = useRef<HHIADChartHandle | null>(null);
    const spreadRef = useRef<CompareHHIChartHandle | null>(null);

    // Configure header for this page
    useEffect(() => {
        setConfig({
            showTicker: true,
            showPeriod: false, // local period selector instead of header dropdown
        });
    }, [setConfig]);

    // On mount: sync period from URL (if valid), otherwise ensure URL reflects current context period
    useEffect(() => {
        const qpPeriod = searchParams.get('period');
        const currentPeriod = period || '1h';

        if (isValidPeriod(qpPeriod)) {
            if (qpPeriod !== period) {
                setPeriod(qpPeriod);
            }
        } else {
            const params = new URLSearchParams(searchParams.toString());
            params.set('period', currentPeriod);
            router.replace(`${pathname}?${params.toString()}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    const handlePeriodChange = (value: PeriodOption) => {
        if (value === period) return;

        setPeriod(value);

        const params = new URLSearchParams(searchParams.toString());
        params.set('period', value);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Subscribe to Marketflow Analytics stream
    useEffect(() => {
        if (!marketflowAnalytics$) return;

        setWsStatus('connecting');

        const subscription = marketflowAnalytics$.subscribe({
            next: (msg: MarketflowAnalyticsMessage) => {
                setWsStatus('open');

                if (!msg || msg.type !== 'update_data' || !msg.payload) return;

                const payload = msg.payload;

                // Respect ticker if present on payload
                if (payload.ticker && ticker && payload.ticker !== ticker) {
                    return;
                }

                const charts = payload.charts ?? {};

                setHhiMmData(charts.hhi_mm_chart ?? []);
                setHhiAdData(charts.hhi_ad_chart ?? []);
                setCompareData(charts.compare_chart ?? []);

                if (payload.meta?.generated_at_ms) {
                    setGeneratedAtMs(payload.meta.generated_at_ms);
                }
            },
            error: () => {
                setWsStatus('error');
            },
            complete: () => {
                setWsStatus('closed');
            },
        });

        return () => subscription.unsubscribe();
    }, [marketflowAnalytics$, ticker]);

    const formatGeneratedAt = (ms: number | null): string => {
        if (!ms) return '—';
        try {
            return new Date(ms).toLocaleString();
        } catch {
            return '—';
        }
    };

    const renderWsStatusBadge = (status: WebsocketStatus) => {
        let label = '';
        let classes =
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium';

        switch (status) {
            case 'open':
                label = 'Live (open)';
                classes += ' border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
                break;
            case 'error':
                label = 'Error';
                classes += ' border-error/40 bg-error/10 text-error-dark';
                break;
            case 'closed':
                label = 'Closed';
                classes +=
                    ' border-neutral-500/40 bg-neutral-500/10 text-neutral-500 dark:text-neutral-100/70';
                break;
            case 'connecting':
            default:
                label = 'Connecting…';
                classes += ' border-accent/40 bg-accent/10 text-accent-dark';
                break;
        }

        return <span className={classes}>{label}</span>;
    };

    // Crosshair + tooltip sync across all three charts
    useEffect(() => {
        const mmChart = mmRef.current?.getChart();
        const adChart = adRef.current?.getChart();
        const spreadChart = spreadRef.current?.getChart();

        if (!mmChart || !adChart || !spreadChart) return;

        const bind = (from: any, toList: any[]) => {
            const el: HTMLElement | null =
                (from as any).renderTo ??
                ((from.container as HTMLElement | null) ?? null);
            if (!el) return () => {};

            const onMove = (e: MouseEvent) => {
                toList.forEach((to) => {
                    const evt = to.pointer?.normalize(e);
                    (to.pointer as any)?.onContainerMouseMove(evt);
                });
            };

            const onLeave = () => {
                toList.forEach((to) => {
                    to.tooltip?.hide(0);
                    to.xAxis?.[0]?.hideCrosshair();
                });
            };

            el.addEventListener('mousemove', onMove);
            el.addEventListener('mouseleave', onLeave);

            return () => {
                el.removeEventListener('mousemove', onMove);
                el.removeEventListener('mouseleave', onLeave);
            };
        };

        const un1 = bind(mmChart, [adChart, spreadChart]);
        const un2 = bind(adChart, [mmChart, spreadChart]);
        const un3 = bind(spreadChart, [mmChart, adChart]);

        return () => {
            un1 && un1();
            un2 && un2();
            un3 && un3();
        };
    }, [hhiMmData, hhiAdData, compareData]);

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4 lg:p-6">
            {/* Header row */}
            <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold">
                        Marketflow Analytics – HHI Concentration
                    </h1>
                    <p className="mt-1 text-sm opacity-80">
                        Live Herfindahl–Hirschman concentration metrics for Market Makers
                        (MM) and Accumulators/Distributors (AD), plus the spread between
                        them.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-3 text-sm md:items-end">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-neutral-600 dark:text-neutral-100/70">
                            Ticker:{' '}
                            <span className="ml-1 font-medium text-text dark:text-text-inverted">
                                {ticker ?? '—'}
                            </span>
                        </span>
                        {renderWsStatusBadge(wsStatus)}
                    </div>

                    {/* Period selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wide opacity-70">
                            Period
                        </span>
                        <div className="flex overflow-hidden rounded-full border border-gray-300 bg-surface dark:border-gray-700 dark:bg-secondary-dark">
                            {PERIOD_OPTIONS.map((opt) => {
                                const active = opt === period;
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handlePeriodChange(opt)}
                                        className={[
                                            'px-3 py-1 text-xs font-medium transition-colors',
                                            active
                                                ? 'bg-primary dark:bg-primary-dark text-black dark:text-text-inverted'
                                                : 'bg-transparent text-neutral-600 dark:text-neutral-100/70 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                                        ].join(' ')}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-neutral-600 dark:text-neutral-100/70">
                        Generated:{' '}
                        <span className="font-medium text-text dark:text-text-inverted">
                            {formatGeneratedAt(generatedAtMs)}
                        </span>
                    </div>
                </div>
            </section>

            {/* Stacked HHI charts for synchronized timeline */}
            <section className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>HHI – Market Makers (MM)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <HHIMMChart ref={mmRef} data={hhiMmData} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>HHI – Accumulation / Distribution (AD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <HHIADChart ref={adRef} data={hhiAdData} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>HHI Spread (MM – AD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CompareHHIChart ref={spreadRef} data={compareData} />
                    </CardContent>
                </Card>
            </section>
        </main>
    );
};

export default MarketflowAnalyticsChartsPage;
