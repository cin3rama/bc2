// /app/action-monitor/page.tsx
'use client';

import {useEffect, useMemo, useState} from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {useWebsocket} from '@/hooks/useWebsocket';
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
            entries.push({key: nextKey, value});
            return;
        }

        if (Array.isArray(value)) {
            entries.push({key: nextKey, value: JSON.stringify(value)});
            return;
        }

        if (typeof value === 'object') {
            entries.push(
                ...flattenMetricEntries(value as Record<string, unknown>, nextKey),
            );
            return;
        }

        entries.push({key: nextKey, value: String(value)});
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
                            <td className="p-2">—</td>
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
                </div>

                <div
                    className="text-[11px] px-2 py-1 rounded-full bg-primary-light text-black dark:bg-primary-dark dark:text-text-inverted">
                    Sort: {String(category.sort)}
                </div>
            </div>

            {/* KEEP totals/rom for now (will move later) */}
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
                <ParticipantTable participants={category.participants}/>
            </div>
        </div>
    );
}

export default function ActionMonitorPage() {
    const {actionMonitor$} = useWebsocket();

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

    return (
        <div
            className="p-4 space-y-4 text-text dark:text-text-inverted"
            style={
                {
                    ['--am-chart-line' as string]: chartAccent,
                    ['--am-chart-grid' as string]: chartAccent,
                    ['--am-chart-text' as string]: chartAccent,
                } as React.CSSProperties
            }
        >
            {/* HEADER */}
            <div className="rounded shadow bg-white dark:bg-gray-800 p-4">
                <div className="flex justify-between">
                    <h1 className="text-xl font-bold">Action Monitor</h1>
                    <div className="text-xs">
                        {isConnected ? 'Live' : 'Disconnected'}
                    </div>
                </div>

                {/* META ROW */}
                <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                    <div>
                        <div className="opacity-70">Ticker</div>
                        <div>{snapshot.meta.ticker}</div>
                    </div>
                    <div>
                        <div className="opacity-70">Period</div>
                        <div>{snapshot.meta.period}</div>
                    </div>
                    <div>
                        <div className="opacity-70">Window</div>
                        <div>{snapshot.meta.window_ms}</div>
                    </div>
                </div>
            </div>

            {/* PRICE ROW */}
            <MetricGridCard
                title="Price"
                block={snapshot.price as Record<string, unknown>}
            />

            {/* FLOW + IMPACT ONLY */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <MetricGridCard
                    title="Flow"
                    block={snapshot.flow as Record<string, unknown>}
                />
                <MetricGridCard
                    title="Impact"
                    block={snapshot.impact as Record<string, unknown>}
                />
            </div>

            {/* CATEGORIES */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                <CategoryCard title="MM Buyers" category={snapshot.categories.mm_buyers}/>
                <CategoryCard title="MM Sellers" category={snapshot.categories.mm_sellers}/>
                <CategoryCard title="Accumulators" category={snapshot.categories.accumulators}/>
                <CategoryCard title="Distributors" category={snapshot.categories.distributors}/>
            </div>
        </div>
    );
}
