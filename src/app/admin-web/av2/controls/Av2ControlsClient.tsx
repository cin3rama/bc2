// /src/app/admin-web/av2/controls/Av2ControlsClient.tsx
"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
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
    AdminAv2ControlAgent,
    AdminAv2ControlsResponse,
    AdminAv2GlobalEntryGateState,
} from "@/lib/admin-web/api";

function accountLabel(
    accountType: string,
    accountReference: string | null
): string {
    if (accountType === "main") {
        return "Main Account";
    }

    if (!accountReference) {
        return accountType.replaceAll("_", " ");
    }

    if (accountReference.length <= 22) {
        return accountReference;
    }

    return `${accountReference.slice(0, 12)}…${accountReference.slice(-8)}`;
}

function formatLabel(value: string | null | undefined): string {
    if (!value) return "—";

    return value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function jsonDisplay(value: Record<string, unknown>): string {
    return JSON.stringify(value, null, 2);
}

export default function Av2ControlsClient() {
    const {isAuthenticated, isReady} = useAdminSession();

    const [data, setData] = useState<AdminAv2ControlsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [gateSaving, setGateSaving] = useState(false);
    const [agentSaving, setAgentSaving] = useState<string | null>(null);

    const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

    const loadControls = useCallback(async () => {
        if (!isReady || !isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            const payload = await adminWebApi.av2Controls();
            setData(payload);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "failed_to_load_av2_controls"
            );
        } finally {
            setLoading(false);
        }
    }, [isReady, isAuthenticated]);

    useEffect(() => {
        void loadControls();
    }, [loadControls]);

    const sortedAgents = useMemo(() => {
        if (!data) return [];

        return [...data.agents].sort((a, b) =>
            a.agent_id.localeCompare(b.agent_id)
        );
    }, [data]);

    async function updateGlobalEntryGate(
        nextState: AdminAv2GlobalEntryGateState
    ) {
        if (!data || gateSaving) return;

        if (data.global_entry_gate.state === nextState) return;

        setGateSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response =
                await adminWebApi.patchAv2GlobalEntryGate(nextState);

            setData((current) =>
                current
                    ? {
                        ...current,
                        global_entry_gate: response.global_entry_gate,
                    }
                    : current
            );

            setSuccess(
                `Global entry gate is now ${formatLabel(
                    response.global_entry_gate.state
                )}.`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "failed_to_update_global_entry_gate"
            );
        } finally {
            setGateSaving(false);
        }
    }

    async function updateAgentEnabled(
        agent: AdminAv2ControlAgent,
        enabled: boolean
    ) {
        if (agentSaving) return;
        if (agent.enabled === enabled) return;

        setAgentSaving(agent.agent_id);
        setError(null);
        setSuccess(null);

        try {
            const response = await adminWebApi.patchAv2AgentEnabled(
                agent.agent_id,
                enabled
            );

            setData((current) => {
                if (!current) return current;

                return {
                    ...current,
                    agents: current.agents.map((row) =>
                        row.agent_id === response.agent.agent_id
                            ? response.agent
                            : row
                    ),
                };
            });

            setSuccess(
                `${response.agent.agent_id} is now ${
                    response.agent.enabled ? "Enabled" : "Disabled"
                }.`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "failed_to_update_agent"
            );
        } finally {
            setAgentSaving(null);
        }
    }

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex w-full flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle>
                                    AV2 Controls / Administration
                                </CardTitle>

                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                    Stage 1 operational controls and read-only
                                    agent configuration.
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void loadControls()}
                                disabled={loading}
                                className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                                {loading ? "Loading…" : "Reload"}
                            </button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-3">
                            {error ? (
                                <div
                                    className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    {error}
                                </div>
                            ) : null}

                            {success ? (
                                <div
                                    className="rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                                    {success}
                                </div>
                            ) : null}

                            {!data && loading ? (
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Loading AV2 controls…
                                </div>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                {data ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Global Entry Gate</CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                        Controls new AV2 entries only. Lifecycle,
                                        protection, reconciliation, and exits
                                        remain backend-managed.
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <div
                                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                                data.global_entry_gate.state ===
                                                "enabled"
                                                    ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                                                    : "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300"
                                            }`}
                                        >
                                            {formatLabel(
                                                data.global_entry_gate.state
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            disabled={
                                                gateSaving ||
                                                data.global_entry_gate.state ===
                                                "enabled"
                                            }
                                            onClick={() =>
                                                void updateGlobalEntryGate(
                                                    "enabled"
                                                )
                                            }
                                            className="inline-flex items-center rounded-full border border-green-300 px-3 py-1.5 text-xs font-medium text-green-800 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/40"
                                        >
                                            Enable Entries
                                        </button>

                                        <button
                                            type="button"
                                            disabled={
                                                gateSaving ||
                                                data.global_entry_gate.state ===
                                                "paused"
                                            }
                                            onClick={() =>
                                                void updateGlobalEntryGate(
                                                    "paused"
                                                )
                                            }
                                            className="inline-flex items-center rounded-full border border-yellow-300 px-3 py-1.5 text-xs font-medium text-yellow-800 transition-colors hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-950/40"
                                        >
                                            Pause New Entries
                                        </button>

                                        {gateSaving ? (
                                            <span className="text-xs text-gray-600 dark:text-gray-300">
                                                Saving…
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                    <CardTitle>
                                        Agents ({sortedAgents.length})
                                    </CardTitle>

                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        Only enabled state is mutable in Stage 1.
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left font-semibold">
                                                Agent
                                            </th>
                                            <th className="px-2 py-2 text-left font-semibold">
                                                Name
                                            </th>
                                            <th className="px-2 py-2 text-left font-semibold">
                                                Ticker
                                            </th>
                                            <th className="px-2 py-2 text-left font-semibold">
                                                Family
                                            </th>
                                            <th className="px-2 py-2 text-left font-semibold">
                                                Account
                                            </th>
                                            <th className="px-2 py-2 text-left font-semibold">
                                                State
                                            </th>
                                            <th className="px-2 py-2 text-right font-semibold">
                                                Control
                                            </th>
                                            <th className="py-2 pl-2 text-right font-semibold">
                                                Configuration
                                            </th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {sortedAgents.map((agent) => {
                                            const saving =
                                                agentSaving ===
                                                agent.agent_id;

                                            const expanded =
                                                expandedAgentId ===
                                                agent.agent_id;

                                            return (
                                                <React.Fragment
                                                    key={agent.agent_id}
                                                >
                                                    <tr className="border-b border-gray-100 dark:border-gray-800">
                                                        <td className="py-2 pr-4 font-mono">
                                                            {agent.agent_id}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {agent.agent_name ??
                                                                "—"}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {agent.market_ticker ||
                                                                agent.ticker}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            {formatLabel(
                                                                agent.strategy_family
                                                            )}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                            <div>
                                                                {accountLabel(
                                                                    agent.account_type,
                                                                    agent.account_reference
                                                                )}
                                                            </div>

                                                            {agent.account_reference ? (
                                                                <div
                                                                    className="mt-1 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                                                    {
                                                                        agent.account_reference
                                                                    }
                                                                </div>
                                                            ) : null}
                                                        </td>

                                                        <td className="px-2 py-2">
                                                                <span
                                                                    className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${
                                                                        agent.enabled
                                                                            ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                                                                            : "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                                    }`}
                                                                >
                                                                    {agent.enabled
                                                                        ? "Enabled"
                                                                        : "Disabled"}
                                                                </span>
                                                        </td>

                                                        <td className="px-2 py-2 text-right">
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    Boolean(
                                                                        agentSaving
                                                                    )
                                                                }
                                                                onClick={() =>
                                                                    void updateAgentEnabled(
                                                                        agent,
                                                                        !agent.enabled
                                                                    )
                                                                }
                                                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-xs ${
                                                                    agent.enabled
                                                                        ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                                                                        : "border-green-300 text-green-800 hover:bg-green-50 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/40"
                                                                }`}
                                                            >
                                                                {saving
                                                                    ? "Saving…"
                                                                    : agent.enabled
                                                                        ? "Disable"
                                                                        : "Enable"}
                                                            </button>
                                                        </td>

                                                        <td className="py-2 pl-2 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedAgentId(
                                                                        expanded
                                                                            ? null
                                                                            : agent.agent_id
                                                                    )
                                                                }
                                                                className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 md:text-xs"
                                                            >
                                                                {expanded
                                                                    ? "Hide Config"
                                                                    : "View Config"}
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {expanded ? (
                                                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40">
                                                            <td
                                                                colSpan={8}
                                                                className="p-4"
                                                            >
                                                                <div className="grid gap-4 xl:grid-cols-2">
                                                                    <div>
                                                                        <div className="mb-2 text-sm font-semibold">
                                                                            Strategy
                                                                            Configuration
                                                                        </div>

                                                                        <pre
                                                                            className="max-h-[420px] overflow-auto rounded border border-gray-200 bg-white p-3 text-[11px] dark:border-gray-800 dark:bg-gray-900">
                                                                                {jsonDisplay(
                                                                                    agent.strategy_config
                                                                                )}
                                                                            </pre>
                                                                    </div>

                                                                    <div>
                                                                        <div className="mb-2 text-sm font-semibold">
                                                                            Risk
                                                                            Configuration
                                                                        </div>

                                                                        <pre
                                                                            className="max-h-[420px] overflow-auto rounded border border-gray-200 bg-white p-3 text-[11px] dark:border-gray-800 dark:bg-gray-900">
                                                                                {jsonDisplay(
                                                                                    agent.risk_config
                                                                                )}
                                                                            </pre>
                                                                    </div>
                                                                </div>

                                                                <div
                                                                    className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                                                                    Read-only
                                                                    Stage 1
                                                                    configuration.
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                </React.Fragment>
                                            );
                                        })}

                                        {sortedAgents.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="py-4 text-center text-gray-600 dark:text-gray-300"
                                                >
                                                    No AV2 agents returned.
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
