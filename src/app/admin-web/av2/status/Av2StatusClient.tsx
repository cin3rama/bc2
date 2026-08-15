// /src/app/admin-web/av2/status/Av2StatusClient.tsx
"use client";

import React, {useCallback, useEffect, useState} from "react";
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
    AdminAv2StatusResponse,
} from "@/lib/admin-web/api";

function displayValue(value: string | null | undefined): string {
    if (!value) return "—";
    return value.replaceAll("_", " ");
}

function displayTs(value: number | null | undefined): string {
    if (value == null) return "—";

    return new Date(value).toLocaleString(undefined, {
        timeZone: "UTC",
    });
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

export default function Av2StatusClient() {
    const {isAuthenticated, isReady} = useAdminSession();

    const [status, setStatus] = useState<AdminAv2StatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        if (!isReady || !isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            setStatus(await adminWebApi.av2Status());
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
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex w-full flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle>AV2 Status / Monitoring</CardTitle>
                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                    Observed UTC: {displayTs(status?.observed_ts_ms)}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void loadStatus()}
                                disabled={loading}
                                className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 md:text-xs"
                            >
                                {loading ? "Loading…" : "Reload"}
                            </button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {error ? (
                            <div
                                className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                {error}
                            </div>
                        ) : null}

                        {!error && loading && !status ? (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                Loading AV2 status…
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {status ? (
                    <>
                        <section className="grid gap-4 md:grid-cols-3">
                            {status.workers.map((worker) => (
                                <Card key={worker.worker_id}>
                                    <CardHeader>
                                        <CardTitle>{worker.worker_id}</CardTitle>
                                    </CardHeader>

                                    <CardContent>
                                        <div className="space-y-2 text-xs">
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-1 font-medium ${statusClass(worker.status)}`}
                                            >
                                                {displayValue(worker.status)}
                                            </span>

                                            <div className="text-gray-600 dark:text-gray-300">
                                                Last seen UTC:{" "}
                                                {displayTs(worker.last_seen_ts_ms)}
                                            </div>

                                            {worker.detail ? (
                                                <div>{worker.detail}</div>
                                            ) : null}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Agents ({status.agents.length})
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left">Agent</th>
                                            <th className="px-2 py-2 text-left">Ticker</th>
                                            <th className="px-2 py-2 text-left">Family</th>
                                            <th className="px-2 py-2 text-left">Enabled</th>
                                            <th className="px-2 py-2 text-left">Account</th>
                                            <th className="px-2 py-2 text-left">Latest Signal</th>
                                            <th className="py-2 pl-2 text-left">Evaluation UTC</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {status.agents.map((agent) => (
                                            <tr
                                                key={agent.agent_id}
                                                className="border-b border-gray-100 dark:border-gray-800"
                                            >
                                                <td className="py-2 pr-4 font-mono">
                                                    {agent.agent_id}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {agent.market_ticker ?? agent.ticker}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(agent.strategy_family)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {agent.enabled ? "Yes" : "No"}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(agent.account_type)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(agent.latest_signal_status)}
                                                </td>
                                                <td className="py-2 pl-2">
                                                    {displayTs(agent.latest_evaluation_ts_ms)}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Active Trades ({status.active_trades.length})
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left">Trade</th>
                                            <th className="px-2 py-2 text-left">Agent</th>
                                            <th className="px-2 py-2 text-left">Ticker</th>
                                            <th className="px-2 py-2 text-left">Lifecycle</th>
                                            <th className="px-2 py-2 text-left">Entry</th>
                                            <th className="px-2 py-2 text-left">Protection</th>
                                            <th className="px-2 py-2 text-left">Exit</th>
                                            <th className="py-2 pl-2 text-left">Account</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {status.active_trades.map((trade) => (
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
                                                    {trade.market_ticker ?? trade.ticker}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(trade.lifecycle_state)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(trade.entry_state)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(trade.protection_state)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(trade.exit_state)}
                                                </td>
                                                <td className="py-2 pl-2">
                                                    {displayValue(trade.account_type)}
                                                </td>
                                            </tr>
                                        ))}

                                        {status.active_trades.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="py-4 text-center text-gray-600 dark:text-gray-300"
                                                >
                                                    No active AV2 trades.
                                                </td>
                                            </tr>
                                        ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Recent Operational Events ({status.recent_events.length})
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left">UTC</th>
                                            <th className="px-2 py-2 text-left">Severity</th>
                                            <th className="px-2 py-2 text-left">Event</th>
                                            <th className="px-2 py-2 text-left">Agent</th>
                                            <th className="px-2 py-2 text-left">Ticker</th>
                                            <th className="px-2 py-2 text-left">Status</th>
                                            <th className="py-2 pl-2 text-left">Reason / Message</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {status.recent_events.map((event, index) => (
                                            <tr
                                                key={`${event.event_ts_ms}-${event.event_type}-${index}`}
                                                className="border-b border-gray-100 dark:border-gray-800"
                                            >
                                                <td className="py-2 pr-4">
                                                    {displayTs(event.event_ts_ms)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(event.severity)}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(event.event_type)}
                                                </td>
                                                <td className="px-2 py-2 font-mono">
                                                    {event.agent_id ?? "—"}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {event.market_ticker ?? event.ticker ?? "—"}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {displayValue(event.status)}
                                                </td>
                                                <td className="py-2 pl-2">
                                                    {event.reason ?? event.message ?? "—"}
                                                </td>
                                            </tr>
                                        ))}
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
