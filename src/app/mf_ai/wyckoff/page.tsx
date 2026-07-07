// app/mf-ai/wyckoff/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import { API_BASE } from "@/lib/env";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/Card";

const SECTION_TITLES = [
    "Dataset Read",
    "Bottom Line",
    "Wyckoff Structure",
    "The Tape",
    "Effort vs Result",
    "Volume Profile Analysis",
    "Actor Behavior",
] as const;

type SectionTitle = (typeof SECTION_TITLES)[number];

type SnapshotSectionMap = Partial<Record<SectionTitle | string, unknown>>;

type AdminAuthState = "checking" | "authenticated" | "unauthenticated" | "error";

type MarketStateSnapshot = {
    id?: number | string | null;
    ticker?: string | null;
    requested_period?: string | null;
    baseline_period?: string | null;
    range_start_ms?: number | string | null;
    range_end_ms?: number | string | null;
    generated_ts_ms?: number | string | null;
    schema_version?: string | number | null;
    inference_provider?: string | null;
    model_name?: string | null;
    metadata?: Record<string, unknown> | null;
    sections?: SnapshotSectionMap | null;
    wyckoff_chart?: unknown;
    analysis_json?: unknown;
    input_summary_json?: unknown;
    warnings?: unknown;
    status?: string | null;
};

type SnapshotApiResponse =
    | MarketStateSnapshot
    | {
    ok?: boolean;
    snapshot?: MarketStateSnapshot;
    data?: MarketStateSnapshot;
    result?: MarketStateSnapshot;
};

type AdminMeResponse =
    | {
    ok: true;
    authenticated: true;
    wallet_address?: string;
    wallet_address_checksum?: string;
}
    | {
    ok?: false;
    authenticated?: false;
    detail?: string;
    error?: string;
};

function unwrapSnapshot(payload: SnapshotApiResponse): MarketStateSnapshot {
    if ("snapshot" in payload && payload.snapshot) return payload.snapshot;
    if ("data" in payload && payload.data) return payload.data;
    if ("result" in payload && payload.result) return payload.result;
    return payload as MarketStateSnapshot;
}

function formatUtcMs(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "—";

    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "—";

    return new Date(numeric).toISOString().replace(".000Z", "Z");
}

function normalizeWarnings(warnings: unknown): string[] {
    if (!warnings) return [];

    if (Array.isArray(warnings)) {
        return warnings
            .map((item) =>
                typeof item === "string" ? item : JSON.stringify(item, null, 2)
            )
            .filter(Boolean);
    }

    if (typeof warnings === "string") return [warnings];

    return [JSON.stringify(warnings, null, 2)];
}

function stringifyContent(value: unknown): string {
    if (value === null || value === undefined || value === "") {
        return "No content returned yet.";
    }

    if (typeof value === "string") return value;

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (typeof value === "object") {
        const typed = value as Record<string, unknown>;

        if (typeof typed.body === "string" && typed.body.trim()) {
            return typed.body;
        }

        if (typeof typed.text === "string" && typed.text.trim()) {
            return typed.text;
        }

        if (typeof typed.content === "string" && typed.content.trim()) {
            return typed.content;
        }
    }

    return JSON.stringify(value, null, 2);
}

function getSectionContent(snapshot: MarketStateSnapshot | null, title: SectionTitle): string {
    if (!snapshot) return "Run an authenticated AI analysis to populate this section.";

    const direct = snapshot.sections?.[title];
    if (direct !== undefined && direct !== null && direct !== "") {
        return stringifyContent(direct);
    }

    const snakeKey = title.toLowerCase().replaceAll(" ", "_");
    const snake = snapshot.sections?.[snakeKey];
    if (snake !== undefined && snake !== null && snake !== "") {
        return stringifyContent(snake);
    }

    if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
        const analysis = snapshot.analysis_json as Record<string, unknown>;

        const analysisDirect = analysis[title];
        if (
            analysisDirect !== undefined &&
            analysisDirect !== null &&
            analysisDirect !== ""
        ) {
            return stringifyContent(analysisDirect);
        }

        const analysisSnake = analysis[snakeKey];
        if (
            analysisSnake !== undefined &&
            analysisSnake !== null &&
            analysisSnake !== ""
        ) {
            return stringifyContent(analysisSnake);
        }
    }

    return "No content returned yet.";
}

function getSnapshotStatus(snapshot: MarketStateSnapshot | null): string {
    if (!snapshot) return "—";

    if (snapshot.status) return snapshot.status;

    if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
        const status = (snapshot.analysis_json as Record<string, unknown>).status;
        if (typeof status === "string" && status.trim()) return status;
    }

    return "—";
}

function MetadataItem({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="break-words font-medium text-gray-900 dark:text-gray-100">
                {value ?? "—"}
            </div>
        </div>
    );
}

function AnalysisCard({
                          title,
                          content,
                      }: {
    title: SectionTitle;
    content: string;
}) {
    return (
        <Card className="min-h-[18rem] overflow-hidden shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="h-[14.25rem] overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-100">
                    {content}
                </pre>
            </CardContent>
        </Card>
    );
}

function AuthStatusBadge({
                             authState,
                         }: {
    authState: AdminAuthState;
}) {
    if (authState === "checking") {
        return (
            <div className="inline-flex items-center rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Checking admin session…
            </div>
        );
    }

    if (authState === "authenticated") {
        return (
            <div className="inline-flex items-center rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                AI analysis available — admin session active
            </div>
        );
    }

    return (
        <div className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <ShieldX className="mr-2 h-3.5 w-3.5" />
            AI analysis requires admin authentication
        </div>
    );
}

export default function MfAiWyckoffPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker, period, hydrated } = useTickerPeriod();

    const [inputContextText, setInputContextText] = useState("");
    const [snapshot, setSnapshot] = useState<MarketStateSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authState, setAuthState] = useState<AdminAuthState>("checking");

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    useEffect(() => {
        let cancelled = false;

        async function checkAdminAuth() {
            setAuthState("checking");

            try {
                const response = await fetch(`${API_BASE}/api/mf-admin/auth/me/`, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                    },
                });

                const text = await response.text();
                const payload = text ? (JSON.parse(text) as AdminMeResponse) : null;

                if (cancelled) return;

                if (response.ok && payload?.authenticated === true) {
                    setAuthState("authenticated");
                    return;
                }

                setAuthState("unauthenticated");
            } catch {
                if (!cancelled) {
                    setAuthState("error");
                }
            }
        }

        checkAdminAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    const warnings = useMemo(
        () => normalizeWarnings(snapshot?.warnings),
        [snapshot?.warnings]
    );

    const canRunOpenAiAnalysis = hydrated && authState === "authenticated" && !loading;

    async function handleAnalyze() {
        if (!hydrated || loading) return;

        if (authState !== "authenticated") {
            setError("AI analysis requires authenticated admin access. Please sign in as an MF admin and reload this page.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_BASE}/api/mf-ai/wyckoff/market-state-snapshot/`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        ticker,
                        requested_period: period,
                        input_context_text: inputContextText.trim(),
                        frontend_context: {
                            user_context_text: inputContextText.trim(),
                            frontend_volume_profile_context: {},
                            frontend_image_refs: [],
                        },
                        use_openai_analysis: true,
                    }),
                }
            );

            const text = await response.text();
            const payload = text ? JSON.parse(text) : null;

            if (!response.ok) {
                const message =
                    response.status === 403
                        ? "OpenAI analysis requires authenticated admin access."
                        : payload?.error ||
                        payload?.detail ||
                        payload?.message ||
                        `Snapshot request failed with HTTP ${response.status}`;

                throw new Error(message);
            }

            setSnapshot(unwrapSnapshot(payload));
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Snapshot request failed."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-2 py-4 text-text dark:text-text-inverted sm:px-4 lg:px-6">
            <section className="rounded-2xl border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold sm:text-2xl">
                            MF_AI Wyckoff Market-State Snapshot
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            Request one authenticated backend-generated market-state snapshot and render the returned analysis.
                        </p>
                        <div className="mt-3">
                            <AuthStatusBadge authState={authState} />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!canRunOpenAiAnalysis}
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-dark dark:text-white dark:hover:bg-primary"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            `Analyze The Current State of the ${ticker || "Selected"} Market`
                        )}
                    </button>
                </div>

                {authState !== "authenticated" && authState !== "checking" && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                        Sign in through the MF admin flow before requesting real OpenAI analysis.
                    </div>
                )}

                <div className="mt-4">
                    <label
                        htmlFor="mf-ai-context"
                        className="mb-2 block text-sm font-medium text-gray-800 dark:text-gray-100"
                    >
                        Optional User Context
                    </label>
                    <textarea
                        id="mf-ai-context"
                        value={inputContextText}
                        onChange={(event) => setInputContextText(event.target.value)}
                        rows={4}
                        placeholder="Add optional context for the backend analysis request..."
                        className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                </div>

                {error && (
                    <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
                        {error}
                    </div>
                )}
            </section>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Snapshot Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MetadataItem label="Ticker" value={snapshot?.ticker ?? ticker ?? "—"} />
                        <MetadataItem
                            label="Requested Period"
                            value={snapshot?.requested_period ?? period ?? "—"}
                        />
                        <MetadataItem
                            label="Baseline Period"
                            value={snapshot?.baseline_period ?? "—"}
                        />
                        <MetadataItem label="Snapshot ID" value={snapshot?.id ?? "—"} />
                        <MetadataItem
                            label="Range Start UTC"
                            value={formatUtcMs(snapshot?.range_start_ms)}
                        />
                        <MetadataItem
                            label="Range End UTC"
                            value={formatUtcMs(snapshot?.range_end_ms)}
                        />
                        <MetadataItem
                            label="Generated UTC"
                            value={formatUtcMs(snapshot?.generated_ts_ms)}
                        />
                        <MetadataItem label="Status" value={getSnapshotStatus(snapshot)} />
                        <MetadataItem
                            label="Inference Provider"
                            value={snapshot?.inference_provider ?? "—"}
                        />
                        <MetadataItem label="Model" value={snapshot?.model_name ?? "—"} />
                        <MetadataItem
                            label="Schema Version"
                            value={snapshot?.schema_version ?? "—"}
                        />
                    </div>

                    {warnings.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                            <div className="mb-2 flex items-center gap-2 font-semibold">
                                <AlertTriangle className="h-4 w-4" />
                                Warnings
                            </div>
                            <ul className="list-disc space-y-1 pl-5">
                                {warnings.map((warning, index) => (
                                    <li key={`${warning}-${index}`}>
                                        <pre className="whitespace-pre-wrap break-words font-sans">
                                            {warning}
                                        </pre>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {SECTION_TITLES.map((title) => (
                    <AnalysisCard
                        key={title}
                        title={title}
                        content={getSectionContent(snapshot, title)}
                    />
                ))}
            </section>

            <Card className="min-h-[32rem] shadow-sm">
                <CardHeader>
                    <CardTitle>Wyckoff Chart</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex min-h-[26rem] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                        {snapshot?.wyckoff_chart ? (
                            <pre className="max-h-[25rem] w-full overflow-auto whitespace-pre-wrap break-words text-left">
                                {stringifyContent(snapshot.wyckoff_chart)}
                            </pre>
                        ) : (
                            <div>
                                <div className="font-medium">Wyckoff Chart Placeholder</div>
                                <div className="mt-1">
                                    Highcharts rendering will be added after the backend chart payload contract is validated.
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
