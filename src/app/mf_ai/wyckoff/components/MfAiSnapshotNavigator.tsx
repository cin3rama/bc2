// app/mf-ai/wyckoff/components/MfAiSnapshotNavigator.tsx
"use client";

import React, {useEffect, useMemo, useState} from "react";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2,
} from "lucide-react";

type MfAiLocalPeriod = "1h" | "4h";

type SnapshotNavigationDirection = "oldest" | "previous" | "next" | "latest" | "by_id";

type MarketStateSnapshot = {
    id?: number | string | null;
};

type SnapshotNavigation = {
    current_id?: number | string | null;
    oldest_id?: number | string | null;
    previous_id?: number | string | null;
    next_id?: number | string | null;
    latest_id?: number | string | null;
    ticker?: string | null;
    requested_period?: string | null;
};

function getSnapshotId(snapshot: MarketStateSnapshot | null): number | string | null {
    return snapshot?.id ?? null;
}

function getNavigationCurrentId(
    navigation: SnapshotNavigation | null,
    snapshot: MarketStateSnapshot | null
): number | string | null {
    return getSnapshotId(snapshot) ?? navigation?.current_id ?? null;
}

function idToText(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
}

function idToInteger(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;

    const parsed = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed)) return null;

    return Math.trunc(parsed);
}

function sanitizeSnapshotInput(value: string): string {
    const trimmed = value.trim();
    const isNegative = trimmed.startsWith("-");
    const digits = value.replace(/\D/g, "");

    if (!digits) return isNegative ? "-" : "";
    return isNegative ? `-${digits}` : digits;
}

function clampSnapshotId(
    rawValue: string,
    navigation: SnapshotNavigation | null
): string | null {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) return null;

    let next = Math.trunc(parsed);

    const oldest = idToInteger(navigation?.oldest_id);
    const latest = idToInteger(navigation?.latest_id);

    if (oldest !== null && next < oldest) next = oldest;
    if (latest !== null && next > latest) next = latest;

    return String(next);
}

export default function MfAiSnapshotNavigator({
                                                  ticker,
                                                  selectedPeriod,
                                                  snapshot,
                                                  navigation,
                                                  loading,
                                                  error,
                                                  onNavigate,
                                              }: {
    ticker: string | null | undefined;
    selectedPeriod: MfAiLocalPeriod;
    snapshot: MarketStateSnapshot | null;
    navigation: SnapshotNavigation | null;
    loading: boolean;
    error: string | null;
    onNavigate: (
        direction: SnapshotNavigationDirection,
        snapshotId?: string
    ) => Promise<boolean> | boolean | void;
}) {
    const currentId = getNavigationCurrentId(navigation, snapshot);
    const currentIdText = idToText(currentId);
    const oldestId = navigation?.oldest_id ?? null;
    const previousId = navigation?.previous_id ?? null;
    const nextId = navigation?.next_id ?? null;
    const latestId = navigation?.latest_id ?? null;
    const hasNavigation = navigation !== null;

    const [manualInput, setManualInput] = useState(currentIdText);
    const [inputFocused, setInputFocused] = useState(false);

    const manualTarget = useMemo(
        () => clampSnapshotId(manualInput.trim(), navigation),
        [manualInput, navigation]
    );

    const manualIsDifferent =
        manualTarget !== null &&
        manualTarget.length > 0 &&
        manualTarget !== currentIdText;

    useEffect(() => {
        if (!inputFocused && !manualIsDifferent) {
            setManualInput(currentIdText);
        }
    }, [currentIdText, inputFocused, manualIsDifferent]);

    const disableOldest = loading || !ticker || (hasNavigation && (!oldestId || currentId === oldestId));
    const disablePrevious = loading || !ticker || !hasNavigation || !previousId;
    const disableNext = loading || !ticker || !hasNavigation || !nextId;
    const disableLatest = loading || !ticker || (hasNavigation && (!latestId || currentId === latestId));
    const disableManualSubmit = loading || !ticker || !manualIsDifferent || manualTarget === null;

    const iconButtonClass =
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900";

    async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (disableManualSubmit || !manualTarget) return;

        const success = await onNavigate("by_id", manualTarget);

        if (success !== false) {
            setInputFocused(false);
        }
    }

    function handleManualChange(event: React.ChangeEvent<HTMLInputElement>) {
        setManualInput(sanitizeSnapshotInput(event.target.value));
    }

    function handleManualFocus() {
        setInputFocused(true);
        setManualInput("");
    }

    function handleManualBlur() {
        setInputFocused(false);

        if (manualInput.trim().length === 0 || manualInput === "-") {
            setManualInput(currentIdText);
        }
    }

    return (
        <div
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-base shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Snapshot Navigator</span>
                    <span className="text-gray-500 dark:text-gray-400">{ticker ?? "—"} / {selectedPeriod}</span>
                    <span className="text-gray-700 dark:text-gray-200">
                        {currentIdText ? `Snapshot #${currentIdText}` : "No snapshot loaded"}
                    </span>
                    {!snapshot && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Click latest to view the newest saved snapshot.
                        </span>
                    )}
                    {loading && (
                        <span className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/>
                            Loading snapshot...
                        </span>
                    )}
                    {error && <span className="text-sm text-red-700 dark:text-red-300">{error}</span>}
                </div>

                <form onSubmit={handleManualSubmit} className="flex flex-wrap items-center gap-2">
                    <div
                        className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-1 dark:border-gray-800 dark:bg-gray-950"
                        aria-label="Snapshot number-line navigation controls"
                    >
                        <button
                            type="button"
                            onClick={() => void onNavigate("oldest")}
                            disabled={disableOldest}
                            className={iconButtonClass}
                            title="Oldest saved snapshot"
                            aria-label="Oldest saved snapshot"
                        >
                            <ChevronsLeft className="h-4 w-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => void onNavigate("previous")}
                            disabled={disablePrevious}
                            className={iconButtonClass}
                            title="Previous saved snapshot"
                            aria-label="Previous saved snapshot"
                        >
                            <ChevronLeft className="h-4 w-4"/>
                        </button>

                        <label
                            htmlFor="mf-ai-snapshot-jump"
                            className="flex items-center gap-1 px-1 text-sm text-gray-600 dark:text-gray-300"
                        >
                            <span>Go to Snapshot #</span>
                            <input
                                id="mf-ai-snapshot-jump"
                                value={manualInput}
                                onFocus={handleManualFocus}
                                onBlur={handleManualBlur}
                                onChange={handleManualChange}
                                inputMode="numeric"
                                placeholder="Snapshot #"
                                disabled={loading}
                                className="h-8 w-24 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => void onNavigate("next")}
                            disabled={disableNext}
                            className={iconButtonClass}
                            title="Next saved snapshot"
                            aria-label="Next saved snapshot"
                        >
                            <ChevronRight className="h-4 w-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => void onNavigate("latest")}
                            disabled={disableLatest}
                            className={iconButtonClass}
                            title="Latest saved snapshot"
                            aria-label="Latest saved snapshot"
                        >
                            <ChevronsRight className="h-4 w-4"/>
                        </button>
                    </div>

                    {manualIsDifferent && manualTarget ? (
                        <button
                            type="submit"
                            disabled={disableManualSubmit}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-semibold text-black transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-40 dark:border-primary-dark dark:bg-primary-dark dark:text-white dark:hover:bg-primary"
                        >
                            Go to {manualTarget}
                        </button>
                    ) : null}
                </form>
            </div>
        </div>
    );
}
