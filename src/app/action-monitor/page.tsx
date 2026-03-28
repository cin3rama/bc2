// /app/action-monitor/page.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useWebsocket } from '@/hooks/useWebsocket';
import type {
    ActionMonitorEnvelope,
    ActionMonitorSnapshot,
    ActionMonitorCategory,
} from '@/types/actionMonitorTypes';

type MetricRenderable = string | number | boolean | null;

type MetricEntry = {
    key: string;
    value: MetricRenderable;
};

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

function formatMetricValue(value: MetricRenderable): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toLocaleString() : String(value);
    }

    const trimmed = value.trim();
    if (trimmed === '') return '—';

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed !== '') {
        return numeric.toLocaleString();
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

function badgeToneClass(text: string): string {
    const t = text.toLowerCase();

    if (
        t.includes('up') ||
        t.includes('rise') ||
        t.includes('gain') ||
        t.includes('bull') ||
        t.includes('buy') ||
        t.includes('accum')
    ) {
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }

    if (
        t.includes('down') ||
        t.includes('fall') ||
        t.includes('loss') ||
        t.includes('bear') ||
        t.includes('sell') ||
        t.includes('dist')
    ) {
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }

    if (
        t.includes('new') ||
        t.includes('rank') ||
        t.includes('top') ||
        t.includes('hot')
    ) {
        return 'bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted';
    }

    return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
}

function normalizeBadgeParts(
    badge: unknown,
): Array<{ primary: string; secondary?: string }> {
    if (badge === null || badge === undefined) return [];

    if (
        typeof badge === 'string' ||
        typeof badge === 'number' ||
        typeof badge === 'boolean'
    ) {
        return [{ primary: String(badge) }];
    }

    if (Array.isArray(badge)) {
        return badge.flatMap((item) => normalizeBadgeParts(item));
    }

    if (typeof badge === 'object') {
        const obj = badge as Record<string, unknown>;

        const primary =
            obj.primary !== undefined && obj.primary !== null
                ? formatUnknownValue(obj.primary)
                : '';

        const secondary =
            obj.secondary !== undefined && obj.secondary !== null
                ? formatUnknownValue(obj.secondary)
                : '';

        if (primary || secondary) {
            return [{ primary: primary || '—', secondary: secondary || undefined }];
        }

        return [
            {
                primary: Object.entries(obj)
                    .map(([k, v]) => `${labelize(k)}: ${formatUnknownValue(v)}`)
                    .join(' · '),
            },
        ];
    }

    return [{ primary: String(badge) }];
}

function buildSeriesChart(
    title: string,
    series: Array<[number, string | number]>,
) {
    return {
        chart: {
            type: 'line',
            height: 250,
            backgroundColor: 'transparent',
        },
        title: {
            text: title,
            style: {
                fontSize: '12px',
                color: 'var(--am-chart-text)',
            },
        },
        xAxis: {
            type: 'datetime',
            lineColor: 'var(--am-chart-line)',
            tickColor: 'var(--am-chart-line)',
            labels: {
                style: {
                    color: 'var(--am-chart-text)',
                },
            },
            gridLineColor: 'var(--am-chart-grid)',
        },
        yAxis: {
            title: {
                text: null,
            },
            gridLineColor: 'var(--am-chart-grid)',
            labels: {
                style: {
                    color: 'var(--am-chart-text)',
                },
            },
        },
        tooltip: {
            shared: true,
        },
        legend: {
            enabled: false,
        },
        credits: {
            enabled: false,
        },
        series: [
            {
                type: 'line',
                name: title,
                color: 'var(--am-chart-line)',
                lineWidth: 2,
                marker: {
                    enabled: false,
                },
                data: series.map(([ts, v]) => [
                    ts,
                    typeof v === 'string' ? Number(v) : v,
                ]),
            },
        ],
    };
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

function BadgePills({ badges }: { badges: unknown[] | undefined }) {
    if (!Array.isArray(badges) || badges.length === 0) {
        return <span className="opacity-50">—</span>;
    }

    const parts = badges.flatMap((badge) => normalizeBadgeParts(badge));

    if (parts.length === 0) {
        return <span className="opacity-50">—</span>;
    }

    return (
        <div className="flex flex-wrap gap-1">
            {parts.map((part, idx) => (
                <span
                    key={`badge-pill-${idx}-${part.primary}-${part.secondary || ''}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeToneClass(
                        `${part.primary} ${part.secondary || ''}`,
                    )}`}
                    title={part.secondary || part.primary}
                >
                    <span>{part.primary}</span>
                    {part.secondary ? (
                        <span className="opacity-80">· {part.secondary}</span>
                    ) : null}
                </span>
            ))}
        </div>
    );
}

function ParticipantTable({
                              participants,
                          }: {
    participants: ActionMonitorCategory['participants'];
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
                <thead>
                <tr className="border-b border-gray-300 dark:border-gray-700">
                    <th className="text-left p-2">Rank</th>
                    <th className="text-left p-2">Account</th>
                    <th className="text-left p-2">Volume</th>
                    <th className="text-left p-2">Trades</th>
                    <th className="text-left p-2">Badges</th>
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
                            <td className="p-2 font-semibold">{row.rank}</td>
                            <td className="p-2">
                                {row.account_id.slice(0, 6)}...
                                {row.account_id.slice(-5)}
                            </td>
                            <td className="p-2">
                                {formatMetricValue(row.total_vol)}
                            </td>
                            <td className="p-2">
                                {formatMetricValue(row.total_trades)}
                            </td>
                            <td className="p-2">
                                <BadgePills badges={row.prev_rank_badges as unknown[]} />
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
    return (
        <div className="rounded shadow bg-white dark:bg-gray-800 p-3 text-text dark:text-text-inverted">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <div className="text-xs opacity-70">{formatUnknownValue(category.label)}</div>
                </div>

                <div className="text-[11px] px-2 py-1 rounded-full bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted">
                    Sort: {formatUnknownValue(category.sort)}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
                <MetricGridCard
                    title="Totals"
                    block={category.totals as Record<string, unknown>}
                />
                <MetricGridCard
                    title="ROM"
                    block={category.rom as Record<string, unknown>}
                />
            </div>

            <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                <div className="text-sm font-semibold mb-2">Participants</div>
                <ParticipantTable participants={category.participants} />
            </div>
        </div>
    );
}

export default function ActionMonitorPage() {
    const { actionMonitor$ } = useWebsocket();

    const [snapshot, setSnapshot] = useState<ActionMonitorSnapshot | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const sub = actionMonitor$.subscribe({
            next: (msg: ActionMonitorEnvelope) => {
                if (msg?.type === 'update_data' && msg.payload) {
                    setSnapshot(msg.payload);
                    setIsConnected(true);
                }
            },
            error: (err) => {
                console.error('[ActionMonitor] WS error', err);
                setIsConnected(false);
            },
            complete: () => {
                console.warn('[ActionMonitor] WS completed');
                setIsConnected(false);
            },
        });

        return () => sub.unsubscribe();
    }, [actionMonitor$]);

    if (!snapshot) {
        return (
            <div className="p-4 text-text dark:text-text-inverted">
                <div className="text-sm opacity-70">
                    Waiting for Action Monitor snapshot...
                </div>
            </div>
        );
    }

    return (
        <div
            className="p-4 space-y-4 text-text dark:text-text-inverted"
            style={
                {
                    ['--am-chart-line' as string]: 'var(--am-chart-accent)',
                    ['--am-chart-grid' as string]: 'var(--am-chart-accent)',
                    ['--am-chart-text' as string]: 'var(--am-chart-accent)',
                    ['--am-chart-accent' as string]: 'var(--am-chart-accent-value)',
                    ['--am-chart-accent-value' as string]: '#FFE066',
                } as React.CSSProperties
            }
        >
            <style jsx>{`
                :global(.dark) .action-monitor-theme {
                    --am-chart-accent-value: #8b770c;
                }
            `}</style>

            <div className="action-monitor-theme space-y-4">
                <div className="rounded shadow bg-white dark:bg-gray-800 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold">Action Monitor</h1>
                            <div className="text-sm opacity-70 mt-1">
                                Live market participant dashboard
                            </div>
                        </div>

                        <div
                            className={`text-xs px-3 py-1 rounded w-fit ${
                                isConnected
                                    ? 'bg-green-500/20 text-green-500'
                                    : 'bg-red-500/20 text-red-500'
                            }`}
                        >
                            {isConnected ? 'Live' : 'Disconnected'}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4 text-xs">
                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Ticker</div>
                            <div className="font-semibold">{snapshot.meta.ticker}</div>
                        </div>

                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Period</div>
                            <div className="font-semibold">{snapshot.meta.period}</div>
                        </div>

                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Window Ms</div>
                            <div className="font-semibold">
                                {formatMetricValue(snapshot.meta.window_ms)}
                            </div>
                        </div>

                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Start</div>
                            <div className="font-semibold">
                                {new Date(snapshot.meta.start_ms).toLocaleString()}
                            </div>
                        </div>

                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Asof</div>
                            <div className="font-semibold">
                                {new Date(snapshot.meta.asof_ms).toLocaleString()}
                            </div>
                        </div>

                        <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
                            <div className="opacity-70">Generated</div>
                            <div className="font-semibold">
                                {new Date(snapshot.meta.generated_ts_ms).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <MetricGridCard
                        title="Price"
                        block={snapshot.price as Record<string, unknown>}
                    />
                    <MetricGridCard
                        title="Totals"
                        block={snapshot.totals as Record<string, unknown>}
                    />
                    <MetricGridCard
                        title="Flow"
                        block={snapshot.flow as Record<string, unknown>}
                    />
                    <MetricGridCard
                        title="Impact"
                        block={snapshot.impact as Record<string, unknown>}
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="rounded shadow bg-white dark:bg-gray-800 p-3">
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={buildSeriesChart(
                                'Buy Volume',
                                snapshot.series.per_minute.buy_vol,
                            )}
                        />
                    </div>

                    <div className="rounded shadow bg-white dark:bg-gray-800 p-3">
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={buildSeriesChart(
                                'Sell Volume',
                                snapshot.series.per_minute.sell_vol,
                            )}
                        />
                    </div>

                    <div className="rounded shadow bg-white dark:bg-gray-800 p-3">
                        <HighchartsReact
                            highcharts={Highcharts}
                            options={buildSeriesChart(
                                'Trade Count',
                                snapshot.series.per_minute.trade_count,
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
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
        </div>
    );
}