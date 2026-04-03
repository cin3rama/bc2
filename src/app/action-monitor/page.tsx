// /app/action-monitor/page.tsx

'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useWebsocket } from '@/hooks/useWebsocket';
import type {
    ActionMonitorEnvelope,
    ActionMonitorSnapshot,
    ActionMonitorCategory,
    ActionMonitorParticipant,
    ChangeDirection,
} from '@/types/actionMonitorTypes';

type MetricRenderable = string | number | boolean | null;

type MetricEntry = {
    key: string;
    value: MetricRenderable;
};

type CategoryView = 'participants' | 'totals';

function flattenMetricEntries(
    block: Record<string, unknown>,
    parentKey?: string,
): MetricEntry[] {
    const entries: MetricEntry[] = [];

    Object.entries(block || {}).forEach(([key, value]) => {
        const nextKey = parentKey ? `${parentKey}.${key}` : key;

        if (
            value === null ||
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {
            entries.push({ key: nextKey, value });
            return;
        }

        if (Array.isArray(value)) {
            entries.push({ key: nextKey, value: JSON.stringify(value) });
            return;
        }

        if (typeof value === 'object') {
            entries.push(
                ...flattenMetricEntries(value as Record<string, unknown>, nextKey),
            );
            return;
        }

        entries.push({ key: nextKey, value: String(value) });
    });

    return entries;
}

function roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
}

function formatMetricValue(value: MetricRenderable): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return String(value);
        return roundToTwo(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    }

    const trimmed = value.trim();
    if (trimmed === '') return '—';

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
        return roundToTwo(numeric).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    }

    return value;
}

function labelize(key: string): string {
    return key
        .replace(/\./g, ' / ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function blockEntries(block: Record<string, unknown>): MetricEntry[] {
    return flattenMetricEntries(block);
}

function formatUnknownValue(value: unknown): string {
    if (value === null || value === undefined) return '—';

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return formatMetricValue(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => formatUnknownValue(item)).join(' · ');
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;

        const primary =
            obj.primary !== undefined && obj.primary !== null
                ? formatUnknownValue(obj.primary)
                : '';

        const secondary =
            obj.secondary !== undefined && obj.secondary !== null
                ? formatUnknownValue(obj.secondary)
                : '';

        if (primary && secondary) return `${primary} · ${secondary}`;
        if (primary) return primary;
        if (secondary) return secondary;

        return Object.entries(obj)
            .map(([k, v]) => `${labelize(k)}: ${formatUnknownValue(v)}`)
            .join(' · ');
    }

    return String(value);
}

function toNumeric(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const numeric = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(numeric) ? roundToTwo(numeric) : 0;
}

function DirectionArrow({ dir }: { dir?: ChangeDirection }) {
    if (dir === 'up') {
        return <span className="text-green-500 mr-1">▲</span>;
    }

    if (dir === 'down') {
        return <span className="text-red-500 mr-1">▼</span>;
    }

    return null;
}

function getAOISizeClass(equityUsd: unknown): string {
    const numeric =
        typeof equityUsd === 'string'
            ? Number(equityUsd)
            : typeof equityUsd === 'number'
                ? equityUsd
                : NaN;

    if (!Number.isNaN(numeric) && numeric > 10_000_000) return 'w-4 h-4';
    if (!Number.isNaN(numeric) && numeric >= 1_000_000) return 'w-3 h-3';
    return 'w-2.5 h-2.5';
}

function getAOITitle(aoiType: unknown, equityUsd: unknown): string {
    const rawType =
        typeof aoiType === 'string' && aoiType.trim() !== ''
            ? aoiType.trim()
            : 'fallback';
    const equityText = formatUnknownValue(equityUsd);
    return `${rawType} · ${equityText}`;
}

function AOITypeSymbol({
                           isActiveAoi,
                           aoiType,
                           equityUsd,
                       }: {
    isActiveAoi?: boolean;
    aoiType: unknown;
    equityUsd: unknown;
}) {
    if (
        !isActiveAoi &&
        (aoiType === null || aoiType === undefined) &&
        (equityUsd === null || equityUsd === undefined)
    ) {
        return null;
    }

    const rawType =
        typeof aoiType === 'string' ? aoiType.trim().toLowerCase() : null;
    const sizeClass = getAOISizeClass(equityUsd);
    const title = getAOITitle(aoiType, equityUsd);

    let className = `inline-block rounded-full border border-gray-500 ${sizeClass}`;
    let style: CSSProperties | undefined;

    switch (rawType) {
        case 'mm_bot':
            className += ' bg-yellow-400 border-yellow-500';
            break;
        case 'position_trader':
            className += ' bg-violet-500 border-violet-600';
            break;
        case 'success_leader':
            className += ' bg-green-500 border-green-600';
            break;
        case 'active_basis_bot':
            className += ' border-gray-500';
            style = {
                background:
                    'linear-gradient(90deg, #ffffff 0%, #ffffff 50%, #000000 50%, #000000 100%)',
            };
            break;
        case 'archived':
        case 'position':
            className += ' bg-black border-black';
            break;
        default:
            className += ' bg-black border-black';
            break;
    }

    return <span className={className} style={style} title={title} />;
}

function MetricGridCard({
                            title,
                            block,
                        }: {
    title: string;
    block: Record<string, unknown>;
}) {
    const entries = useMemo(() => blockEntries(block), [block]);

    return (
        <div className="rounded shadow bg-white dark:bg-gray-800 p-3 text-text dark:text-text-inverted">
            <h2 className="text-sm font-semibold mb-3">{title}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entries.length === 0 ? (
                    <div className="text-xs opacity-70">No data</div>
                ) : (
                    entries.map((entry) => (
                        <div
                            key={entry.key}
                            className="rounded border border-gray-200 dark:border-gray-700 p-2"
                        >
                            <div className="text-[11px] opacity-70">
                                {labelize(entry.key)}
                            </div>
                            <div className="text-sm font-semibold break-words">
                                {formatMetricValue(entry.value)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function MetricRowSection({
                              title,
                              entries,
                              columnsClassName,
                              compact = false,
                          }: {
    title: string;
    entries: Array<{ label: string; value: MetricRenderable }>;
    columnsClassName: string;
    compact?: boolean;
}) {
    return (
        <div
            className={`rounded shadow bg-white dark:bg-gray-800 text-text dark:text-text-inverted ${
                compact ? 'p-3' : 'p-4'
            }`}
        >
            <h2 className={`${compact ? 'text-sm' : 'text-base'} font-semibold mb-3`}>
                {title}
            </h2>
            <div className={`grid gap-2 ${columnsClassName}`}>
                {entries.map((entry) => (
                    <div
                        key={entry.label}
                        className={`rounded border border-gray-200 dark:border-gray-700 ${
                            compact ? 'p-2 min-h-[68px]' : 'p-3'
                        }`}
                    >
                        <div className={`${compact ? 'text-[11px]' : 'text-xs'} opacity-70 mb-1`}>
                            {entry.label}
                        </div>
                        <div className={`${compact ? 'text-base' : 'text-xl'} font-bold`}>
                            {formatMetricValue(entry.value)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ImpactPairCard({
                            title,
                            leftLabel,
                            leftValue,
                            rightLabel,
                            rightValue,
                        }: {
    title: string;
    leftLabel: string;
    leftValue: MetricRenderable;
    rightLabel: string;
    rightValue: MetricRenderable;
}) {
    return (
        <div className="rounded shadow bg-white dark:bg-gray-800 p-4 text-text dark:text-text-inverted">
            <h2 className="text-base font-semibold mb-4">{title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs opacity-70 mb-1">{leftLabel}</div>
                    <div className="text-xl font-bold">
                        {formatMetricValue(leftValue)}
                    </div>
                </div>

                <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs opacity-70 mb-1">{rightLabel}</div>
                    <div className="text-xl font-bold">
                        {formatMetricValue(rightValue)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function buildImpactChartOptions(
    snapshot: ActionMonitorSnapshot,
    chartAccent: string,
): Highcharts.Options {
    const impact1m = snapshot.series?.impact_1m;

    const upAbsorption = (impact1m?.up_move_absorption || []).map(([ts, v]) => [
        ts,
        toNumeric(v),
    ]);
    const downAbsorption = (impact1m?.down_move_absorption || []).map(([ts, v]) => [
        ts,
        toNumeric(v),
    ]);
    const upVol = (impact1m?.up_vol || []).map(([ts, v]) => [ts, toNumeric(v)]);
    const downVol = (impact1m?.down_vol || []).map(([ts, v]) => [ts, toNumeric(v)]);

    return {
        chart: {
            backgroundColor: 'transparent',
            height: 360,
        },
        time: { timezone: 'UTC' },
        title: {
            text: 'Impact 1 Minute',
            style: {
                color: chartAccent,
                fontSize: '14px',
                fontWeight: '600',
            },
        },
        credits: {
            enabled: false,
        },
        xAxis: {
            type: 'datetime',
            lineColor: chartAccent,
            tickColor: chartAccent,
            gridLineColor: chartAccent,
            labels: {
                format: '{value:%H:%M}',
                style: {
                    color: chartAccent,
                },
            },
        },
        yAxis: [
            {
                title: {
                    text: 'Absorption',
                    style: {
                        color: chartAccent,
                    },
                },
                gridLineColor: chartAccent,
                labels: {
                    style: {
                        color: chartAccent,
                    },
                },
            },
            {
                title: {
                    text: 'Volume',
                    style: {
                        color: chartAccent,
                    },
                },
                gridLineColor: chartAccent,
                labels: {
                    style: {
                        color: chartAccent,
                    },
                },
                opposite: true,
            },
        ],
        legend: {
            enabled: true,
            itemStyle: {
                color: chartAccent,
            },
        },
        tooltip: {
            shared: true,
            xDateFormat: '%Y-%m-%d %H:%M:%S UTC',
        },
        plotOptions: {
            series: {
                animation: false,
            },
            column: {
                borderWidth: 0,
                pointPadding: 0.08,
                groupPadding: 0.12,
            },
            line: {
                marker: {
                    enabled: false,
                },
            },
        },
        series: [
            {
                type: 'line',
                name: 'Up Move Absorption',
                data: upAbsorption,
                color: '#22c55e',
                yAxis: 0,
                lineWidth: 2,
            },
            {
                type: 'line',
                name: 'Down Move Absorption',
                data: downAbsorption,
                color: '#ef4444',
                yAxis: 0,
                lineWidth: 2,
            },
            {
                type: 'column',
                name: 'Up Vol',
                data: upVol,
                color: '#22c55e',
                yAxis: 1,
            },
            {
                type: 'column',
                name: 'Down Vol',
                data: downVol,
                color: '#ef4444',
                yAxis: 1,
            },
        ],
    };
}

function ParticipantTable({
                              participants,
                          }: {
    participants: ActionMonitorParticipant[];
}) {
    const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

    const handleCopyAccountId = async (accountId: string) => {
        try {
            await navigator.clipboard.writeText(accountId);
            setCopiedAccountId(accountId);
            window.setTimeout(() => {
                setCopiedAccountId((current) =>
                    current === accountId ? null : current,
                );
            }, 1200);
        } catch (error) {
            console.error('[ActionMonitor] Failed to copy account_id', error);
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
                <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                    <th className="text-left p-2">Rank</th>
                    <th className="text-left p-2">Account</th>
                    <th className="text-left p-2">Volume</th>
                    <th className="text-left p-2">Trades</th>
                    <th className="text-left p-2">AOI Type</th>
                </tr>
                </thead>
                <tbody>
                {participants.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-2 opacity-70">
                            No participants
                        </td>
                    </tr>
                ) : (
                    participants.map((row) => (
                        <tr
                            key={`${row.account_id}-${row.rank}`}
                            className="border-b border-gray-200 dark:border-gray-700"
                        >
                            <td className="p-2 font-semibold">
                                <div className="inline-flex items-center">
                                    <DirectionArrow dir={row.rank_change_dir} />
                                    <span>{formatMetricValue(row.rank ?? null)}</span>
                                </div>
                            </td>
                            <td className="p-2">
                                <button
                                    type="button"
                                    onClick={() => handleCopyAccountId(row.account_id)}
                                    className="inline-flex items-center gap-2 text-left hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
                                    title={row.account_id}
                                >
                                        <span>
                                            {row.account_id.slice(0, 6)}...
                                            {row.account_id.slice(-5)}
                                        </span>
                                    {copiedAccountId === row.account_id ? (
                                        <span className="text-[10px] text-green-500 font-semibold">
                                                Copied
                                            </span>
                                    ) : null}
                                </button>
                            </td>
                            <td className="p-2">
                                <div className="inline-flex items-center">
                                    <DirectionArrow dir={row.vol_change_dir} />
                                    <span>
                                            {formatMetricValue(row.total_vol as MetricRenderable)}
                                        </span>
                                </div>
                            </td>
                            <td className="p-2">
                                <div className="inline-flex items-center">
                                    <DirectionArrow dir={row.trades_change_dir} />
                                    <span>
                                            {formatMetricValue(
                                                row.total_trades as MetricRenderable,
                                            )}
                                        </span>
                                </div>
                            </td>
                            <td className="p-2">
                                <AOITypeSymbol
                                    isActiveAoi={row.is_active_aoi}
                                    aoiType={row.aoi_type}
                                    equityUsd={row.equity_usd}
                                />
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </table>
        </div>
    );
}

function CategoryCard({
                          title,
                          category,
                      }: {
    title: string;
    category: ActionMonitorCategory;
}) {
    const [view, setView] = useState<CategoryView>('participants');

    return (
        <div className="rounded shadow bg-white dark:bg-gray-800 p-3 text-text dark:text-text-inverted">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <div className="text-xs opacity-70">
                        {formatUnknownValue(category.label)}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setView('participants')}
                        className={`text-[11px] px-2 py-1 rounded-full ${
                            view === 'participants'
                                ? 'bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted'
                                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                        }`}
                    >
                        Participants
                    </button>

                    <button
                        type="button"
                        onClick={() => setView('totals')}
                        className={`text-[11px] px-2 py-1 rounded-full ${
                            view === 'totals'
                                ? 'bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted'
                                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                        }`}
                    >
                        Category Totals
                    </button>
                </div>
            </div>

            <div className="mb-3">
                <div className="text-[11px] px-2 py-1 inline-flex rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                    Sort: {formatUnknownValue(category.sort)}
                </div>
            </div>

            {view === 'participants' ? (
                <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                    <div className="text-sm font-semibold mb-2">Participants</div>
                    <ParticipantTable participants={category.participants} />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <MetricGridCard
                        title="Totals"
                        block={category.totals as Record<string, unknown>}
                    />
                    <MetricGridCard
                        title="ROM"
                        block={category.rom as Record<string, unknown>}
                    />
                </div>
            )}
        </div>
    );
}

export default function ActionMonitorPage() {
    const { actionMonitor$ } = useWebsocket();

    const [snapshot, setSnapshot] = useState<ActionMonitorSnapshot | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const sub = actionMonitor$.subscribe({
            next: (msg: ActionMonitorEnvelope) => {
                if (msg?.type === 'update_data' && msg.payload) {
                    setSnapshot(msg.payload);
                    setIsConnected(true);
                }
            },
            error: () => {
                setIsConnected(false);
            },
            complete: () => {
                setIsConnected(false);
            },
        });

        return () => sub.unsubscribe();
    }, [actionMonitor$]);

    useEffect(() => {
        const syncDarkMode = () => {
            if (typeof document !== 'undefined') {
                setIsDarkMode(document.documentElement.classList.contains('dark'));
            }
        };

        syncDarkMode();

        const observer = new MutationObserver(syncDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    if (!snapshot) {
        return (
            <div className="p-4 text-text dark:text-text-inverted">
                Waiting for Action Monitor snapshot...
            </div>
        );
    }

    const chartAccent = isDarkMode ? '#8B770C' : '#FFE066';
    const chartVars: CSSProperties = {
        ['--am-chart-line' as string]: chartAccent,
        ['--am-chart-grid' as string]: chartAccent,
        ['--am-chart-text' as string]: chartAccent,
    };

    const priceEntries = blockEntries(
        snapshot.price as Record<string, unknown>,
    ).map((entry) => ({
        label: labelize(entry.key),
        value: entry.value,
    }));

    const flowEntries = blockEntries(
        snapshot.flow as Record<string, unknown>,
    )
        .slice(0, 4)
        .map((entry) => ({
            label: labelize(entry.key),
            value: entry.value,
        }));

    return (
        <div
            className="p-4 space-y-4 text-text dark:text-text-inverted"
            style={chartVars}
        >
            <div className="rounded shadow bg-white dark:bg-gray-800 p-4">
                <div className="flex justify-between">
                    <h1 className="text-xl font-bold">Action Monitor</h1>
                    <div
                        className={`text-sm font-bold ${
                            isConnected ? 'text-green-500' : 'text-red-500'
                        }`}
                    >
                        {isConnected ? 'Live' : 'Disconnected'}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                    <div>
                        <div className="opacity-70">Ticker</div>
                        <div>{snapshot.meta.ticker}</div>
                    </div>
                    <div>
                        <div className="opacity-70">Period</div>
                        <div>{snapshot.meta.period}</div>
                    </div>
                    <div>
                        <div className="opacity-70">Window Ms</div>
                        <div>{formatMetricValue(snapshot.meta.window_ms)}</div>
                    </div>
                </div>
            </div>

            <MetricRowSection
                title="Price"
                entries={priceEntries}
                columnsClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
                compact={true}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ImpactPairCard
                    title="Upward Impact"
                    leftLabel="Up Move Absorption"
                    leftValue={snapshot.impact?.up_move_absorption as MetricRenderable}
                    rightLabel="Buy Vol Per Up Dollar"
                    rightValue={snapshot.impact?.buy_vol_per_up_dollar as MetricRenderable}
                />

                <ImpactPairCard
                    title="Downward Impact"
                    leftLabel="Down Move Absorption"
                    leftValue={snapshot.impact?.down_move_absorption as MetricRenderable}
                    rightLabel="Sell Vol Per Down Dollar"
                    rightValue={snapshot.impact?.sell_vol_per_down_dollar as MetricRenderable}
                />
            </div>

            <MetricRowSection
                title="Flow"
                entries={flowEntries}
                columnsClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
            />

            <div className="rounded shadow bg-white dark:bg-gray-800 p-4">
                <HighchartsReact
                    highcharts={Highcharts}
                    options={buildImpactChartOptions(snapshot, chartAccent)}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CategoryCard
                    title="MM Buyers"
                    category={snapshot.categories.mm_buyers}
                />
                <CategoryCard
                    title="MM Sellers"
                    category={snapshot.categories.mm_sellers}
                />
                <CategoryCard
                    title="Accumulators"
                    category={snapshot.categories.accumulators}
                />
                <CategoryCard
                    title="Distributors"
                    category={snapshot.categories.distributors}
                />
            </div>
        </div>
    );
}
