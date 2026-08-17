// /src/app/admin-web/av2/performance/Av2PerformanceClient.tsx
"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";
import {useAdminSession} from "@/components/admin-web/AdminSessionProvider";
import {
    adminWebApi,
    AdminAv2PerformanceParams,
    AdminAv2PerformanceResponse,
    AdminAv2PerformanceRow,
} from "@/lib/admin-web/api";

type RangeKey =
    | "today"
    | "7d"
    | "30d"
    | "90d"
    | "ytd"
    | "all"
    | "custom";

type SortKey =
    | "agent_id"
    | "ticker"
    | "strategy_family"
    | "net_pnl"
    | "gross_pnl"
    | "fees"
    | "trade_count"
    | "win_rate"
    | "avg_net_pnl_per_trade"
    | "change_vs_prior_period"
    | "latest_trade_ts_ms"
    | "suppression_count"
    | "failure_count";

type SortDirection = "asc" | "desc";

const ALL = "__all__";

function displayUtcTs(value: number | null | undefined): string {
    if (value == null) return "—";

    const d = new Date(value);

    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    const minute = String(d.getUTCMinutes()).padStart(2, "0");
    const second = String(d.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function utcInputValue(value: number): string {
    return new Date(value).toISOString().slice(0, 16);
}

function parseUtcInput(value: string): number | undefined {
    if (!value) return undefined;

    const parsed = Date.parse(`${value}:00Z`);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function utcDayStart(nowMs: number): number {
    const d = new Date(nowMs);

    return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        0,
        0,
        0,
        0
    );
}

function utcYearStart(nowMs: number): number {
    const d = new Date(nowMs);

    return Date.UTC(
        d.getUTCFullYear(),
        0,
        1,
        0,
        0,
        0,
        0
    );
}

function rangeParams(
    range: RangeKey,
    customStart: string,
    customEnd: string
): Pick<AdminAv2PerformanceParams, "start_ts_ms" | "end_ts_ms"> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    switch (range) {
        case "today":
            return {
                start_ts_ms: utcDayStart(now),
                end_ts_ms: now,
            };

        case "7d":
            return {
                start_ts_ms: now - 7 * dayMs,
                end_ts_ms: now,
            };

        case "30d":
            return {
                start_ts_ms: now - 30 * dayMs,
                end_ts_ms: now,
            };

        case "90d":
            return {
                start_ts_ms: now - 90 * dayMs,
                end_ts_ms: now,
            };

        case "ytd":
            return {
                start_ts_ms: utcYearStart(now),
                end_ts_ms: now,
            };

        case "custom":
            return {
                start_ts_ms: parseUtcInput(customStart),
                end_ts_ms: parseUtcInput(customEnd),
            };

        case "all":
        default:
            return {};
    }
}

function formatDecimal(
    value: string | number | null | undefined
): string {
    if (value == null) return "—";

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return String(value);
    }

    return parsed.toFixed(2);
}

function decimalAsChartNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function compareRows(
    a: AdminAv2PerformanceRow,
    b: AdminAv2PerformanceRow,
    key: SortKey
): number {
    switch (key) {
        case "net_pnl":
        case "gross_pnl":
        case "fees":
        case "win_rate":
        case "avg_net_pnl_per_trade":
        case "change_vs_prior_period":
            return (
                decimalAsChartNumber(a[key]) -
                decimalAsChartNumber(b[key])
            );

        case "trade_count":
        case "suppression_count":
        case "failure_count":
            return a[key] - b[key];

        case "latest_trade_ts_ms":
            return (
                (a.latest_trade_ts_ms ?? -1) -
                (b.latest_trade_ts_ms ?? -1)
            );

        case "agent_id":
        case "ticker":
        case "strategy_family":
        default:
            return String(a[key]).localeCompare(String(b[key]));
    }
}

function accountLabel(
    accountType: string,
    accountReference: string | null
): string {
    if (accountType === "main") return "Main";

    if (!accountReference) {
        return accountType.replaceAll("_", " ");
    }

    if (accountReference.length <= 18) {
        return accountReference;
    }

    return `${accountReference.slice(0, 10)}…${accountReference.slice(-6)}`;
}

function sortIndicator(
    activeKey: SortKey,
    key: SortKey,
    direction: SortDirection
): string {
    if (activeKey !== key) return "↕";
    return direction === "asc" ? "↑" : "↓";
}

export default function Av2PerformanceClient() {
    const {isAuthenticated, isReady} = useAdminSession();

    const [data, setData] =
        useState<AdminAv2PerformanceResponse | null>(null);

    const [range, setRange] = useState<RangeKey>("30d");

    const [customStart, setCustomStart] = useState(() =>
        utcInputValue(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const [customEnd, setCustomEnd] = useState(() =>
        utcInputValue(Date.now())
    );

    const [agentFilter, setAgentFilter] = useState(ALL);
    const [tickerFilter, setTickerFilter] = useState(ALL);
    const [familyFilter, setFamilyFilter] = useState(ALL);
    const [accountFilter, setAccountFilter] = useState(ALL);

    const [filterOptions, setFilterOptions] = useState<{
        agents: string[];
        tickers: string[];
        families: string[];
        accounts: Array<{
            value: string;
            label: string;
        }>;
    }>({
        agents: [],
        tickers: [],
        families: [],
        accounts: [],
    });

    const [sortKey, setSortKey] =
        useState<SortKey>("net_pnl");

    const [sortDirection, setSortDirection] =
        useState<SortDirection>("desc");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPerformance = useCallback(async () => {
        if (!isReady || !isAuthenticated) return;

        const timeParams = rangeParams(
            range,
            customStart,
            customEnd
        );

        if (
            range === "custom" &&
            (
                timeParams.start_ts_ms === undefined ||
                timeParams.end_ts_ms === undefined
            )
        ) {
            setError("Enter a valid custom UTC start and end time.");
            return;
        }

        if (
            range === "custom" &&
            timeParams.start_ts_ms !== undefined &&
            timeParams.end_ts_ms !== undefined &&
            timeParams.start_ts_ms >= timeParams.end_ts_ms
        ) {
            setError("Custom UTC start must be before custom UTC end.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params: AdminAv2PerformanceParams = {
                ...timeParams,
                agent_id:
                    agentFilter === ALL
                        ? undefined
                        : agentFilter,
                ticker:
                    tickerFilter === ALL
                        ? undefined
                        : tickerFilter,
                strategy_family:
                    familyFilter === ALL
                        ? undefined
                        : familyFilter,
                account_reference:
                    accountFilter === ALL
                        ? undefined
                        : accountFilter,
            };

            const payload =
                await adminWebApi.av2Performance(params);

            setData(payload);

            setFilterOptions((current) => {
                if (
                    current.agents.length > 0 ||
                    current.tickers.length > 0 ||
                    current.families.length > 0 ||
                    current.accounts.length > 0
                ) {
                    return current;
                }

                const agents = Array.from(
                    new Set(
                        payload.rows.map((row) => row.agent_id)
                    )
                ).sort();

                const tickers = Array.from(
                    new Set(
                        payload.rows.map(
                            (row) =>
                                row.market_ticker || row.ticker
                        )
                    )
                ).sort();

                const families = Array.from(
                    new Set(
                        payload.rows.map(
                            (row) => row.strategy_family
                        )
                    )
                ).sort();

                const accountMap = new Map<string, string>();

                payload.rows.forEach((row) => {
                    if (row.account_reference) {
                        accountMap.set(
                            row.account_reference,
                            accountLabel(
                                row.account_type,
                                row.account_reference
                            )
                        );
                    }
                });

                return {
                    agents,
                    tickers,
                    families,
                    accounts: Array.from(
                        accountMap.entries()
                    )
                        .map(([value, label]) => ({
                            value,
                            label,
                        }))
                        .sort((a, b) =>
                            a.label.localeCompare(b.label)
                        ),
                };
            });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "failed_to_load_av2_performance"
            );
        } finally {
            setLoading(false);
        }
    }, [
        isReady,
        isAuthenticated,
        range,
        customStart,
        customEnd,
        agentFilter,
        tickerFilter,
        familyFilter,
        accountFilter,
    ]);

    useEffect(() => {
        void loadPerformance();
    }, [loadPerformance]);

    const sortedRows = useMemo(() => {
        if (!data) return [];

        return [...data.rows].sort((a, b) => {
            const cmp = compareRows(a, b, sortKey);
            return sortDirection === "asc" ? cmp : -cmp;
        });
    }, [data, sortKey, sortDirection]);

    const cumulativeOptions =
        useMemo<Highcharts.Options>(
            () => ({
                chart: {
                    backgroundColor: "transparent",
                },
                title: {
                    text: undefined,
                },
                credits: {
                    enabled: false,
                },
                legend: {
                    enabled: false,
                },
                xAxis: {
                    type: "datetime",
                },
                yAxis: {
                    title: {
                        text: "Net PnL",
                    },
                    labels: {
                        formatter: function () {
                            return Number(this.value).toFixed(2);
                        },
                    },
                },
                tooltip: {
                    xDateFormat: "%Y-%m-%d %H:%M:%S",
                    valueDecimals: 2,
                },
                series: [
                    {
                        type: "line",
                        name: "Cumulative Net PnL",
                        data:
                            data?.cumulative_pnl_series.map(
                                (point) => [
                                    point.ts_ms,
                                    decimalAsChartNumber(
                                        point.net_pnl
                                    ),
                                ]
                            ) ?? [],
                    },
                ],
            }),
            [data]
        );

    const pnlOptions =
        useMemo<Highcharts.Options>(
            () => ({
                chart: {
                    backgroundColor: "transparent",
                },
                title: {
                    text: undefined,
                },
                credits: {
                    enabled: false,
                },
                legend: {
                    enabled: false,
                },
                xAxis: {
                    type: "datetime",
                },
                yAxis: {
                    title: {
                        text: "Net PnL",
                    },
                    labels: {
                        formatter: function () {
                            return Number(this.value).toFixed(2);
                        },
                    },
                },
                tooltip: {
                    xDateFormat: "%Y-%m-%d %H:%M:%S",
                    valueDecimals: 2,
                },
                series: [
                    {
                        type: "column",
                        name: "Realized Net PnL",
                        data:
                            data?.pnl_series.map(
                                (point) => [
                                    point.ts_ms,
                                    decimalAsChartNumber(
                                        point.net_pnl
                                    ),
                                ]
                            ) ?? [],
                    },
                ],
            }),
            [data]
        );

    function handleSort(nextKey: SortKey) {
        if (nextKey === sortKey) {
            setSortDirection((current) =>
                current === "asc" ? "desc" : "asc"
            );
            return;
        }

        setSortKey(nextKey);
        setSortDirection("desc");
    }

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex w-full flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <CardTitle>
                                        AV2 Performance Reporting
                                    </CardTitle>
                                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                        Backend-authoritative realized AV2 trade performance.
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        void loadPerformance()
                                    }
                                    disabled={loading}
                                    className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                                >
                                    {loading
                                        ? "Loading…"
                                        : "Reload"}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        ["today", "Today"],
                                        ["7d", "7D"],
                                        ["30d", "30D"],
                                        ["90d", "90D"],
                                        ["ytd", "YTD"],
                                        ["all", "All Time"],
                                        ["custom", "Custom"],
                                    ] as Array<
                                        [RangeKey, string]
                                    >
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() =>
                                            setRange(value)
                                        }
                                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                            range === value
                                                ? "border-primary-dark bg-primary text-black dark:border-primary dark:bg-primary-dark dark:text-white"
                                                : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-4">
                            {range === "custom" ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="text-sm">
                                        <span className="mb-1 block font-medium">
                                            Start UTC
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={customStart}
                                            onChange={(event) =>
                                                setCustomStart(
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                        />
                                    </label>

                                    <label className="text-sm">
                                        <span className="mb-1 block font-medium">
                                            End UTC
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={customEnd}
                                            onChange={(event) =>
                                                setCustomEnd(
                                                    event.target.value
                                                )
                                            }
                                            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                        />
                                    </label>
                                </div>
                            ) : null}

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                        Agent
                                    </span>
                                    <select
                                        value={agentFilter}
                                        onChange={(event) =>
                                            setAgentFilter(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option value={ALL}>
                                            All Agents
                                        </option>
                                        {filterOptions.agents.map(
                                            (value) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {value}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                        Ticker
                                    </span>
                                    <select
                                        value={tickerFilter}
                                        onChange={(event) =>
                                            setTickerFilter(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option value={ALL}>
                                            All Tickers
                                        </option>
                                        {filterOptions.tickers.map(
                                            (value) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {value}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                        Strategy Family
                                    </span>
                                    <select
                                        value={familyFilter}
                                        onChange={(event) =>
                                            setFamilyFilter(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option value={ALL}>
                                            All Families
                                        </option>
                                        {filterOptions.families.map(
                                            (value) => (
                                                <option
                                                    key={value}
                                                    value={value}
                                                >
                                                    {value}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">
                                        Subaccount
                                    </span>
                                    <select
                                        value={accountFilter}
                                        onChange={(event) =>
                                            setAccountFilter(
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option value={ALL}>
                                            All Accounts
                                        </option>
                                        {filterOptions.accounts.map(
                                            (account) => (
                                                <option
                                                    key={account.value}
                                                    value={account.value}
                                                >
                                                    {account.label}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>
                            </div>

                            {error ? (
                                <div
                                    className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    {error}
                                </div>
                            ) : null}

                            {data ? (
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                    Selected UTC window:{" "}
                                    {displayUtcTs(
                                        data.start_ts_ms
                                    )}{" "}
                                    →{" "}
                                    {displayUtcTs(
                                        data.end_ts_ms
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                {data ? (
                    <>
                        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                            {[
                                [
                                    "Net PnL",
                                    formatDecimal(
                                        data.summary.net_pnl
                                    ),
                                ],
                                [
                                    "Gross PnL",
                                    formatDecimal(
                                        data.summary.gross_pnl
                                    ),
                                ],
                                [
                                    "Fees",
                                    formatDecimal(
                                        data.summary.fees
                                    ),
                                ],
                                [
                                    "Trades",
                                    String(
                                        data.summary.trade_count
                                    ),
                                ],
                                [
                                    "Win Rate",
                                    `${formatDecimal(
                                        data.summary.win_rate
                                    )}%`,
                                ],
                                [
                                    "Avg Net / Trade",
                                    formatDecimal(
                                        data.summary
                                            .avg_net_pnl_per_trade
                                    ),
                                ],
                            ].map(([label, value]) => (
                                <Card key={label}>
                                    <CardContent className="pt-3">
                                        <div className="text-xs text-gray-600 dark:text-gray-300">
                                            {label}
                                        </div>
                                        <div className="mt-1 text-lg font-semibold">
                                            {value}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>

                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardContent className="pt-3">
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        Qualified Signals
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {
                                            data.opportunity
                                                .qualified_signals
                                        }
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-3">
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        Executed Trades
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {
                                            data.opportunity
                                                .executed_trades
                                        }
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-3">
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        Suppressed
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {
                                            data.opportunity
                                                .suppressed
                                        }
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-3">
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        Failed
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {data.opportunity.failed}
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="grid gap-4 xl:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Current vs Prior Window
                                    </CardTitle>
                                </CardHeader>

                                <CardContent>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Current Net PnL
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .net_pnl
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Prior Net PnL
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.comparison
                                                        .net_pnl
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Prior Trades
                                            </div>
                                            <div className="font-semibold">
                                                {
                                                    data.comparison
                                                        .trade_count
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Prior Win Rate
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.comparison
                                                        .win_rate
                                                )}
                                                %
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Prior Avg Net / Trade
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.comparison
                                                        .avg_net_pnl_per_trade
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Prior Fees
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.comparison
                                                        .fees
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Additional Metrics
                                    </CardTitle>
                                </CardHeader>

                                <CardContent>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Drawdown
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .drawdown
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Expectancy
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .expectancy
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Average Win
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .average_win
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Average Loss
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .average_loss
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                                Payoff Ratio
                                            </div>
                                            <div className="font-semibold">
                                                {formatDecimal(
                                                    data.summary
                                                        .payoff_ratio
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Cumulative Net PnL
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={cumulativeOptions}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Realized Net PnL
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={pnlOptions}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Agent Performance
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            {[
                                                [
                                                    "agent_id",
                                                    "Agent",
                                                ],
                                                [
                                                    "ticker",
                                                    "Ticker",
                                                ],
                                                [
                                                    "strategy_family",
                                                    "Family",
                                                ],
                                                [
                                                    "net_pnl",
                                                    "Net PnL",
                                                ],
                                                [
                                                    "gross_pnl",
                                                    "Gross PnL",
                                                ],
                                                [
                                                    "fees",
                                                    "Fees",
                                                ],
                                                [
                                                    "trade_count",
                                                    "Trades",
                                                ],
                                                [
                                                    "win_rate",
                                                    "Win Rate",
                                                ],
                                                [
                                                    "avg_net_pnl_per_trade",
                                                    "Avg Net",
                                                ],
                                                [
                                                    "change_vs_prior_period",
                                                    "Change",
                                                ],
                                                [
                                                    "suppression_count",
                                                    "Suppressed",
                                                ],
                                                [
                                                    "failure_count",
                                                    "Failed",
                                                ],
                                                [
                                                    "latest_trade_ts_ms",
                                                    "Latest Trade UTC",
                                                ],
                                            ].map(
                                                ([
                                                     key,
                                                     label,
                                                 ]) => (
                                                    <th
                                                        key={key}
                                                        className="px-2 py-2 text-left font-semibold"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleSort(
                                                                    key as SortKey
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 hover:underline"
                                                        >
                                                                <span>
                                                                    {
                                                                        label
                                                                    }
                                                                </span>
                                                            <span>
                                                                    {sortIndicator(
                                                                        sortKey,
                                                                        key as SortKey,
                                                                        sortDirection
                                                                    )}
                                                                </span>
                                                        </button>
                                                    </th>
                                                )
                                            )}
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {sortedRows.map(
                                            (row) => (
                                                <tr
                                                    key={`${row.agent_id}-${row.account_reference ?? "main"}`}
                                                    className="border-b border-gray-100 dark:border-gray-800"
                                                >
                                                    <td className="px-2 py-2 font-mono">
                                                        {
                                                            row.agent_id
                                                        }
                                                    </td>

                                                    <td className="px-2 py-2">
                                                        {row.market_ticker ||
                                                            row.ticker}
                                                    </td>

                                                    <td className="px-2 py-2">
                                                        {
                                                            row.strategy_family
                                                        }
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.net_pnl
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.gross_pnl
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.fees
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {
                                                            row.trade_count
                                                        }
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.win_rate
                                                        )}
                                                        %
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.avg_net_pnl_per_trade
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {formatDecimal(
                                                            row.change_vs_prior_period
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {
                                                            row.suppression_count
                                                        }
                                                    </td>

                                                    <td className="px-2 py-2 text-right">
                                                        {
                                                            row.failure_count
                                                        }
                                                    </td>

                                                    <td className="px-2 py-2 whitespace-nowrap">
                                                        {displayUtcTs(
                                                            row.latest_trade_ts_ms
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}

                                        {sortedRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={13}
                                                    className="py-4 text-center text-gray-600 dark:text-gray-300"
                                                >
                                                    No AV2 performance rows were returned for the selected filters.
                                                </td>
                                            </tr>
                                        ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </AdminSessionGate>
        </main>
    );
}
