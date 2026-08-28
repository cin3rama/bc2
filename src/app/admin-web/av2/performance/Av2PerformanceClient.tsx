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
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
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

const FUTURE_TICKER_OPTIONS = [
    "HYPE-USD",
    "SOL-USD",
];

function displayUtcTs(
    value: number | null | undefined
): string {
    if (value == null) return "—";

    const d = new Date(value);

    const year = d.getUTCFullYear();
    const month = String(
        d.getUTCMonth() + 1
    ).padStart(2, "0");
    const day = String(
        d.getUTCDate()
    ).padStart(2, "0");
    const hour = String(
        d.getUTCHours()
    ).padStart(2, "0");
    const minute = String(
        d.getUTCMinutes()
    ).padStart(2, "0");
    const second = String(
        d.getUTCSeconds()
    ).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function utcInputValue(value: number): string {
    return new Date(value)
        .toISOString()
        .slice(0, 16);
}

function parseUtcInput(
    value: string
): number | undefined {
    if (!value) return undefined;

    const parsed = Date.parse(
        `${value}:00Z`
    );

    return Number.isFinite(parsed)
        ? parsed
        : undefined;
}

function utcDayStart(
    nowMs: number
): number {
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

function utcYearStart(
    nowMs: number
): number {
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
): Pick<
    AdminAv2PerformanceParams,
    "start_ts_ms" | "end_ts_ms"
> {
    const now = Date.now();
    const dayMs =
        24 * 60 * 60 * 1000;

    switch (range) {
        case "today":
            return {
                start_ts_ms:
                    utcDayStart(now),
                end_ts_ms: now,
            };

        case "7d":
            return {
                start_ts_ms:
                    now - 7 * dayMs,
                end_ts_ms: now,
            };

        case "30d":
            return {
                start_ts_ms:
                    now - 30 * dayMs,
                end_ts_ms: now,
            };

        case "90d":
            return {
                start_ts_ms:
                    now - 90 * dayMs,
                end_ts_ms: now,
            };

        case "ytd":
            return {
                start_ts_ms:
                    utcYearStart(now),
                end_ts_ms: now,
            };

        case "custom":
            return {
                start_ts_ms:
                    parseUtcInput(
                        customStart
                    ),
                end_ts_ms:
                    parseUtcInput(
                        customEnd
                    ),
            };

        case "all":
        default:
            return {};
    }
}

function formatDecimal(
    value:
        | string
        | number
        | null
        | undefined
): string {
    if (value == null) return "—";

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return String(value);
    }

    return parsed.toFixed(2);
}

function decimalAsChartNumber(
    value: string
): number {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
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
                decimalAsChartNumber(
                    a[key]
                ) -
                decimalAsChartNumber(
                    b[key]
                )
            );

        case "trade_count":
        case "suppression_count":
        case "failure_count":
            return (
                a[key] - b[key]
            );

        case "latest_trade_ts_ms":
            return (
                (a.latest_trade_ts_ms ??
                    -1) -
                (b.latest_trade_ts_ms ??
                    -1)
            );

        case "agent_id":
        case "ticker":
        case "strategy_family":
        default:
            return String(
                a[key]
            ).localeCompare(
                String(b[key])
            );
    }
}

function accountLabel(
    accountType: string,
    accountReference: string | null
): string {
    if (
        accountType === "main"
    ) {
        return "Main";
    }

    if (!accountReference) {
        return accountType.replaceAll(
            "_",
            " "
        );
    }

    if (
        accountReference.length <=
        18
    ) {
        return accountReference;
    }

    return `${accountReference.slice(
        0,
        10
    )}…${accountReference.slice(-6)}`;
}

function sortIndicator(
    activeKey: SortKey,
    key: SortKey,
    direction: SortDirection
): string {
    if (activeKey !== key) {
        return "↕";
    }

    return direction === "asc"
        ? "↑"
        : "↓";
}

function CollapsibleHeader({
                               title,
                               expanded,
                               onToggle,
                           }: {
    title: string;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-3 text-left"
        >
            <CardTitle>
                {title}
            </CardTitle>

            <span
                aria-hidden="true"
                className="shrink-0 text-lg leading-none text-gray-500 dark:text-gray-400"
            >
                {expanded
                    ? "−"
                    : "+"}
            </span>
        </button>
    );
}

function CompactMetric({
                           label,
                           value,
                       }: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 md:text-[11px]">
                {label}
            </div>

            <div className="mt-0.5 text-sm font-semibold leading-tight md:text-base">
                {value}
            </div>
        </div>
    );
}

export default function Av2PerformanceClient() {
    const {
        isAuthenticated,
        isReady,
    } = useAdminSession();

    const [data, setData] =
        useState<AdminAv2PerformanceResponse | null>(
            null
        );

    const [range, setRange] =
        useState<RangeKey>("30d");

    const [
        customStart,
        setCustomStart,
    ] = useState(() =>
        utcInputValue(
            Date.now() -
            30 *
            24 *
            60 *
            60 *
            1000
        )
    );

    const [
        customEnd,
        setCustomEnd,
    ] = useState(() =>
        utcInputValue(Date.now())
    );

    const [
        agentFilter,
        setAgentFilter,
    ] = useState(ALL);

    const [
        tickerFilter,
        setTickerFilter,
    ] = useState(ALL);

    const [
        familyFilter,
        setFamilyFilter,
    ] = useState(ALL);

    const [
        accountFilter,
        setAccountFilter,
    ] = useState(ALL);

    const [
        filterOptions,
        setFilterOptions,
    ] = useState<{
        agents: string[];
        tickers: string[];
        families: string[];
        accounts: Array<{
            value: string;
            label: string;
        }>;
    }>({
        agents: [],
        tickers: [
            ...FUTURE_TICKER_OPTIONS,
        ],
        families: [],
        accounts: [],
    });

    const [
        sortKey,
        setSortKey,
    ] = useState<SortKey>(
        "net_pnl"
    );

    const [
        sortDirection,
        setSortDirection,
    ] = useState<SortDirection>(
        "desc"
    );

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<string | null>(
        null
    );

    const [
        agentPerformanceExpanded,
        setAgentPerformanceExpanded,
    ] = useState(true);

    const [
        totalsExpanded,
        setTotalsExpanded,
    ] = useState(true);

    const [
        cumulativeExpanded,
        setCumulativeExpanded,
    ] = useState(false);

    const [
        realizedExpanded,
        setRealizedExpanded,
    ] = useState(false);

    const loadPerformance =
        useCallback(async () => {
            if (
                !isReady ||
                !isAuthenticated
            ) {
                return;
            }

            const timeParams =
                rangeParams(
                    range,
                    customStart,
                    customEnd
                );

            if (
                range === "custom" &&
                (
                    timeParams.start_ts_ms ===
                    undefined ||
                    timeParams.end_ts_ms ===
                    undefined
                )
            ) {
                setError(
                    "Enter a valid custom UTC start and end time."
                );
                return;
            }

            if (
                range === "custom" &&
                timeParams.start_ts_ms !==
                undefined &&
                timeParams.end_ts_ms !==
                undefined &&
                timeParams.start_ts_ms >=
                timeParams.end_ts_ms
            ) {
                setError(
                    "Custom UTC start must be before custom UTC end."
                );
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const params: AdminAv2PerformanceParams =
                    {
                        ...timeParams,

                        agent_id:
                            agentFilter ===
                            ALL
                                ? undefined
                                : agentFilter,

                        ticker:
                            tickerFilter ===
                            ALL
                                ? undefined
                                : tickerFilter,

                        strategy_family:
                            familyFilter ===
                            ALL
                                ? undefined
                                : familyFilter,

                        account_reference:
                            accountFilter ===
                            ALL
                                ? undefined
                                : accountFilter,
                    };

                const payload =
                    await adminWebApi.av2Performance(
                        params
                    );

                setData(payload);

                setFilterOptions(
                    (current) => {
                        const agents =
                            Array.from(
                                new Set([
                                    ...current.agents,
                                    ...payload.rows.map(
                                        (
                                            row
                                        ) =>
                                            row.agent_id
                                    ),
                                ])
                            ).sort();

                        const tickers =
                            Array.from(
                                new Set([
                                    ...current.tickers,
                                    ...FUTURE_TICKER_OPTIONS,
                                    ...payload.rows.map(
                                        (
                                            row
                                        ) =>
                                            row.market_ticker ||
                                            row.ticker
                                    ),
                                ])
                            ).sort();

                        const families =
                            Array.from(
                                new Set([
                                    ...current.families,
                                    ...payload.rows.map(
                                        (
                                            row
                                        ) =>
                                            row.strategy_family
                                    ),
                                ])
                            ).sort();

                        const accountMap =
                            new Map<
                                string,
                                string
                            >();

                        current.accounts.forEach(
                            (
                                account
                            ) => {
                                accountMap.set(
                                    account.value,
                                    account.label
                                );
                            }
                        );

                        payload.rows.forEach(
                            (row) => {
                                if (
                                    row.account_reference
                                ) {
                                    accountMap.set(
                                        row.account_reference,
                                        accountLabel(
                                            row.account_type,
                                            row.account_reference
                                        )
                                    );
                                }
                            }
                        );

                        return {
                            agents,
                            tickers,
                            families,
                            accounts:
                                Array.from(
                                    accountMap.entries()
                                )
                                    .map(
                                        ([
                                             value,
                                             label,
                                         ]) => ({
                                            value,
                                            label,
                                        })
                                    )
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            a.label.localeCompare(
                                                b.label
                                            )
                                    ),
                        };
                    }
                );
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

    const sortedRows =
        useMemo(() => {
            if (!data) {
                return [];
            }

            return [
                ...data.rows,
            ].sort((a, b) => {
                const cmp =
                    compareRows(
                        a,
                        b,
                        sortKey
                    );

                return sortDirection ===
                "asc"
                    ? cmp
                    : -cmp;
            });
        }, [
            data,
            sortKey,
            sortDirection,
        ]);

    const cumulativeOptions =
        useMemo<Highcharts.Options>(
            () => ({
                chart: {
                    backgroundColor:
                        "transparent",
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
                        formatter:
                            function () {
                                return Number(
                                    this
                                        .value
                                ).toFixed(
                                    2
                                );
                            },
                    },
                },

                tooltip: {
                    xDateFormat:
                        "%Y-%m-%d %H:%M:%S",
                    valueDecimals: 2,
                },

                series: [
                    {
                        type: "line",
                        name: "Cumulative Net PnL",

                        data:
                            data?.cumulative_pnl_series.map(
                                (
                                    point
                                ) => [
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
                    backgroundColor:
                        "transparent",
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
                        formatter:
                            function () {
                                return Number(
                                    this
                                        .value
                                ).toFixed(
                                    2
                                );
                            },
                    },
                },

                tooltip: {
                    xDateFormat:
                        "%Y-%m-%d %H:%M:%S",
                    valueDecimals: 2,
                },

                series: [
                    {
                        type: "column",
                        name: "Realized Net PnL",

                        data:
                            data?.pnl_series.map(
                                (
                                    point
                                ) => [
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

    function handleSort(
        nextKey: SortKey
    ) {
        if (
            nextKey === sortKey
        ) {
            setSortDirection(
                (current) =>
                    current === "asc"
                        ? "desc"
                        : "asc"
            );

            return;
        }

        setSortKey(nextKey);
        setSortDirection(
            "desc"
        );
    }

    return (
        <main className="flex flex-col gap-3">
            <AdminSessionGate>
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex w-full flex-col gap-2">
                            <div>
                                <CardTitle>
                                    AV2 Performance Reporting
                                </CardTitle>

                                <div className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                                    Backend-authoritative realized AV2 trade performance.
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {(
                                    [
                                        [
                                            "today",
                                            "Today",
                                        ],
                                        [
                                            "7d",
                                            "7D",
                                        ],
                                        [
                                            "30d",
                                            "30D",
                                        ],
                                        [
                                            "90d",
                                            "90D",
                                        ],
                                        [
                                            "ytd",
                                            "YTD",
                                        ],
                                        [
                                            "all",
                                            "All Time",
                                        ],
                                        [
                                            "custom",
                                            "Custom",
                                        ],
                                    ] as Array<
                                        [
                                            RangeKey,
                                            string
                                        ]
                                    >
                                ).map(
                                    ([
                                         value,
                                         label,
                                     ]) => (
                                        <button
                                            key={
                                                value
                                            }
                                            type="button"
                                            onClick={() =>
                                                setRange(
                                                    value
                                                )
                                            }
                                            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium md:text-[11px] ${
                                                range ===
                                                value
                                                    ? "border-primary-dark bg-primary text-black dark:border-primary dark:bg-primary-dark dark:text-white"
                                                    : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                            }`}
                                        >
                                            {
                                                label
                                            }
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="space-y-2">
                            {range ===
                            "custom" ? (
                                <div className="grid gap-2 md:grid-cols-2">
                                    <label className="text-xs">
                                        <span className="mb-1 block font-medium">
                                            Start UTC
                                        </span>

                                        <input
                                            type="datetime-local"
                                            value={
                                                customStart
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setCustomStart(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                        />
                                    </label>

                                    <label className="text-xs">
                                        <span className="mb-1 block font-medium">
                                            End UTC
                                        </span>

                                        <input
                                            type="datetime-local"
                                            value={
                                                customEnd
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setCustomEnd(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                        />
                                    </label>
                                </div>
                            ) : null}

                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                <label className="text-xs">
                                    <span className="mb-1 block font-medium">
                                        Agent
                                    </span>

                                    <select
                                        value={
                                            agentFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setAgentFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option
                                            value={
                                                ALL
                                            }
                                        >
                                            All Agents
                                        </option>

                                        {filterOptions.agents.map(
                                            (
                                                value
                                            ) => (
                                                <option
                                                    key={
                                                        value
                                                    }
                                                    value={
                                                        value
                                                    }
                                                >
                                                    {
                                                        value
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-xs">
                                    <span className="mb-1 block font-medium">
                                        Ticker
                                    </span>

                                    <select
                                        value={
                                            tickerFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setTickerFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option
                                            value={
                                                ALL
                                            }
                                        >
                                            All Tickers
                                        </option>

                                        {filterOptions.tickers.map(
                                            (
                                                value
                                            ) => (
                                                <option
                                                    key={
                                                        value
                                                    }
                                                    value={
                                                        value
                                                    }
                                                >
                                                    {
                                                        value
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-xs">
                                    <span className="mb-1 block font-medium">
                                        Strategy Family
                                    </span>

                                    <select
                                        value={
                                            familyFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setFamilyFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option
                                            value={
                                                ALL
                                            }
                                        >
                                            All Families
                                        </option>

                                        {filterOptions.families.map(
                                            (
                                                value
                                            ) => (
                                                <option
                                                    key={
                                                        value
                                                    }
                                                    value={
                                                        value
                                                    }
                                                >
                                                    {
                                                        value
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>

                                <label className="text-xs">
                                    <span className="mb-1 block font-medium">
                                        Subaccount
                                    </span>

                                    <select
                                        value={
                                            accountFilter
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setAccountFilter(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                                    >
                                        <option
                                            value={
                                                ALL
                                            }
                                        >
                                            All Accounts
                                        </option>

                                        {filterOptions.accounts.map(
                                            (
                                                account
                                            ) => (
                                                <option
                                                    key={
                                                        account.value
                                                    }
                                                    value={
                                                        account.value
                                                    }
                                                >
                                                    {
                                                        account.label
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </label>
                            </div>

                            {error ? (
                                <div className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    {
                                        error
                                    }
                                </div>
                            ) : null}

                            {data ? (
                                <div className="text-[10px] text-gray-600 dark:text-gray-300 md:text-[11px]">
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
                        <Card>
                            <CardHeader className="py-3">
                                <CollapsibleHeader
                                    title={`Agent Performance (${data.rows.length})`}
                                    expanded={
                                        agentPerformanceExpanded
                                    }
                                    onToggle={() =>
                                        setAgentPerformanceExpanded(
                                            (
                                                current
                                            ) =>
                                                !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {agentPerformanceExpanded ? (
                                <CardContent className="pt-0">
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
                                                            key={
                                                                key
                                                            }
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
                                                (
                                                    row
                                                ) => (
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

                                                        <td className="whitespace-nowrap px-2 py-2">
                                                            {displayUtcTs(
                                                                row.latest_trade_ts_ms
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}

                                            {sortedRows.length ===
                                            0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={
                                                            13
                                                        }
                                                        className="py-3 text-center text-xs text-gray-600 dark:text-gray-300"
                                                    >
                                                        No AV2 performance rows were returned for the selected filters.
                                                    </td>
                                                </tr>
                                            ) : null}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            ) : null}
                        </Card>

                        <Card>
                            <CardHeader className="py-3">
                                <CollapsibleHeader
                                    title="Totals"
                                    expanded={
                                        totalsExpanded
                                    }
                                    onToggle={() =>
                                        setTotalsExpanded(
                                            (
                                                current
                                            ) =>
                                                !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {totalsExpanded ? (
                                <CardContent className="space-y-3 pt-0">
                                    <div className="grid gap-x-4 gap-y-2 border-b border-gray-200 pb-3 sm:grid-cols-3 xl:grid-cols-6 dark:border-gray-800">
                                        <CompactMetric
                                            label="Net PnL"
                                            value={formatDecimal(
                                                data.summary
                                                    .net_pnl
                                            )}
                                        />

                                        <CompactMetric
                                            label="Gross PnL"
                                            value={formatDecimal(
                                                data.summary
                                                    .gross_pnl
                                            )}
                                        />

                                        <CompactMetric
                                            label="Fees"
                                            value={formatDecimal(
                                                data.summary
                                                    .fees
                                            )}
                                        />

                                        <CompactMetric
                                            label="Trades"
                                            value={
                                                data.summary
                                                    .trade_count
                                            }
                                        />

                                        <CompactMetric
                                            label="Win Rate"
                                            value={`${formatDecimal(
                                                data.summary
                                                    .win_rate
                                            )}%`}
                                        />

                                        <CompactMetric
                                            label="Avg Net / Trade"
                                            value={formatDecimal(
                                                data.summary
                                                    .avg_net_pnl_per_trade
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-x-4 gap-y-2 border-b border-gray-200 pb-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
                                        <CompactMetric
                                            label="Qualified Signals"
                                            value={
                                                data.opportunity
                                                    .qualified_signals
                                            }
                                        />

                                        <CompactMetric
                                            label="Executed Trades"
                                            value={
                                                data.opportunity
                                                    .executed_trades
                                            }
                                        />

                                        <CompactMetric
                                            label="Suppressed"
                                            value={
                                                data.opportunity
                                                    .suppressed
                                            }
                                        />

                                        <CompactMetric
                                            label="Failed"
                                            value={
                                                data.opportunity
                                                    .failed
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-3 xl:grid-cols-2">
                                        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                                            <div className="mb-2 text-sm font-semibold">
                                                Current vs Prior Window
                                            </div>

                                            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                                                <CompactMetric
                                                    label="Current Net PnL"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .net_pnl
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Prior Net PnL"
                                                    value={formatDecimal(
                                                        data.comparison
                                                            .net_pnl
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Prior Trades"
                                                    value={
                                                        data.comparison
                                                            .trade_count
                                                    }
                                                />

                                                <CompactMetric
                                                    label="Prior Win Rate"
                                                    value={`${formatDecimal(
                                                        data.comparison
                                                            .win_rate
                                                    )}%`}
                                                />

                                                <CompactMetric
                                                    label="Prior Avg Net / Trade"
                                                    value={formatDecimal(
                                                        data.comparison
                                                            .avg_net_pnl_per_trade
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Prior Fees"
                                                    value={formatDecimal(
                                                        data.comparison
                                                            .fees
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                                            <div className="mb-2 text-sm font-semibold">
                                                Additional Metrics
                                            </div>

                                            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                                                <CompactMetric
                                                    label="Drawdown"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .drawdown
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Expectancy"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .expectancy
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Average Win"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .average_win
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Average Loss"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .average_loss
                                                    )}
                                                />

                                                <CompactMetric
                                                    label="Payoff Ratio"
                                                    value={formatDecimal(
                                                        data.summary
                                                            .payoff_ratio
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            ) : null}
                        </Card>

                        <Card>
                            <CardHeader className="py-3">
                                <CollapsibleHeader
                                    title="Cumulative Net PnL"
                                    expanded={
                                        cumulativeExpanded
                                    }
                                    onToggle={() =>
                                        setCumulativeExpanded(
                                            (
                                                current
                                            ) =>
                                                !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {cumulativeExpanded ? (
                                <CardContent className="pt-0">
                                    <HighchartsReact
                                        highcharts={
                                            Highcharts
                                        }
                                        options={
                                            cumulativeOptions
                                        }
                                    />
                                </CardContent>
                            ) : null}
                        </Card>

                        <Card>
                            <CardHeader className="py-3">
                                <CollapsibleHeader
                                    title="Realized Net PnL"
                                    expanded={
                                        realizedExpanded
                                    }
                                    onToggle={() =>
                                        setRealizedExpanded(
                                            (
                                                current
                                            ) =>
                                                !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {realizedExpanded ? (
                                <CardContent className="pt-0">
                                    <HighchartsReact
                                        highcharts={
                                            Highcharts
                                        }
                                        options={
                                            pnlOptions
                                        }
                                    />
                                </CardContent>
                            ) : null}
                        </Card>
                    </>
                ) : null}
            </AdminSessionGate>
        </main>
    );
}
