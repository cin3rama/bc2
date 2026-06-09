// /src/app/admin-web/aoi/page.tsx
"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";
import {useAdminSession} from "@/components/admin-web/AdminSessionProvider";
import {
    adminWebApi,
    AdminAoiCreateDuplicateErrorPayload,
    AdminAoiCreatePayload,
    AdminAoiLifecycleState,
    AdminAoiPolicy,
    AdminAoiType,
    AdminWebApiError,
    isAdminAoiCreateDuplicateErrorPayload,
} from "@/lib/admin-web/api";

const AOI_TYPE_OPTIONS: AdminAoiType[] = [
    "mm_bot",
    "fakeout",
    "position_trader",
    "active_basis_bot",
    "other",
    "unclassified",
];

const LIFECYCLE_OPTIONS: AdminAoiLifecycleState[] = ["active", "archive"];
const AOI_LIST_LIMIT = 5000;

type AdminAoiSortKey =
    | "id"
    | "aoi_type"
    | "checkpoint_tier"
    | "checkpoint_mode";

type SortDirection = "asc" | "desc";

function boolLabel(value: boolean): string {
    return value ? "Yes" : "No";
}

function accountShort(accountId: string): string {
    if (accountId.length <= 18) return accountId;
    return `${accountId.slice(0, 10)}…${accountId.slice(-6)}`;
}

function normalizeAccountInput(value: string): string {
    return value.trim();
}

function createErrorMessage(error: unknown): string {
    if (error instanceof AdminWebApiError) {
        if (error.status === 403) {
            return "Your admin session is not authorized or has expired. Please re-authenticate and try again.";
        }

        if (error.status === 400) {
            return `Create request rejected: ${error.message}`;
        }

        return error.message || `Create request failed with HTTP ${error.status}.`;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "create_aoi_failed";
}

function compareNullableNumber(
    a: number | null | undefined,
    b: number | null | undefined
): number {
    const aMissing = a == null;
    const bMissing = b == null;

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    return a - b;
}

function compareNullableString(
    a: string | null | undefined,
    b: string | null | undefined
): number {
    const aValue = (a ?? "").trim().toLowerCase();
    const bValue = (b ?? "").trim().toLowerCase();

    const aMissing = aValue.length === 0;
    const bMissing = bValue.length === 0;

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    return aValue.localeCompare(bValue);
}

function sortIndicator(
    activeKey: AdminAoiSortKey,
    key: AdminAoiSortKey,
    direction: SortDirection
): string {
    if (activeKey !== key) return "↕";
    return direction === "asc" ? "↑" : "↓";
}

export default function AdminWebAoiListPage() {
    const router = useRouter();
    const {isAuthenticated, isReady} = useAdminSession();

    const [rows, setRows] = useState<AdminAoiPolicy[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createSuccess, setCreateSuccess] = useState<AdminAoiPolicy | null>(null);
    const [duplicateRecovery, setDuplicateRecovery] =
        useState<AdminAoiCreateDuplicateErrorPayload | null>(null);

    const [accountIdInput, setAccountIdInput] = useState("");
    const [lifecycleStateInput, setLifecycleStateInput] =
        useState<AdminAoiLifecycleState>("active");
    const [aoiTypeInput, setAoiTypeInput] = useState<AdminAoiType>("mm_bot");

    const [aoiIdSearch, setAoiIdSearch] = useState("");
    const [accountIdSearch, setAccountIdSearch] = useState("");
    const [sortKey, setSortKey] = useState<AdminAoiSortKey>("id");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const resetCreateForm = useCallback(() => {
        setAccountIdInput("");
        setLifecycleStateInput("active");
        setAoiTypeInput("mm_bot");
        setCreateError(null);
        setDuplicateRecovery(null);
    }, []);

    const loadRows = useCallback(async () => {
        if (!isReady || !isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            const payload = await adminWebApi.listAoiPolicies(AOI_LIST_LIMIT);
            setRows(payload.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : "failed_to_load_aoi_policies");
        } finally {
            setLoading(false);
        }
    }, [isReady, isAuthenticated]);

    useEffect(() => {
        void loadRows();
    }, [loadRows]);

    const createPayload: AdminAoiCreatePayload = useMemo(() => {
        return {
            account_id: normalizeAccountInput(accountIdInput),
            lifecycle_state: lifecycleStateInput,
            aoi_type: aoiTypeInput,
        };
    }, [accountIdInput, lifecycleStateInput, aoiTypeInput]);

    const activeRows = useMemo(() => {
        return rows.filter((row) => row.lifecycle_state === "active");
    }, [rows]);

    const filteredSortedRows = useMemo(() => {
        const aoiIdNeedle = aoiIdSearch.trim();
        const accountIdNeedle = accountIdSearch.trim().toLowerCase();

        const filtered = activeRows.filter((row) => {
            const matchesAoiId =
                aoiIdNeedle.length === 0 || String(row.id).includes(aoiIdNeedle);

            const matchesAccountId =
                accountIdNeedle.length === 0 ||
                row.account_id.toLowerCase().includes(accountIdNeedle);

            return matchesAoiId && matchesAccountId;
        });

        const sorted = [...filtered].sort((a, b) => {
            let cmp = 0;

            switch (sortKey) {
                case "id":
                    cmp = compareNullableNumber(a.id, b.id);
                    break;
                case "aoi_type":
                    cmp = compareNullableString(a.aoi_type, b.aoi_type);
                    break;
                case "checkpoint_tier":
                    cmp = compareNullableNumber(a.checkpoint_tier, b.checkpoint_tier);
                    break;
                case "checkpoint_mode":
                    cmp = compareNullableString(a.checkpoint_mode, b.checkpoint_mode);
                    break;
                default:
                    cmp = 0;
                    break;
            }

            if (cmp !== 0) {
                return sortDirection === "asc" ? cmp : -cmp;
            }

            return a.id - b.id;
        });

        return sorted;
    }, [activeRows, aoiIdSearch, accountIdSearch, sortKey, sortDirection]);

    const canSubmitCreate = createPayload.account_id.length > 0 && !isCreating;

    function handleSortClick(nextKey: AdminAoiSortKey) {
        if (sortKey === nextKey) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }

        setSortKey(nextKey);
        setSortDirection("asc");
    }

    async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setCreateError(null);
        setCreateSuccess(null);
        setDuplicateRecovery(null);

        if (!createPayload.account_id) {
            setCreateError("account_id is required.");
            return;
        }

        setIsCreating(true);

        try {
            const created = await adminWebApi.createAoiPolicy(createPayload);

            setCreateSuccess(created);
            resetCreateForm();
            setIsCreateOpen(false);
            await loadRows();
        } catch (err) {
            if (
                err instanceof AdminWebApiError &&
                err.status === 409 &&
                isAdminAoiCreateDuplicateErrorPayload(err.payload)
            ) {
                setDuplicateRecovery(err.payload);
                setCreateError(null);
            } else {
                setCreateError(createErrorMessage(err));
            }
        } finally {
            setIsCreating(false);
        }
    }

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-1">
                                <CardTitle>AOI Actor Policy</CardTitle>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                    Default view: active AOIs only.
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreateSuccess(null);
                                        setCreateError(null);
                                        setDuplicateRecovery(null);
                                        setIsCreateOpen((prev) => !prev);
                                    }}
                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    {isCreateOpen ? "Close Add New AOI" : "Add New AOI"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void loadRows()}
                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Reload
                                </button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-3">
                            {isCreateOpen ? (
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-4">
                                    <div className="mb-3">
                                        <div className="text-sm font-semibold text-text dark:text-text-inverted">
                                            Add New AOI
                                        </div>
                                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                            Tier/mode/replay/reconcile defaults are assigned automatically by lifecycle.
                                        </div>
                                    </div>

                                    <form className="space-y-4" onSubmit={handleCreateSubmit}>
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <label className="text-sm">
                                                <span className="mb-1 block font-medium">account_id</span>
                                                <input
                                                    type="text"
                                                    value={accountIdInput}
                                                    onChange={(e) => setAccountIdInput(e.target.value)}
                                                    placeholder="0x..."
                                                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                                    required
                                                />
                                            </label>

                                            <label className="text-sm">
                                                <span className="mb-1 block font-medium">lifecycle_state</span>
                                                <select
                                                    value={lifecycleStateInput}
                                                    onChange={(e) =>
                                                        setLifecycleStateInput(e.target.value as AdminAoiLifecycleState)
                                                    }
                                                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                                >
                                                    {LIFECYCLE_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="text-sm">
                                                <span className="mb-1 block font-medium">aoi_type</span>
                                                <select
                                                    value={aoiTypeInput}
                                                    onChange={(e) =>
                                                        setAoiTypeInput(e.target.value as AdminAoiType)
                                                    }
                                                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                                >
                                                    {AOI_TYPE_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>

                                        {duplicateRecovery ? (
                                            <div
                                                className="rounded border border-yellow-300 bg-yellow-50 px-3 py-3 text-xs text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
                                                <div className="font-medium">
                                                    AOI already exists. Edit it?
                                                </div>
                                                <div className="mt-1">
                                                    Existing AOI #{duplicateRecovery.existing_aoi_id} •{" "}
                                                    {duplicateRecovery.account_id} •{" "}
                                                    {duplicateRecovery.existing_lifecycle_state ?? "—"} •{" "}
                                                    {duplicateRecovery.existing_aoi_type ?? "—"}
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            router.push(
                                                                `/admin-web/aoi/detail?aoiId=${encodeURIComponent(
                                                                    String(duplicateRecovery.existing_aoi_id)
                                                                )}`
                                                            )
                                                        }
                                                        className="inline-flex items-center rounded-full border border-yellow-400 dark:border-yellow-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                                                    >
                                                        Yes — Open Existing
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setDuplicateRecovery(null)}
                                                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}

                                        {createError ? (
                                            <div
                                                className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                                {createError}
                                            </div>
                                        ) : null}

                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="submit"
                                                disabled={!canSubmitCreate}
                                                className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                                            >
                                                {isCreating ? "Creating…" : "Create AOI"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreateOpen(false);
                                                    setCreateError(null);
                                                    setDuplicateRecovery(null);
                                                    resetCreateForm();
                                                }}
                                                className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : null}

                            {createSuccess ? (
                                <div
                                    className="rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <span>
                                            AOI created successfully: #{createSuccess.id} — {createSuccess.account_id}
                                        </span>
                                        <Link
                                            href={`/admin-web/aoi/detail?aoiId=${encodeURIComponent(String(createSuccess.id))}`}
                                            className="inline-flex items-center rounded-full border border-green-400 dark:border-green-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                        >
                                            Open Detail
                                        </Link>
                                    </div>
                                </div>
                            ) : null}

                            {loading ? (
                                <div
                                    className="rounded border border-gray-200 dark:border-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                                    Loading AOI actor policies…
                                </div>
                            ) : null}

                            {error ? (
                                <div
                                    className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                                    {error}
                                </div>
                            ) : null}

                            <div className="grid gap-3 md:grid-cols-4">
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">Search AOI ID</span>
                                    <input
                                        type="text"
                                        value={aoiIdSearch}
                                        onChange={(e) => setAoiIdSearch(e.target.value)}
                                        placeholder="e.g. 123"
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                    />
                                </label>

                                <label className="text-sm md:col-span-2">
                                    <span className="mb-1 block font-medium">Search Account ID</span>
                                    <input
                                        type="text"
                                        value={accountIdSearch}
                                        onChange={(e) => setAccountIdSearch(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                                    />
                                </label>

                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAoiIdSearch("");
                                            setAccountIdSearch("");
                                            setSortKey("id");
                                            setSortDirection("asc");
                                        }}
                                        className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        Clear Search / Reset Sort
                                    </button>
                                </div>
                            </div>

                            <div className="text-xs text-gray-600 dark:text-gray-300">
                                Loaded {rows.length} AOIs total • showing {filteredSortedRows.length} active AOIs after
                                filters
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleSortClick("id")}
                                                className="inline-flex items-center gap-1 hover:underline"
                                            >
                                                <span>AOI ID</span>
                                                <span>{sortIndicator(sortKey, "id", sortDirection)}</span>
                                            </button>
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleSortClick("aoi_type")}
                                                className="inline-flex items-center gap-1 hover:underline"
                                            >
                                                <span>Type</span>
                                                <span>{sortIndicator(sortKey, "aoi_type", sortDirection)}</span>
                                            </button>
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">Lifecycle</th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleSortClick("checkpoint_tier")}
                                                className="inline-flex items-center gap-1 hover:underline"
                                            >
                                                <span>Tier</span>
                                                <span>{sortIndicator(sortKey, "checkpoint_tier", sortDirection)}</span>
                                            </button>
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleSortClick("checkpoint_mode")}
                                                className="inline-flex items-center gap-1 hover:underline"
                                            >
                                                <span>Mode</span>
                                                <span>{sortIndicator(sortKey, "checkpoint_mode", sortDirection)}</span>
                                            </button>
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">Replay</th>
                                        <th className="py-2 px-2 text-left font-semibold">Reconcile</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Detail</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredSortedRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-gray-100 dark:border-gray-800"
                                        >
                                            <td className="py-2 pr-4 align-top">#{row.id}</td>
                                            <td className="py-2 px-2 align-top font-mono text-[11px]">
                                                {accountShort(row.account_id)}
                                            </td>
                                            <td className="py-2 px-2 align-top">{row.aoi_type ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.lifecycle_state ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.checkpoint_tier ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{row.checkpoint_mode ?? "—"}</td>
                                            <td className="py-2 px-2 align-top">{boolLabel(row.replay_enabled)}</td>
                                            <td className="py-2 px-2 align-top">{boolLabel(row.reconcile_enabled)}</td>
                                            <td className="py-2 pl-2 pr-0 align-top text-right">
                                                <Link
                                                    href={`/admin-web/aoi/detail?aoiId=${encodeURIComponent(String(row.id))}`}
                                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    Open Detail
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}

                                    {!loading && filteredSortedRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="py-4 text-center text-sm text-gray-600 dark:text-gray-300"
                                            >
                                                No active AOI actor policies matched the current filters.
                                            </td>
                                        </tr>
                                    ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </AdminSessionGate>
        </main>
    );
}
