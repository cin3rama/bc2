// /src/app/admin-web/aoi/detail/AdminAoiDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";
import { useAdminSession } from "@/components/admin-web/AdminSessionProvider";
// /src/app/admin-web/aoi/detail/AdminAoiDetailClient.tsx
import {
    adminWebApi,
    AdminAoiLifecycleState,
    AdminAoiMarketPolicy,
    AdminAoiPolicy,
    AdminAoiType,
    AdminCheckpointMode,
    AdminCheckpointTier,
    AdminMarketLifecycleState,
    AdminMarketPriority,
} from "@/lib/admin-web/api";

const AOI_TYPES: AdminAoiType[] = [
    "mm_bot",
    "fakeout",
    "position_trader",
    "active_basis_bot",
    "other",
    "unclassified",
];

const ACTOR_LIFECYCLE_STATES: AdminAoiLifecycleState[] = ["active", "archived"];
const CHECKPOINT_TIERS: AdminCheckpointTier[] = [1, 2, 3];
const CHECKPOINT_MODES: AdminCheckpointMode[] = ["pinned", "rotating", "disabled"];
const MARKET_PRIORITIES: AdminMarketPriority[] = [1, 2, 3];
const MARKET_LIFECYCLE_STATES: AdminMarketLifecycleState[] = [
    "active",
    "dormant",
    "inactive",
    "unknown",
];

type ActorFormState = {
    aoi_type: AdminAoiType;
    lifecycle_state: AdminAoiLifecycleState;
    checkpoint_tier: AdminCheckpointTier;
    checkpoint_mode: AdminCheckpointMode;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
    notes: string;
};

type MarketFormState = {
    ticker: string;
    market_priority: AdminMarketPriority;
    market_lifecycle_state: AdminMarketLifecycleState;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
};

function coerceTier(value: unknown): AdminCheckpointTier {
    return value === 1 || value === 2 || value === 3 ? value : 3;
}

function coerceMarketPriority(value: unknown): AdminMarketPriority {
    return value === 1 || value === 2 || value === 3 ? value : 3;
}

function coerceAoiType(value: unknown): AdminAoiType {
    return AOI_TYPES.includes(value as AdminAoiType) ? (value as AdminAoiType) : "unclassified";
}

function coerceCheckpointMode(value: unknown): AdminCheckpointMode {
    return CHECKPOINT_MODES.includes(value as AdminCheckpointMode)
        ? (value as AdminCheckpointMode)
        : "disabled";
}

function coerceActorLifecycle(value: unknown): AdminAoiLifecycleState {
    return value === "archived" ? "archived" : "active";
}

function coerceMarketLifecycle(value: unknown): AdminMarketLifecycleState {
    return MARKET_LIFECYCLE_STATES.includes(value as AdminMarketLifecycleState)
        ? (value as AdminMarketLifecycleState)
        : "unknown";
}

function actorToForm(actor: AdminAoiPolicy): ActorFormState {
    return {
        aoi_type: coerceAoiType(actor.aoi_type),
        lifecycle_state: coerceActorLifecycle(actor.lifecycle_state),
        checkpoint_tier: coerceTier(actor.checkpoint_tier),
        checkpoint_mode: coerceCheckpointMode(actor.checkpoint_mode),
        replay_enabled: Boolean(actor.replay_enabled),
        reconcile_enabled: Boolean(actor.reconcile_enabled),
        notes: actor.notes ?? "",
    };
}

function marketToForm(row: AdminAoiMarketPolicy): MarketFormState {
    return {
        ticker: row.ticker,
        market_priority: coerceMarketPriority(row.market_priority),
        market_lifecycle_state: coerceMarketLifecycle(row.market_lifecycle_state),
        replay_enabled: Boolean(row.replay_enabled),
        reconcile_enabled: Boolean(row.reconcile_enabled),
    };
}

function boolLabel(value: boolean): string {
    return value ? "Yes" : "No";
}

export default function AdminAoiDetailClient() {
    const sp = useSearchParams();
    const { isAuthenticated, isReady } = useAdminSession();

    const aoiIdRaw = sp.get("aoiId");
    const aoiId = aoiIdRaw ? Number(aoiIdRaw) : NaN;

    const [actor, setActor] = useState<AdminAoiPolicy | null>(null);
    const [actorForm, setActorForm] = useState<ActorFormState | null>(null);
    const [markets, setMarkets] = useState<AdminAoiMarketPolicy[]>([]);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [marketForm, setMarketForm] = useState<MarketFormState | null>(null);

    const [loading, setLoading] = useState(false);
    const [savingActor, setSavingActor] = useState(false);
    const [savingMarket, setSavingMarket] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const actorPinnedInvalid = useMemo(() => {
        return actorForm?.checkpoint_mode === "pinned" && actorForm.checkpoint_tier !== 1;
    }, [actorForm]);

    useEffect(() => {
        if (!isReady || !isAuthenticated || !Number.isFinite(aoiId)) return;

        let cancelled = false;

        async function loadDetail() {
            setLoading(true);
            setError(null);
            setSuccess(null);

            try {
                const [actorPayload, marketPayload] = await Promise.all([
                    adminWebApi.readAoiPolicy(aoiId),
                    adminWebApi.listAoiMarketPolicies(aoiId),
                ]);

                if (cancelled) return;

                setActor(actorPayload.aoi);
                setActorForm(actorToForm(actorPayload.aoi));
                setMarkets(marketPayload.results);

                const firstTicker = marketPayload.results[0]?.ticker ?? null;
                setSelectedTicker(firstTicker);
                setMarketForm(firstTicker ? marketToForm(marketPayload.results[0]) : null);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "failed_to_load_aoi_detail");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadDetail();

        return () => {
            cancelled = true;
        };
    }, [aoiId, isReady, isAuthenticated]);

    useEffect(() => {
        if (!selectedTicker) {
            setMarketForm(null);
            return;
        }

        const row = markets.find((market) => market.ticker === selectedTicker);
        setMarketForm(row ? marketToForm(row) : null);
    }, [selectedTicker, markets]);

    async function reloadMarkets() {
        const marketPayload = await adminWebApi.listAoiMarketPolicies(aoiId);
        setMarkets(marketPayload.results);
        if (selectedTicker) {
            const selected = marketPayload.results.find((row) => row.ticker === selectedTicker);
            setMarketForm(selected ? marketToForm(selected) : null);
        }
    }

    async function saveActor() {
        if (!actorForm || !Number.isFinite(aoiId)) return;

        setError(null);
        setSuccess(null);

        if (actorForm.checkpoint_mode === "pinned" && actorForm.checkpoint_tier !== 1) {
            setError("pinned_requires_checkpoint_tier_1");
            return;
        }

        setSavingActor(true);

        try {
            const payload = await adminWebApi.patchAoiPolicy(aoiId, {
                aoi_type: actorForm.aoi_type,
                lifecycle_state: actorForm.lifecycle_state,
                checkpoint_tier: actorForm.checkpoint_tier,
                checkpoint_mode: actorForm.checkpoint_mode,
                replay_enabled: actorForm.replay_enabled,
                reconcile_enabled: actorForm.reconcile_enabled,
                notes: actorForm.notes.length > 0 ? actorForm.notes : null,
            });

            setActor(payload.aoi);
            setActorForm(actorToForm(payload.aoi));
            setSuccess("Actor policy saved.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "failed_to_save_actor_policy");
        } finally {
            setSavingActor(false);
        }
    }

    async function saveMarket() {
        if (!marketForm || !Number.isFinite(aoiId)) return;

        setError(null);
        setSuccess(null);
        setSavingMarket(true);

        try {
            const payload = await adminWebApi.patchAoiMarketPolicy(aoiId, marketForm.ticker, {
                market_priority: marketForm.market_priority,
                market_lifecycle_state: marketForm.market_lifecycle_state,
                replay_enabled: marketForm.replay_enabled,
                reconcile_enabled: marketForm.reconcile_enabled,
            });

            setMarkets((current) =>
                current.map((row) => (row.ticker === payload.market.ticker ? payload.market : row))
            );
            setMarketForm(marketToForm(payload.market));
            setSuccess(`Market policy saved for ${payload.market.ticker}.`);
            await reloadMarkets();
        } catch (err) {
            setError(err instanceof Error ? err.message : "failed_to_save_market_policy");
        } finally {
            setSavingMarket(false);
        }
    }

    if (!Number.isFinite(aoiId)) {
        return (
            <main className="flex flex-col gap-4">
                <AdminSessionGate>
                    <Card>
                        <CardHeader>
                            <CardTitle>Invalid AOI Detail Request</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-red-600 dark:text-red-400">
                                Missing/invalid aoiId.
                            </p>
                        </CardContent>
                    </Card>
                </AdminSessionGate>
            </main>
        );
    }

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/admin-web/aoi"
                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Back to AOI List
                    </Link>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                        AOI #{aoiId}
                    </div>
                </div>

                {loading ? (
                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                        Loading AOI policy…
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                ) : null}

                {success ? (
                    <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                        {success}
                    </div>
                ) : null}

                <section className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Actor Policy Editor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!actor || !actorForm ? (
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    No actor loaded.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs">
                                        <div className="font-mono break-all">{actor.account_id}</div>
                                        <div className="mt-1 text-gray-600 dark:text-gray-300">
                                            First seen UTC ms: {actor.first_seen_ts_ms ?? "—"}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium">AOI Type</span>
                                            <select
                                                value={actorForm.aoi_type}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current
                                                            ? { ...current, aoi_type: event.target.value as AdminAoiType }
                                                            : current
                                                    )
                                                }
                                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                            >
                                                {AOI_TYPES.map((value) => (
                                                    <option key={value} value={value}>
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium">Lifecycle State</span>
                                            <select
                                                value={actorForm.lifecycle_state}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current
                                                            ? {
                                                                ...current,
                                                                    lifecycle_state: event.target.value as AdminAoiLifecycleState,
                                                            }
                                                            : current
                                                    )
                                                }
                                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                            >
                                                {ACTOR_LIFECYCLE_STATES.map((value) => (
                                                    <option key={value} value={value}>
                                                        {value === "archived" ? "Archived" : "Active"}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium">Checkpoint Tier</span>
                                            <select
                                                value={actorForm.checkpoint_tier}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current
                                                            ? {
                                                                ...current,
                                                                checkpoint_tier: Number(event.target.value) as AdminCheckpointTier,
                                                            }
                                                            : current
                                                    )
                                                }
                                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                            >
                                                {CHECKPOINT_TIERS.map((value) => (
                                                    <option key={value} value={value}>
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="text-sm">
                                            <span className="mb-1 block font-medium">Checkpoint Mode</span>
                                            <select
                                                value={actorForm.checkpoint_mode}
                                                onChange={(event) =>
                                                    setActorForm((current) => {
                                                        if (!current) return current;
                                                        const nextMode = event.target.value as AdminCheckpointMode;
                                                        return {
                                                            ...current,
                                                            checkpoint_mode: nextMode,
                                                            checkpoint_tier: nextMode === "pinned" ? 1 : current.checkpoint_tier,
                                                        };
                                                    })
                                                }
                                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                            >
                                                {CHECKPOINT_MODES.map((value) => (
                                                    <option key={value} value={value}>
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={actorForm.replay_enabled}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current ? { ...current, replay_enabled: event.target.checked } : current
                                                    )
                                                }
                                                className="h-4 w-4"
                                            />
                                            <span>Replay Enabled</span>
                                        </label>

                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={actorForm.reconcile_enabled}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current ? { ...current, reconcile_enabled: event.target.checked } : current
                                                    )
                                                }
                                                className="h-4 w-4"
                                            />
                                            <span>Reconcile Enabled</span>
                                        </label>

                                        <label className="text-sm md:col-span-2">
                                            <span className="mb-1 block font-medium">Notes / Description</span>
                                            <textarea
                                                rows={5}
                                                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                                value={actorForm.notes}
                                                onChange={(event) =>
                                                    setActorForm((current) =>
                                                        current ? { ...current, notes: event.target.value } : current
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>

                                    {actorPinnedInvalid ? (
                                        <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
                                            Pinned mode requires checkpoint tier 1.
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        disabled={savingActor || actorPinnedInvalid}
                                        onClick={() => void saveActor()}
                                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {savingActor ? "Saving actor policy…" : "Save Actor Policy"}
                                    </button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actor-Market Policy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left font-semibold">Ticker</th>
                                            <th className="py-2 px-2 text-left font-semibold">Coin</th>
                                            <th className="py-2 px-2 text-left font-semibold">Priority</th>
                                            <th className="py-2 px-2 text-left font-semibold">Lifecycle</th>
                                            <th className="py-2 px-2 text-left font-semibold">Replay</th>
                                            <th className="py-2 px-2 text-left font-semibold">Reconcile</th>
                                            <th className="py-2 pl-2 text-right font-semibold">Edit</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {markets.map((row) => (
                                            <tr
                                                key={row.ticker}
                                                className={`border-b border-gray-100 dark:border-gray-800 ${
                                                    selectedTicker === row.ticker ? "bg-gray-50 dark:bg-gray-800/60" : ""
                                                }`}
                                            >
                                                <td className="py-2 pr-4 align-top font-mono text-[11px]">{row.ticker}</td>
                                                <td className="py-2 px-2 align-top">{row.coin}</td>
                                                <td className="py-2 px-2 align-top">{row.market_priority}</td>
                                                <td className="py-2 px-2 align-top">{row.market_lifecycle_state}</td>
                                                <td className="py-2 px-2 align-top">{boolLabel(row.replay_enabled)}</td>
                                                <td className="py-2 px-2 align-top">{boolLabel(row.reconcile_enabled)}</td>
                                                <td className="py-2 pl-2 pr-0 align-top text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTicker(row.ticker)}
                                                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}

                                        {markets.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="py-4 text-center text-sm text-gray-600 dark:text-gray-300"
                                                >
                                                    No actor-market rows returned.
                                                </td>
                                            </tr>
                                        ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                {marketForm ? (
                                    <div className="rounded border border-gray-200 dark:border-gray-800 p-3">
                                        <div className="mb-3 text-sm font-semibold">
                                            Edit Market: <span className="font-mono">{marketForm.ticker}</span>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <label className="text-sm">
                                                <span className="mb-1 block font-medium">Market Priority</span>
                                                <select
                                                    value={marketForm.market_priority}
                                                    onChange={(event) =>
                                                        setMarketForm((current) =>
                                                            current
                                                                ? {
                                                                    ...current,
                                                                    market_priority: Number(event.target.value) as AdminMarketPriority,
                                                                }
                                                                : current
                                                        )
                                                    }
                                                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                                >
                                                    {MARKET_PRIORITIES.map((value) => (
                                                        <option key={value} value={value}>
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="text-sm">
                                                <span className="mb-1 block font-medium">Market Lifecycle</span>
                                                <select
                                                    value={marketForm.market_lifecycle_state}
                                                    onChange={(event) =>
                                                        setMarketForm((current) =>
                                                            current
                                                                ? {
                                                                    ...current,
                                                                    market_lifecycle_state: event.target.value as AdminMarketLifecycleState,
                                                                }
                                                                : current
                                                        )
                                                    }
                                                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                                >
                                                    {MARKET_LIFECYCLE_STATES.map((value) => (
                                                        <option key={value} value={value}>
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={marketForm.replay_enabled}
                                                    onChange={(event) =>
                                                        setMarketForm((current) =>
                                                            current
                                                                ? { ...current, replay_enabled: event.target.checked }
                                                                : current
                                                        )
                                                    }
                                                    className="h-4 w-4"
                                                />
                                                <span>Replay Enabled</span>
                                            </label>

                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={marketForm.reconcile_enabled}
                                                    onChange={(event) =>
                                                        setMarketForm((current) =>
                                                            current
                                                                ? { ...current, reconcile_enabled: event.target.checked }
                                                                : current
                                                        )
                                                    }
                                                    className="h-4 w-4"
                                                />
                                                <span>Reconcile Enabled</span>
                                            </label>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={savingMarket}
                                            onClick={() => void saveMarket()}
                                            className="mt-4 inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {savingMarket ? "Saving market policy…" : "Save Market Policy"}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </AdminSessionGate>
        </main>
    );
}
