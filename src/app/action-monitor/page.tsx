// /app/action-monitor/page.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import type {
    ActionMonitorEnvelope,
    ActionMonitorSnapshot,
    ActionMonitorMetricBlock,
    ActionMonitorCategory,
} from '@/types/actionMonitorTypes';

type MetricEntry = {
    key: string;
    value: string | number | boolean | null;
};

function formatMetricValue(value: string | number | boolean | null): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : String(value);

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
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function blockEntries(block: ActionMonitorMetricBlock): MetricEntry[] {
    return Object.entries(block || {}).map(([key, value]) => ({ key, value }));
}

function MetricGridCard({
                            title,
                            block,
                        }: {
    title: string;
    block: ActionMonitorMetricBlock;
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
                            <div className="text-[11px] opacity-70">{labelize(entry.key)}</div>
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
                            <td className="p-2">{row.rank}</td>
                            <td className="p-2">
                                {row.account_id.slice(0, 6)}...{row.account_id.slice(-5)}
                            </td>
                            <td className="p-2">{formatMetricValue(row.total_vol)}</td>
                            <td className="p-2">{formatMetricValue(row.total_trades)}</td>
                            <td className="p-2">
                                <div className="flex flex-wrap gap-1">
                                    {(row.prev_rank_badges || []).length === 0 ? (
                                        <span className="opacity-50">—</span>
                                    ) : (
                                        row.prev_rank_badges.map((badge, idx) => (
                                            <span
                                                key={`${row.account_id}-badge-${idx}`}
                                                className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700"
                                            >
                                                    {badge}
                                                </span>
                                        ))
                                    )}
                                </div>
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
                    <div className="text-xs opacity-70">{category.label}</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
                    Sort: {category.sort}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
                <MetricGridCard title="Totals" block={category.totals} />
                <MetricGridCard title="ROM" block={category.rom} />
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
                <div className="text-sm opacity-70">Waiting for Action Monitor snapshot...</div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 text-text dark:text-text-inverted">
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
                <MetricGridCard title="Price" block={snapshot.price} />
                <MetricGridCard title="Totals" block={snapshot.totals} />
                <MetricGridCard title="Flow" block={snapshot.flow} />
                <MetricGridCard title="Impact" block={snapshot.impact} />
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <CategoryCard title="MM Buyers" category={snapshot.categories.mm_buyers} />
                <CategoryCard title="MM Sellers" category={snapshot.categories.mm_sellers} />
                <CategoryCard title="Accumulators" category={snapshot.categories.accumulators} />
                <CategoryCard title="Distributors" category={snapshot.categories.distributors} />
            </div>
        </div>
    );
}
