// /src/app/admin-web/av2/status/Av2StatusClient.tsx
"use client";

import React, {
    useCallback,
    useEffect,
    useState,
} from "react";
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
    AdminAv2StatusResponse,
} from "@/lib/admin-web/api";

function displayValue(
    value: string | null | undefined
): string {
    if (!value) return "—";
    return value.replaceAll("_", " ");
}

function displayTs(
    value: number | null | undefined
): string {
    if (value == null) return "—";

    const date = new Date(value);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    const second = String(date.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function statusClass(status: string): string {
    switch (status) {
        case "running":
            return "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300";

        case "stale":
            return "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300";

        default:
            return "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
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
            <CardTitle>{title}</CardTitle>

            <span
                aria-hidden="true"
                className="shrink-0 text-lg leading-none text-gray-500 dark:text-gray-400"
            >
                {expanded ? "−" : "+"}
            </span>
        </button>
    );
}

export default function Av2StatusClient() {
    const { isAuthenticated, isReady } = useAdminSession();

    const [status, setStatus] =
        useState<AdminAv2StatusResponse | null>(null);

    const [loading, setLoading] = useState(false);

    const [error, setError] =
        useState<string | null>(null);

    const [
        activeTradesExpanded,
        setActiveTradesExpanded,
    ] = useState(true);

    const [
        agentsExpanded,
        setAgentsExpanded,
    ] = useState(false);

    const [
        eventsExpanded,
        setEventsExpanded,
    ] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!isReady || !isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            setStatus(
                await adminWebApi.av2Status()
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "failed_to_load_av2_status"
            );
        } finally {
            setLoading(false);
        }
    }, [isReady, isAuthenticated]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    return (
        <main className="flex flex-col gap-3">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <CardTitle>
                                    AV2 Status / Monitoring
                                </CardTitle>

                                <div className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                                    Observed UTC:{" "}
                                    {displayTs(
                                        status?.observed_ts_ms
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {error ? (
                            <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                {error}
                            </div>
                        ) : null}

                        {!error &&
                        loading &&
                        !status ? (
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                Loading AV2 status…
                            </div>
                        ) : null}

                        {status ? (
                            <div
                                className={`grid gap-2 ${
                                    status.workers.length >= 4
                                        ? "md:grid-cols-2 xl:grid-cols-4"
                                        : status.workers.length === 3
                                            ? "md:grid-cols-3"
                                            : "md:grid-cols-2"
                                }`}
                            >
                                {status.workers.map(
                                    (worker) => (
                                        <div
                                            key={worker.worker_id}
                                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/40"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="font-mono text-[11px] font-semibold md:text-xs">
                                                    {worker.worker_id}
                                                </div>

                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(
                                                        worker.status
                                                    )}`}
                                                >
                                                    {displayValue(
                                                        worker.status
                                                    )}
                                                </span>
                                            </div>

                                            <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-300 md:text-[11px]">
                                                Last Seen UTC:{" "}
                                                {displayTs(
                                                    worker.last_seen_ts_ms
                                                )}
                                            </div>

                                            {worker.detail ? (
                                                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                                    {worker.detail}
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                )}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {status ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CollapsibleHeader
                                    title={`Active Trades (${status.active_trades.length})`}
                                    expanded={
                                        activeTradesExpanded
                                    }
                                    onToggle={() =>
                                        setActiveTradesExpanded(
                                            (current) => !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {activeTradesExpanded ? (
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs md:text-sm">
                                            <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-800">
                                                <th className="py-2 pr-4 text-left">
                                                    Trade
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Agent
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Ticker
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Lifecycle
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Entry
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Protection
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Exit
                                                </th>
                                                <th className="py-2 pl-2 text-left">
                                                    Account
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {status.active_trades.map(
                                                (trade) => (
                                                    <tr
                                                        key={trade.trade_id}
                                                        className="border-b border-gray-100 dark:border-gray-800"
                                                    >
                                                        <td className="max-w-[220px] truncate py-2 pr-4 font-mono text-[11px]">
                                                            {trade.trade_id}
                                                        </td>

                                                        <td className="px-2 py-2 font-mono">
                                                            {trade.agent_id}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {trade.market_ticker ??
                                                                trade.ticker}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                trade.lifecycle_state
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                trade.entry_state
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                trade.protection_state
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                trade.exit_state
                                                            )}
                                                        </td>

                                                        <td className="py-2 pl-2">
                                                            {displayValue(
                                                                trade.account_type
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}

                                            {status.active_trades.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={8}
                                                        className="py-3 text-center text-xs text-gray-600 dark:text-gray-300"
                                                    >
                                                        No active AV2 trades.
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
                            <CardHeader>
                                <CollapsibleHeader
                                    title={`Agents (${status.agents.length})`}
                                    expanded={
                                        agentsExpanded
                                    }
                                    onToggle={() =>
                                        setAgentsExpanded(
                                            (current) => !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {agentsExpanded ? (
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs md:text-sm">
                                            <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-800">
                                                <th className="py-2 pr-4 text-left">
                                                    Agent
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Ticker
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Family
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Enabled
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Account
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Latest Signal
                                                </th>
                                                <th className="py-2 pl-2 text-left">
                                                    Evaluation UTC
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {status.agents.map(
                                                (agent) => (
                                                    <tr
                                                        key={agent.agent_id}
                                                        className="border-b border-gray-100 dark:border-gray-800"
                                                    >
                                                        <td className="py-2 pr-4 font-mono">
                                                            {agent.agent_id}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {agent.market_ticker ??
                                                                agent.ticker}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                agent.strategy_family
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {agent.enabled
                                                                ? "Yes"
                                                                : "No"}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                agent.account_type
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                agent.latest_signal_status
                                                            )}
                                                        </td>

                                                        <td className="whitespace-nowrap py-2 pl-2">
                                                            {displayTs(
                                                                agent.latest_evaluation_ts_ms
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            ) : null}
                        </Card>

                        <Card>
                            <CardHeader>
                                <CollapsibleHeader
                                    title={`Recent Operational Events (${status.recent_events.length})`}
                                    expanded={
                                        eventsExpanded
                                    }
                                    onToggle={() =>
                                        setEventsExpanded(
                                            (current) => !current
                                        )
                                    }
                                />
                            </CardHeader>

                            {eventsExpanded ? (
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs md:text-sm">
                                            <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-800">
                                                <th className="py-2 pr-4 text-left">
                                                    UTC
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Severity
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Event
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Agent
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Ticker
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                    Status
                                                </th>
                                                <th className="py-2 pl-2 text-left">
                                                    Reason / Message
                                                </th>
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {status.recent_events.map(
                                                (event, index) => (
                                                    <tr
                                                        key={`${event.event_ts_ms}-${event.event_type}-${index}`}
                                                        className="border-b border-gray-100 dark:border-gray-800"
                                                    >
                                                        <td className="whitespace-nowrap py-2 pr-4">
                                                            {displayTs(
                                                                event.event_ts_ms
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                event.severity
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                event.event_type
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2 font-mono">
                                                            {event.agent_id ??
                                                                "—"}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {event.market_ticker ??
                                                                event.ticker ??
                                                                "—"}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {displayValue(
                                                                event.status
                                                            )}
                                                        </td>

                                                        <td className="py-2 pl-2">
                                                            {event.reason ??
                                                                event.message ??
                                                                "—"}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            ) : null}
                        </Card>
                    </>
                ) : null}
            </AdminSessionGate>
        </main>
    );
}
