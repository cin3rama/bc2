// app/mf-ai/wyckoff/page.tsx
"use client";

import React, {useEffect, useMemo, useState} from "react";
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2,
    ShieldCheck,
    ShieldX,
} from "lucide-react";
import {useHeaderConfig} from "@/contexts/HeaderConfigContext";
import {useTickerPeriod} from "@/contexts/TickerPeriodContext";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/Card";
import MfAiWyckoffMapChart from "./components/MfAiWyckoffMapChart";

type AdminAuthState = "checking" | "authenticated" | "unauthenticated" | "error";

type MfAiLocalPeriod = "1h" | "4h";

type SnapshotSectionMap = Partial<Record<string, unknown>>;

type MarketStateSnapshot = {
    id?: number | string | null;
    ticker?: string | null;
    requested_period?: string | null;
    baseline_period?: string | null;
    range_start_ms?: number | string | null;
    range_end_ms?: number | string | null;
    generated_ts_ms?: number | string | null;
    inference_provider?: string | null;
    model_name?: string | null;

    analysis_status?: string | null;
    analysis_schema_version?: string | number | null;

    schema_version?: string | number | null;
    status?: string | null;

    metadata?: Record<string, unknown> | null;
    cards?: CanonicalCards | null;
    sections?: SnapshotSectionMap | null;
    wyckoff_chart?: unknown;
    market_acceptance_profile?: MarketAcceptanceProfile | null;
    analysis_json?: unknown;
    input_summary_json?: unknown;
    warnings?: unknown;
};

type SnapshotApiResponse =
    | MarketStateSnapshot
    | {
    ok?: boolean;
    snapshot?: MarketStateSnapshot;
    data?: MarketStateSnapshot;
    result?: MarketStateSnapshot;
    navigation?: SnapshotNavigation | null;
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

type SnapshotNavigationDirection = "oldest" | "previous" | "next" | "latest" | "by_id";

type SnapshotNavigation = {
    current_id?: number | string | null;
    oldest_id?: number | string | null;
    previous_id?: number | string | null;
    next_id?: number | string | null;
    latest_id?: number | string | null;
    ticker?: string | null;
    requested_period?: string | null;
};

type SnapshotNavigateResponse = {
    snapshot?: MarketStateSnapshot | null;
    navigation?: SnapshotNavigation | null;
    error?: {
        code?: string | null;
        message?: string | null;
    } | string | null;
    detail?: string | null;
    message?: string | null;
};

type CanonicalCards = {
    dataset_read?: DatasetReadCard | null;
    bottom_line?: BottomLineCard | null;
    wyckoff_structure?: WyckoffStructureCard | null;
    key_levels?: KeyLevelCard[] | null;
    tape_read?: TapeReadCard[] | null;
    effort_vs_result?: EffortVsResultCard | null;
    actor_behavior?: ActorBehaviorCard | null;
    volume_profile?: VolumeProfileCard | null;
    confirmation_invalidation?: ConfirmationInvalidationCard | null;
    data_quality?: DataQualityCard | null;
};

type DatasetReadCard = {
    file?: string | null;
    window?: {
        start_utc?: string | null;
        end_utc?: string | null;
    } | null;
    rows?: number | string | null;
    ohlc?: {
        open?: number | string | null;
        high?: number | string | null;
        low?: number | string | null;
        close?: number | string | null;
    } | null;
    volume?: number | string | null;
    aggressive_buys?: number | string | null;
    aggressive_sells?: number | string | null;
    delta?: number | string | null;
    buy_sell_ratio?: number | string | null;
    dominance_read?: string | null;
};

type BottomLineCard = {
    market_state?: string | null;
    bias?: string | null;
    summary?: string | null;
    primary_level?: string | null;
    primary_risk?: string | null;
    primary_confirmation?: string | null;
    confidence?: string | null;
};

type WyckoffLabel = {
    label?: string | null;
    price_zone?: string | null;
    status?: string | null;
    commentary?: string | null;
};

type WyckoffStructureCard = {
    active_structure?: string | null;
    current_location?: string | null;
    confirmed_labels?: WyckoffLabel[] | null;
    provisional_labels?: WyckoffLabel[] | null;
    invalidated_labels?: WyckoffLabel[] | null;
    structure_summary?: string | null;
};

type KeyLevelCard = {
    price_zone?: string | null;
    grade?: number | string | null;
    commentary?: string | null;
};

type TapeReadCard = {
    start_utc?: string | null;
    end_utc?: string | null;
    price_action?: {
        from?: number | string | null;
        to?: number | string | null;
        low?: number | string | null;
        high?: number | string | null;
    } | null;
    volume_context?: {
        volume?: number | string | null;
        delta?: number | string | null;
        delta_direction?: string | null;
    } | null;
    key_levels_involved?: string[] | null;
    event_type?: string | null;
    factual_read?: string | null;
};

type EffortVsResultCard = {
    overall_read?: string | null;
    summary?: string | null;
    positive_evidence?: string[] | null;
    negative_evidence?: string[] | null;
    auction_effect?: string | null;
    absorption_read?: string | null;
    confidence?: string | null;
};

type ActorCohort = {
    aoi_type?: string | null;
    net_position?: number | string | null;
    delta_1m?: number | string | null;
    delta_5m?: number | string | null;
    delta_15m?: number | string | null;
    actor_count?: number | string | null;
    dominant_side?: string | null;
    behavior_summary?: string | null;
};

type ActorEvent = {
    actor_id_short?: string | null;
    account_id?: string | null;
    aoi_type?: string | null;
    economic_action?: string | null;
    position_delta?: {
        from?: number | string | null;
        to?: number | string | null;
        change?: number | string | null;
        unit?: string | null;
        source?: string | null;
    } | null;
    time_context?: string | null;
    price_context?: string | null;
    behavior_summary?: string | null;
    classification_signal?: string | null;
    importance?: string | null;
};

type ActorBehaviorCard = {
    overview?: string | null;
    cohort_behavior?: ActorCohort[] | null;
    dominant_actor_mix?: unknown;
    actors?: ActorEvent[] | null;
    summary?: string | null;
};

type VolumeProfileCard = {
    available?: boolean | null;
    summary?: string | null;
    key_profile_references?: unknown[] | null;
    validation_read?: string | null;
    confidence?: string | null;
};

type RuleCard = {
    price_zone?: string | null;
    condition?: string | null;
    interpretation?: string | null;
    importance?: string | null;
};

type ConfirmationInvalidationCard = {
    confirmation_rules?: RuleCard[] | null;
    invalidation_rules?: RuleCard[] | null;
    summary?: string | null;
};

type DataQualityCard = {
    aoi_retained_position_state_available?: boolean | null;
    watch_mode_equivalent_state_available?: boolean | null;
    volume_profile_available?: boolean | null;
    oracle_mark_available?: boolean | null;
    funding_available?: boolean | null;
    dataset_actor_side_reliability?: unknown;
    warnings?: string[] | null;
    missing_inputs?: string[] | null;
};

type MarketAcceptanceProfile = {
    available?: boolean | null;
    reference?: Record<string, unknown> | null;
    profile?: {
        metadata?: Record<string, unknown> | null;
        rows?: unknown[] | null;
        derived_levels?: Record<string, unknown> | null;
        current_price_context?: Record<string, unknown> | null;
        hvn_zones?: unknown[] | null;
        lvn_zones?: unknown[] | null;
        wyckoff_level_enrichment?: unknown;
        warnings?: unknown[] | null;
    } | null;
};

const MF_ADMIN_ME_URL = "/api/mf-admin/auth/me/";
const MF_AI_SNAPSHOT_URL = "/api/mf-ai/wyckoff/market-state-snapshot/";
const MF_AI_NAVIGATE_URL = "/api/mf-ai/wyckoff/market-state-snapshot/navigate/";

function unwrapSnapshot(payload: SnapshotApiResponse): MarketStateSnapshot {
    if ("snapshot" in payload && payload.snapshot) return payload.snapshot;
    if ("data" in payload && payload.data) return payload.data;
    if ("result" in payload && payload.result) return payload.result;
    return payload as MarketStateSnapshot;
}

async function parseApiPayload(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return {
            detail: "API returned a non-JSON response.",
            message: text.slice(0, 500),
        };
    }
}

function getErrorMessage(payload: unknown, status: number): string {
    if (payload && typeof payload === "object") {
        const typed = payload as Record<string, unknown>;
        const detail = typeof typed.detail === "string" ? typed.detail : null;
        const message = typeof typed.message === "string" ? typed.message : null;
        const nestedError = isRecord(typed.error) ? typed.error : null;
        const nestedMessage = typeof nestedError?.message === "string" ? nestedError.message : null;
        const error = typeof typed.error === "string" ? typed.error : null;
        const retryable =
            typeof typed.retryable === "boolean" ? ` Retryable: ${typed.retryable ? "yes" : "no"}.` : "";

        const rendered = [detail, message, nestedMessage, error ? `Error code: ${error}.` : null]
            .filter(Boolean)
            .join(" ");

        if (rendered) return rendered + retryable;
    }

    return `Snapshot request failed with HTTP ${status}`;
}

function getSnapshotId(snapshot: MarketStateSnapshot | null): number | string | null {
    return snapshot?.id ?? null;
}

function getNavigationCurrentId(
    navigation: SnapshotNavigation | null,
    snapshot: MarketStateSnapshot | null
): number | string | null {
    return navigation?.current_id ?? getSnapshotId(snapshot);
}

function getNavigationErrorMessage(payload: unknown, ticker: string | null | undefined, period: MfAiLocalPeriod): string {
    if (payload && typeof payload === "object") {
        const typed = payload as SnapshotNavigateResponse;

        if (typeof typed.error === "string" && typed.error.trim()) {
            return typed.error;
        }

        if (typed.error && typeof typed.error === "object") {
            if (typed.error.code === "snapshot_not_found") {
                return `Snapshot not found for ${ticker || "selected ticker"} / ${period}.`;
            }

            if (typed.error.message) return typed.error.message;
        }

        if (typeof typed.detail === "string" && typed.detail.trim()) return typed.detail;
        if (typeof typed.message === "string" && typed.message.trim()) return typed.message;
    }

    return "Could not load snapshot.";
}

function getNavigationFromPayload(payload: unknown): SnapshotNavigation | null {
    if (!payload || typeof payload !== "object") return null;

    const typed = payload as SnapshotNavigateResponse;
    return typed.navigation ?? null;
}

function buildSnapshotNavigationUrl({
                                        ticker,
                                        period,
                                        direction,
                                        currentId,
                                        snapshotId,
                                    }: {
    ticker: string;
    period: MfAiLocalPeriod;
    direction: SnapshotNavigationDirection;
    currentId?: number | string | null;
    snapshotId?: string | null;
}): string {
    const params = new URLSearchParams({
        ticker,
        requested_period: period,
        direction,
    });

    if ((direction === "previous" || direction === "next") && currentId !== null && currentId !== undefined) {
        params.set("current_id", String(currentId));
    }

    if (direction === "by_id" && snapshotId) {
        params.set("snapshot_id", snapshotId);
    }

    return `${MF_AI_NAVIGATE_URL}?${params.toString()}`;
}

function formatUtcMs(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "—";

    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return "—";

    return new Date(numeric).toISOString().replace(".000Z", "Z");
}

function formatUtcRange(startUtc?: string | null, endUtc?: string | null): string {
    if (!startUtc && !endUtc) return "—";
    if (startUtc && endUtc) return `${startUtc}–${endUtc} UTC`;
    return `${startUtc ?? "—"}–${endUtc ?? "—"} UTC`;
}

function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "—";

    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 4,
    }).format(numeric);
}

function formatSignedNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "—";

    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);

    const sign = numeric > 0 ? "+" : "";
    return `${sign}${formatNumber(numeric)}`;
}

function boolText(value: boolean | null | undefined): string {
    if (value === true) return "available";
    if (value === false) return "not available";
    return "unknown";
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

        if (typeof typed.body === "string" && typed.body.trim()) return typed.body;
        if (typeof typed.text === "string" && typed.text.trim()) return typed.text;
        if (typeof typed.content === "string" && typed.content.trim()) return typed.content;
    }

    return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeRenderScalar(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number") return formatNumber(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return stringifyContent(value);
}

function firstPresent(...values: unknown[]): unknown {
    return values.find((value) => value !== null && value !== undefined && value !== "");
}

function formatPriceZone(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return safeRenderScalar(value);
    }

    if (!isRecord(value)) return stringifyContent(value);

    const low = firstPresent(
        value.low,
        value.lower,
        value.price_low,
        value.price_min,
        value.start,
        value.from
    );

    const high = firstPresent(
        value.high,
        value.upper,
        value.price_high,
        value.price_max,
        value.end,
        value.to
    );

    const price = firstPresent(value.price, value.level, value.zone, value.price_zone);

    if (low !== undefined && high !== undefined) {
        return `${safeRenderScalar(low)}–${safeRenderScalar(high)}`;
    }

    if (price !== undefined) return safeRenderScalar(price);

    return stringifyContent(value);
}

function summarizeZones(value: unknown): string {
    if (!Array.isArray(value) || value.length === 0) return "—";

    const rendered = value.slice(0, 3).map(formatPriceZone);
    const extra = value.length > 3 ? `, +${value.length - 3} more` : "";

    return `${rendered.join(", ")}${extra}`;
}

function profileReferenceLabel(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) return "Profile Reference";

    const normalized = value.trim().toLowerCase();

    const labels: Record<string, string> = {
        poc: "POC",
        vah: "VAH",
        val: "VAL",
        hvn: "HVN",
        lvn: "LVN",
        nearest_node: "Nearest Node",
        current_price: "Current Price",
    };

    return labels[normalized] ?? "Profile Reference";
}

function getCanonicalCards(snapshot: MarketStateSnapshot | null): CanonicalCards | null {
    if (!snapshot) return null;

    if (snapshot.cards && typeof snapshot.cards === "object") {
        return snapshot.cards;
    }

    if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
        const analysis = snapshot.analysis_json as Record<string, unknown>;
        if (analysis.cards && typeof analysis.cards === "object") {
            return analysis.cards as CanonicalCards;
        }
    }

    return null;
}

function getAnalysisStatus(snapshot: MarketStateSnapshot | null): string {
    if (!snapshot) return "—";

    if (snapshot.analysis_status) return snapshot.analysis_status;

    if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
        const analysis = snapshot.analysis_json as Record<string, unknown>;
        if (typeof analysis.analysis_status === "string") return analysis.analysis_status;
        if (typeof analysis.status === "string") return analysis.status;
    }

    if (snapshot.status) return snapshot.status;

    return "—";
}

function getAnalysisSchemaVersion(snapshot: MarketStateSnapshot | null): React.ReactNode {
    if (!snapshot) return "—";

    if (snapshot.analysis_schema_version) return snapshot.analysis_schema_version;

    if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
        const analysis = snapshot.analysis_json as Record<string, unknown>;
        if (
            typeof analysis.analysis_schema_version === "string" ||
            typeof analysis.analysis_schema_version === "number"
        ) {
            return analysis.analysis_schema_version;
        }
    }

    return snapshot.schema_version ?? "—";
}

function MetadataItem({label, value}: { label: string; value: React.ReactNode }) {
    return (
        <div
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="break-words font-medium text-gray-900 dark:text-gray-100">
                {value ?? "—"}
            </div>
        </div>
    );
}

function Pill({children, tone = "neutral"}: { children: React.ReactNode; tone?: "positive" | "negative" | "neutral" }) {
    const cls =
        tone === "positive"
            ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
            : tone === "negative"
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                : "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200";

    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
            {children}
        </span>
    );
}

function AnalysisCard({
                          title,
                          children,
                      }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="min-h-[20rem] overflow-hidden shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="h-[16.5rem] overflow-y-auto">
                <div className="space-y-3 text-sm leading-6 text-gray-800 dark:text-gray-100">
                    {children}
                </div>
            </CardContent>
        </Card>
    );
}

function ProseBlock({children}: { children: React.ReactNode }) {
    return <div className="whitespace-pre-wrap break-words">{children || "—"}</div>;
}

function ListBlock({items}: { items?: unknown[] | null }) {
    if (!items || items.length === 0) {
        return <div className="text-gray-500 dark:text-gray-400">—</div>;
    }

    return (
        <ul className="list-disc space-y-1 pl-5">
            {items.map((item, index) => (
                <li key={`${stringifyContent(item)}-${index}`} className="whitespace-pre-wrap break-words">
                    {stringifyContent(item)}
                </li>
            ))}
        </ul>
    );
}

function ProfileReferenceBlock({items}: { items?: unknown[] | null }) {
    if (!items || items.length === 0) {
        return <div className="text-gray-500 dark:text-gray-400">—</div>;
    }

    return (
        <div className="space-y-2">
            {items.map((item, index) => {
                if (typeof item === "string") {
                    return (
                        <div key={`${item}-${index}`} className="whitespace-pre-wrap break-words">
                            {item}
                        </div>
                    );
                }

                if (isRecord(item)) {
                    const profileType = item.profile_type;
                    const priceZone = item.price_zone;
                    const commentary = item.commentary;

                    if (
                        profileType !== undefined ||
                        priceZone !== undefined ||
                        commentary !== undefined
                    ) {
                        return (
                            <div
                                key={`${safeRenderScalar(profileType)}-${safeRenderScalar(priceZone)}-${index}`}
                                className="rounded-lg border border-gray-200 p-2 dark:border-gray-800"
                            >
                                <div className="mb-1 font-semibold">
                                    {profileReferenceLabel(profileType)}{" "}
                                    <span className="text-gray-500 dark:text-gray-400">—</span>{" "}
                                    {safeRenderScalar(priceZone)}
                                </div>
                                <div className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
                                    {safeRenderScalar(commentary)}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <pre
                            key={`${stringifyContent(item)}-${index}`}
                            className="whitespace-pre-wrap break-words rounded-lg border border-gray-200 p-2 font-sans text-xs dark:border-gray-800"
                        >
                            {stringifyContent(item)}
                        </pre>
                    );
                }

                return (
                    <div key={`${stringifyContent(item)}-${index}`} className="whitespace-pre-wrap break-words">
                        {stringifyContent(item)}
                    </div>
                );
            })}
        </div>
    );
}

function LabelGroup({title, labels}: { title: string; labels?: WyckoffLabel[] | null }) {
    if (!labels || labels.length === 0) {
        return (
            <div>
                <div className="mb-1 font-semibold">{title}</div>
                <div className="text-gray-500 dark:text-gray-400">None returned.</div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-2 font-semibold">{title}</div>
            <div className="space-y-2">
                {labels.map((item, index) => (
                    <div key={`${item.label}-${index}`}
                         className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{item.label ?? "—"}</span>
                            <Pill>{item.price_zone ?? "—"}</Pill>
                            <Pill>{item.status ?? "—"}</Pill>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
                            {item.commentary ?? "—"}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function renderDatasetRead(card?: DatasetReadCard | null) {
    if (!card) return <ProseBlock>No Dataset Read returned yet.</ProseBlock>;

    return (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
{`Dataset read

File: ${card.file ?? "—"}
Window: ${formatUtcRange(card.window?.start_utc, card.window?.end_utc)}
Rows: ${formatNumber(card.rows)}
Open: ${formatNumber(card.ohlc?.open)}
High: ${formatNumber(card.ohlc?.high)}
Low: ${formatNumber(card.ohlc?.low)}
Close: ${formatNumber(card.ohlc?.close)}
Volume: ${formatNumber(card.volume)}
Aggressive buys: ${formatNumber(card.aggressive_buys)}
Aggressive sells: ${formatNumber(card.aggressive_sells)}
Delta: ${formatSignedNumber(card.delta)}
Buy/sell ratio: ${formatNumber(card.buy_sell_ratio)}

${card.dominance_read ?? "—"}`}
        </pre>
    );
}

function renderBottomLine(card?: BottomLineCard | null) {
    if (!card) return <ProseBlock>No Bottom Line returned yet.</ProseBlock>;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <Pill>{card.market_state ?? "market_state: —"}</Pill>
                <Pill>{card.bias ?? "bias: —"}</Pill>
                <Pill>{`confidence: ${card.confidence ?? "—"}`}</Pill>
            </div>
            <ProseBlock>{card.summary}</ProseBlock>
            <div><span className="font-semibold">Primary level:</span> {card.primary_level ?? "—"}</div>
            <div><span className="font-semibold">Primary risk:</span> {card.primary_risk ?? "—"}</div>
            <div><span className="font-semibold">Primary confirmation:</span> {card.primary_confirmation ?? "—"}</div>
        </>
    );
}

function renderWyckoffStructure(card?: WyckoffStructureCard | null) {
    if (!card) return <ProseBlock>No Wyckoff Structure returned yet.</ProseBlock>;

    return (
        <>
            <div><span className="font-semibold">Active structure:</span> {card.active_structure ?? "—"}</div>
            <div><span className="font-semibold">Current location:</span> {card.current_location ?? "—"}</div>
            <ProseBlock>{card.structure_summary}</ProseBlock>
            <LabelGroup title="Confirmed labels" labels={card.confirmed_labels}/>
            <LabelGroup title="Provisional labels" labels={card.provisional_labels}/>
            <LabelGroup title="Invalidated labels" labels={card.invalidated_labels}/>
        </>
    );
}

function renderKeyLevels(levels?: KeyLevelCard[] | null) {
    if (!levels || levels.length === 0) return <ProseBlock>No Key Levels returned yet.</ProseBlock>;

    return (
        <div className="space-y-3">
            {levels.map((level, index) => {
                const numericGrade = Number(level.grade);
                const tone = Number.isFinite(numericGrade)
                    ? numericGrade > 0
                        ? "positive"
                        : numericGrade < 0
                            ? "negative"
                            : "neutral"
                    : "neutral";

                return (
                    <div key={`${level.price_zone}-${index}`}
                         className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                        <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
                            <span>{level.price_zone ?? "—"}</span>
                            <Pill tone={tone}>{`grade: ${formatSignedNumber(level.grade)}`}</Pill>
                        </div>
                        <ProseBlock>{level.commentary}</ProseBlock>
                    </div>
                );
            })}
        </div>
    );
}

function renderTapeRead(items?: TapeReadCard[] | null) {
    if (!items || items.length === 0) return <ProseBlock>No Tape Read returned yet.</ProseBlock>;

    return (
        <div className="space-y-3">
            {items.map((item, index) => (
                <div key={`${item.start_utc}-${index}`}
                     className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <div className="mb-2 flex flex-wrap gap-2">
                        <Pill>{formatUtcRange(item.start_utc, item.end_utc)}</Pill>
                        <Pill>{item.event_type ?? "event: —"}</Pill>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div>Price: {formatNumber(item.price_action?.from)} → {formatNumber(item.price_action?.to)}</div>
                        <div>Range: {formatNumber(item.price_action?.low)}–{formatNumber(item.price_action?.high)}</div>
                        <div>Volume: {formatNumber(item.volume_context?.volume)}</div>
                        <div>Delta: {formatSignedNumber(item.volume_context?.delta)} ({item.volume_context?.delta_direction ?? "—"})</div>
                    </div>
                    {item.key_levels_involved && item.key_levels_involved.length > 0 && (
                        <div className="mt-2 text-xs">
                            <span className="font-semibold">Levels:</span> {item.key_levels_involved.join(", ")}
                        </div>
                    )}
                    <div className="mt-2">
                        <ProseBlock>{item.factual_read}</ProseBlock>
                    </div>
                </div>
            ))}
        </div>
    );
}

function renderEffortVsResult(card?: EffortVsResultCard | null) {
    if (!card) return <ProseBlock>No Effort vs Result returned yet.</ProseBlock>;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <Pill>{card.overall_read ?? "overall: —"}</Pill>
                <Pill>{`confidence: ${card.confidence ?? "—"}`}</Pill>
            </div>
            <div>
                <div className="font-semibold">Summary</div>
                <ProseBlock>{card.summary}</ProseBlock>
            </div>
            <div>
                <div className="font-semibold">Positive evidence</div>
                <ListBlock items={card.positive_evidence}/>
            </div>
            <div>
                <div className="font-semibold">Negative evidence</div>
                <ListBlock items={card.negative_evidence}/>
            </div>
            <div>
                <div className="font-semibold">Auction effect</div>
                <ProseBlock>{card.auction_effect}</ProseBlock>
            </div>
            <div>
                <div className="font-semibold">Absorption read</div>
                <ProseBlock>{card.absorption_read}</ProseBlock>
            </div>
        </>
    );
}

function renderDominantActorMix(value: unknown) {
    if (value === null || value === undefined || value === "") {
        return <div className="text-gray-500 dark:text-gray-400">—</div>;
    }

    if (typeof value === "string") {
        return <ProseBlock>{value}</ProseBlock>;
    }

    if (!isRecord(value)) {
        return <ProseBlock>{stringifyContent(value)}</ProseBlock>;
    }

    const demandSide = Array.isArray(value.demand_side)
        ? value.demand_side.map(safeRenderScalar).join(", ")
        : safeRenderScalar(value.demand_side);

    const supplySide = Array.isArray(value.supply_side)
        ? value.supply_side.map(safeRenderScalar).join(", ")
        : safeRenderScalar(value.supply_side);

    const overallQuality = value.overall_quality;

    const hasKnownShape =
        value.demand_side !== undefined ||
        value.supply_side !== undefined ||
        value.overall_quality !== undefined;

    if (!hasKnownShape) {
        return <ProseBlock>{stringifyContent(value)}</ProseBlock>;
    }

    return (
        <div className="space-y-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
            <div className="font-semibold">Dominant actor mix</div>

            {value.demand_side !== undefined && (
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Demand side
                    </div>
                    <div className="whitespace-pre-wrap break-words">{demandSide}</div>
                </div>
            )}

            {value.supply_side !== undefined && (
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Supply side
                    </div>
                    <div className="whitespace-pre-wrap break-words">{supplySide}</div>
                </div>
            )}

            {overallQuality !== undefined && (
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Overall quality
                    </div>
                    <ProseBlock>{safeRenderScalar(overallQuality)}</ProseBlock>
                </div>
            )}
        </div>
    );
}

function renderActorBehavior(card?: ActorBehaviorCard | null) {
    if (!card) return <ProseBlock>No Actor Behavior returned yet.</ProseBlock>;

    return (
        <>
            <ProseBlock>{card.overview}</ProseBlock>
            <div>
                {renderDominantActorMix(card.dominant_actor_mix)}
            </div>

            <div>
                <div className="mb-2 font-semibold">Cohort Behavior</div>
                {!card.cohort_behavior || card.cohort_behavior.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400">No cohort behavior returned.</div>
                ) : (
                    <div className="space-y-2">
                        {card.cohort_behavior.map((cohort, index) => (
                            <div key={`${cohort.aoi_type}-${index}`}
                                 className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                                <div className="mb-1 flex flex-wrap gap-2">
                                    <Pill>{cohort.aoi_type ?? "aoi_type: —"}</Pill>
                                    <Pill>{cohort.dominant_side ?? "side: —"}</Pill>
                                    <Pill>{`actors: ${formatNumber(cohort.actor_count)}`}</Pill>
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                                    <div>Net position: {formatSignedNumber(cohort.net_position)}</div>
                                    <div>Δ1m: {formatSignedNumber(cohort.delta_1m)}</div>
                                    <div>Δ5m: {formatSignedNumber(cohort.delta_5m)}</div>
                                    <div>Δ15m: {formatSignedNumber(cohort.delta_15m)}</div>
                                </div>
                                <div className="mt-2">
                                    <ProseBlock>{cohort.behavior_summary}</ProseBlock>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="mb-2 font-semibold">Notable Actors</div>
                {!card.actors || card.actors.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400">No individual actor events returned.</div>
                ) : (
                    <div className="space-y-2">
                        {card.actors.map((actor, index) => (
                            <div key={`${actor.actor_id_short}-${index}`}
                                 className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{actor.actor_id_short ?? "actor: —"}</span>
                                    <Pill>{actor.aoi_type ?? "aoi_type: —"}</Pill>
                                    <Pill>{actor.economic_action ?? "action: —"}</Pill>
                                    <Pill>{actor.importance ?? "importance: —"}</Pill>
                                </div>
                                {actor.account_id && (
                                    <div
                                        className="mb-1 break-all font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                        {actor.account_id}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                                    <div>Position: {formatNumber(actor.position_delta?.from)} → {formatNumber(actor.position_delta?.to)}</div>
                                    <div>Change: {formatSignedNumber(actor.position_delta?.change)} {actor.position_delta?.unit ?? ""}</div>
                                    <div>Source: {actor.position_delta?.source ?? "—"}</div>
                                    <div>Signal: {actor.classification_signal ?? "—"}</div>
                                </div>
                                <div className="mt-2">
                                    <ProseBlock>{actor.behavior_summary}</ProseBlock>
                                </div>
                                {(actor.time_context || actor.price_context) && (
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                        {actor.time_context ?? "—"} {actor.price_context ? `| ${actor.price_context}` : ""}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="font-semibold">Summary</div>
                <ProseBlock>{card.summary}</ProseBlock>
            </div>
        </>
    );
}

function renderVolumeProfile(card?: VolumeProfileCard | null) {
    if (!card) return <ProseBlock>No Volume Profile card returned yet.</ProseBlock>;

    if (card.available === false) {
        return (
            <>
                <Pill>unavailable</Pill>
                <ProseBlock>{card.summary || "Volume Profile data was not available for this snapshot."}</ProseBlock>
                <div><span className="font-semibold">Validation read:</span> {card.validation_read ?? "unavailable"}
                </div>
                <div><span className="font-semibold">Confidence:</span> {card.confidence ?? "unknown"}</div>
            </>
        );
    }

    return (
        <>
            <Pill>{card.available === true ? "available" : "availability unknown"}</Pill>
            <ProseBlock>{card.summary}</ProseBlock>
            <div>
                <div className="font-semibold">Key profile references</div>
                <ProfileReferenceBlock items={card.key_profile_references}/>
            </div>
            <div><span className="font-semibold">Validation read:</span> {card.validation_read ?? "—"}</div>
            <div><span className="font-semibold">Confidence:</span> {card.confidence ?? "—"}</div>
        </>
    );
}

function renderMarketAcceptanceProfile(map?: MarketAcceptanceProfile | null) {
    if (!map || map.available === false) {
        return (
            <>
                <Pill>unavailable</Pill>
                <ProseBlock>
                    Volume Profile / Market Acceptance Profile data was not available for this snapshot.
                </ProseBlock>
            </>
        );
    }

    const reference = isRecord(map.reference) ? map.reference : {};
    const profile = isRecord(map.profile) ? map.profile : {};
    const metadata = isRecord(profile.metadata) ? profile.metadata : {};
    const derivedLevels = isRecord(profile.derived_levels) ? profile.derived_levels : {};
    const currentPriceContext = isRecord(profile.current_price_context)
        ? profile.current_price_context
        : {};

    const rows = Array.isArray(profile.rows) ? profile.rows : [];
    const hvnZones = Array.isArray(profile.hvn_zones) ? profile.hvn_zones : [];
    const lvnZones = Array.isArray(profile.lvn_zones) ? profile.lvn_zones : [];

    const poc = firstPresent(
        derivedLevels.poc,
        derivedLevels.poc_price,
        derivedLevels.poc_zone,
        derivedLevels.point_of_control,
        metadata.poc
    );

    const vah = firstPresent(
        derivedLevels.vah,
        derivedLevels.value_area_high,
        metadata.vah
    );

    const val = firstPresent(
        derivedLevels.val,
        derivedLevels.value_area_low,
        metadata.val
    );

    const currentPrice = firstPresent(
        currentPriceContext.current_price,
        currentPriceContext.price,
        currentPriceContext.last_price,
        currentPriceContext.mark_price,
        currentPriceContext.oracle_price,
        derivedLevels.current_price,
        derivedLevels.price,
        metadata.current_price,
        metadata.last_price
    );

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <Pill tone="positive">available</Pill>
                <Pill>{`source: ${safeRenderScalar(reference.source ?? metadata.source)}`}</Pill>
                <Pill>{`version: ${safeRenderScalar(reference.calculation_version ?? metadata.calculation_version)}`}</Pill>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>Snapshot ID: {safeRenderScalar(reference.id)}</div>
                <div>Profile period: {safeRenderScalar(reference.profile_period ?? metadata.profile_period)}</div>
                <div>Profile period
                    count: {safeRenderScalar(reference.profile_period_count ?? metadata.profile_period_count)}</div>
                <div>Rows: {safeRenderScalar(reference.row_count ?? rows.length)}</div>
                <div>Trade count: {safeRenderScalar(reference.trade_count ?? metadata.trade_count)}</div>
                <div>Total volume: {safeRenderScalar(reference.total_volume ?? metadata.total_volume)}</div>
                <div>Price step: {safeRenderScalar(metadata.price_step ?? derivedLevels.price_step)}</div>
                <div>Current price: {safeRenderScalar(currentPrice)}</div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <div><span className="font-semibold">POC:</span> {formatPriceZone(poc)}</div>
                <div><span className="font-semibold">VAH:</span> {formatPriceZone(vah)}</div>
                <div><span className="font-semibold">VAL:</span> {formatPriceZone(val)}</div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>HVN candidates: {formatNumber(hvnZones.length)}</div>
                <div>LVN candidates: {formatNumber(lvnZones.length)}</div>
                <div className="sm:col-span-2">
                    <span className="font-semibold">HVNs:</span> {summarizeZones(hvnZones)}
                </div>
                <div className="sm:col-span-2">
                    <span className="font-semibold">LVNs:</span> {summarizeZones(lvnZones)}
                </div>
            </div>
        </>
    );
}

function RuleGroup({title, rules}: { title: string; rules?: RuleCard[] | null }) {
    return (
        <div>
            <div className="mb-2 font-semibold">{title}</div>
            {!rules || rules.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">No rules returned.</div>
            ) : (
                <div className="space-y-2">
                    {rules.map((rule, index) => (
                        <div key={`${rule.price_zone}-${index}`}
                             className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                            <div className="mb-1 flex flex-wrap gap-2">
                                <Pill>{rule.price_zone ?? "price: —"}</Pill>
                                <Pill>{rule.importance ?? "importance: —"}</Pill>
                            </div>
                            <div><span className="font-semibold">Condition:</span> {rule.condition ?? "—"}</div>
                            <div><span className="font-semibold">Interpretation:</span> {rule.interpretation ?? "—"}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function renderConfirmationInvalidation(card?: ConfirmationInvalidationCard | null) {
    if (!card) return <ProseBlock>No Confirmation / Invalidation returned yet.</ProseBlock>;

    return (
        <>
            <RuleGroup title="Confirmation rules" rules={card.confirmation_rules}/>
            <RuleGroup title="Invalidation rules" rules={card.invalidation_rules}/>
            <div>
                <div className="font-semibold">Summary</div>
                <ProseBlock>{card.summary}</ProseBlock>
            </div>
        </>
    );
}

function renderDataQuality(card?: DataQualityCard | null) {
    if (!card) return <ProseBlock>No Data Quality returned yet.</ProseBlock>;

    return (
        <>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>AOI retained positions: {boolText(card.aoi_retained_position_state_available)}</div>
                <div>Watch Mode equivalent: {boolText(card.watch_mode_equivalent_state_available)}</div>
                <div>Volume Profile: {boolText(card.volume_profile_available)}</div>
                <div>Oracle / Mark: {boolText(card.oracle_mark_available)}</div>
                <div>Funding: {boolText(card.funding_available)}</div>
                <div>
                    Actor-side reliability:{" "}
                    {typeof card.dataset_actor_side_reliability === "string"
                        ? card.dataset_actor_side_reliability
                        : stringifyContent(card.dataset_actor_side_reliability)}
                </div>
            </div>
            <div>
                <div className="font-semibold">Warnings</div>
                <ListBlock items={card.warnings}/>
            </div>
            <div>
                <div className="font-semibold">Missing inputs</div>
                <ListBlock items={card.missing_inputs}/>
            </div>
        </>
    );
}

function LegacyFallbackCards({snapshot}: { snapshot: MarketStateSnapshot | null }) {
    const titles = [
        "Dataset Read",
        "Bottom Line",
        "Wyckoff Structure",
        "The Tape",
        "Effort vs Result",
        "Volume Profile Analysis",
        "Actor Behavior",
    ];

    function getLegacySection(title: string): string {
        if (!snapshot) return "Run an authenticated AI analysis to populate this section.";

        const direct = snapshot.sections?.[title];
        if (direct !== undefined && direct !== null && direct !== "") return stringifyContent(direct);

        const snakeKey = title.toLowerCase().replaceAll(" ", "_");
        const snake = snapshot.sections?.[snakeKey];
        if (snake !== undefined && snake !== null && snake !== "") return stringifyContent(snake);

        if (snapshot.analysis_json && typeof snapshot.analysis_json === "object") {
            const analysis = snapshot.analysis_json as Record<string, unknown>;
            const analysisSnake = analysis[snakeKey];
            if (analysisSnake !== undefined && analysisSnake !== null && analysisSnake !== "") {
                return stringifyContent(analysisSnake);
            }
        }

        return "No content returned yet.";
    }

    return (
        <>
            {titles.map((title) => (
                <AnalysisCard key={title} title={title}>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                        {getLegacySection(title)}
                    </pre>
                </AnalysisCard>
            ))}
        </>
    );
}

function SnapshotNavigator({
                               ticker,
                               selectedPeriod,
                               snapshot,
                               navigation,
                               loading,
                               error,
                               jumpSnapshotId,
                               onJumpSnapshotIdChange,
                               onNavigate,
                           }: {
    ticker: string | null | undefined;
    selectedPeriod: MfAiLocalPeriod;
    snapshot: MarketStateSnapshot | null;
    navigation: SnapshotNavigation | null;
    loading: boolean;
    error: string | null;
    jumpSnapshotId: string;
    onJumpSnapshotIdChange: (value: string) => void;
    onNavigate: (direction: SnapshotNavigationDirection, snapshotId?: string) => void;
}) {
    const currentId = getNavigationCurrentId(navigation, snapshot);
    const oldestId = navigation?.oldest_id ?? null;
    const previousId = navigation?.previous_id ?? null;
    const nextId = navigation?.next_id ?? null;
    const latestId = navigation?.latest_id ?? null;
    const hasNavigation = navigation !== null;

    const disableOldest = loading || !ticker || (hasNavigation && (!oldestId || currentId === oldestId));
    const disablePrevious = loading || !ticker || !hasNavigation || !previousId;
    const disableNext = loading || !ticker || !hasNavigation || !nextId;
    const disableLatest = loading || !ticker || (hasNavigation && (!latestId || currentId === latestId));
    const disableLoad = loading || !ticker || !jumpSnapshotId.trim();

    const iconButtonClass =
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900";

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = jumpSnapshotId.trim();
        if (!trimmed) return;
        onNavigate("by_id", trimmed);
    }

    return (
        <div
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-base shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Snapshot Navigator</span>
                    <span className="text-gray-500 dark:text-gray-400">{ticker ?? "—"} / {selectedPeriod}</span>
                    <span className="text-gray-700 dark:text-gray-200">
                        {currentId ? `Snapshot #${currentId}` : "No snapshot loaded"}
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

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1" aria-label="Snapshot paging controls">
                        <button
                            type="button"
                            onClick={() => onNavigate("oldest")}
                            disabled={disableOldest}
                            className={iconButtonClass}
                            title="Oldest saved snapshot"
                            aria-label="Oldest saved snapshot"
                        >
                            <ChevronsLeft className="h-4 w-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate("previous")}
                            disabled={disablePrevious}
                            className={iconButtonClass}
                            title="Previous saved snapshot"
                            aria-label="Previous saved snapshot"
                        >
                            <ChevronLeft className="h-4 w-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate("next")}
                            disabled={disableNext}
                            className={iconButtonClass}
                            title="Next saved snapshot"
                            aria-label="Next saved snapshot"
                        >
                            <ChevronRight className="h-4 w-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate("latest")}
                            disabled={disableLatest}
                            className={iconButtonClass}
                            title="Latest saved snapshot"
                            aria-label="Latest saved snapshot"
                        >
                            <ChevronsRight className="h-4 w-4"/>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex items-center gap-1">
                        <label htmlFor="mf-ai-snapshot-jump" className="text-sm text-gray-600 dark:text-gray-300">
                            Go to ID
                        </label>
                        <input
                            id="mf-ai-snapshot-jump"
                            value={jumpSnapshotId}
                            onChange={(event) => onJumpSnapshotIdChange(event.target.value)}
                            inputMode="numeric"
                            placeholder="78"
                            disabled={loading}
                            className="h-8 w-20 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                        <button
                            type="submit"
                            disabled={disableLoad}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                        >
                            Load
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function AuthStatusBadge({authState}: { authState: AdminAuthState }) {
    if (authState === "checking") {
        return (
            <div
                className="inline-flex items-center rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>
                Checking admin session…
            </div>
        );
    }

    if (authState === "authenticated") {
        return (
            <div
                className="inline-flex items-center rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
                <ShieldCheck className="mr-2 h-3.5 w-3.5"/>
                AI analysis available — admin session active
            </div>
        );
    }

    return (
        <div
            className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            <ShieldX className="mr-2 h-3.5 w-3.5"/>
            AI analysis requires admin authentication
        </div>
    );
}

export default function MfAiWyckoffPage() {
    const {setConfig} = useHeaderConfig();
    const {ticker, hydrated} = useTickerPeriod();

    const [inputContextText, setInputContextText] = useState("");
    const [snapshot, setSnapshot] = useState<MarketStateSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authState, setAuthState] = useState<AdminAuthState>("checking");
    const [mfAiPeriod, setMfAiPeriod] = useState<MfAiLocalPeriod>("1h");
    const [snapshotNavigation, setSnapshotNavigation] = useState<SnapshotNavigation | null>(null);
    const [snapshotNavigationLoading, setSnapshotNavigationLoading] = useState(false);
    const [snapshotNavigationError, setSnapshotNavigationError] = useState<string | null>(null);
    const [snapshotJumpId, setSnapshotJumpId] = useState("");

    useEffect(() => {
        setConfig({showTicker: true, showPeriod: false});
    }, [setConfig]);

    useEffect(() => {
        setSnapshotNavigation(null);
        setSnapshotNavigationError(null);
        setSnapshotJumpId("");
    }, [ticker, mfAiPeriod]);

    useEffect(() => {
        let cancelled = false;

        async function checkAdminAuth() {
            setAuthState("checking");

            try {
                const response = await fetch(MF_ADMIN_ME_URL, {
                    method: "GET",
                    credentials: "include",
                    headers: {Accept: "application/json"},
                });

                const payload = await parseApiPayload(response) as AdminMeResponse | null;

                if (cancelled) return;

                if (response.ok && payload?.authenticated === true) {
                    setAuthState("authenticated");
                    return;
                }

                setAuthState("unauthenticated");
            } catch {
                if (!cancelled) setAuthState("error");
            }
        }

        checkAdminAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    const canonicalCards = useMemo(() => getCanonicalCards(snapshot), [snapshot]);

    const warnings = useMemo(() => {
        const snapshotWarnings = normalizeWarnings(snapshot?.warnings);
        const dataQualityWarnings = canonicalCards?.data_quality?.warnings ?? [];
        return [...snapshotWarnings, ...dataQualityWarnings];
    }, [snapshot?.warnings, canonicalCards?.data_quality?.warnings]);

    const canRunOpenAiAnalysis = hydrated && authState === "authenticated" && !loading;

    async function handleSnapshotNavigate(direction: SnapshotNavigationDirection, requestedSnapshotId?: string) {
        if (!ticker || snapshotNavigationLoading) return;

        const currentId = getNavigationCurrentId(snapshotNavigation, snapshot);

        if ((direction === "previous" || direction === "next") && !currentId) {
            setSnapshotNavigationError("Load a snapshot before paging to previous or next.");
            return;
        }

        const trimmedSnapshotId = requestedSnapshotId?.trim() ?? "";

        if (direction === "by_id" && !trimmedSnapshotId) {
            setSnapshotNavigationError("Enter a snapshot ID to load.");
            return;
        }

        setSnapshotNavigationLoading(true);
        setSnapshotNavigationError(null);

        try {
            const response = await fetch(
                buildSnapshotNavigationUrl({
                    ticker,
                    period: mfAiPeriod,
                    direction,
                    currentId,
                    snapshotId: trimmedSnapshotId,
                }),
                {
                    method: "GET",
                    credentials: "include",
                    headers: {Accept: "application/json"},
                }
            );

            const payload = await parseApiPayload(response);

            if (!response.ok) {
                throw new Error(getNavigationErrorMessage(payload, ticker, mfAiPeriod));
            }

            const typed = payload as SnapshotNavigateResponse | null;
            const nextSnapshot = typed?.snapshot ?? null;

            if (!nextSnapshot) {
                throw new Error("Could not load snapshot.");
            }

            setSnapshot(nextSnapshot);
            setSnapshotNavigation(typed?.navigation ?? null);

            if (direction === "by_id") {
                setSnapshotJumpId("");
            }
        } catch (err) {
            setSnapshotNavigationError(err instanceof Error ? err.message : "Could not load snapshot.");
        } finally {
            setSnapshotNavigationLoading(false);
        }
    }

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
                MF_AI_SNAPSHOT_URL,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        ticker,
                        requested_period: mfAiPeriod,
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

            const payload = await parseApiPayload(response);

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, response.status));
            }

            setSnapshot(unwrapSnapshot(payload as SnapshotApiResponse));
            setSnapshotNavigation(getNavigationFromPayload(payload));
            setSnapshotNavigationError(null);
            setInputContextText("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Snapshot request failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main
            className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-2 py-4 text-text dark:text-text-inverted sm:px-4 lg:px-6">
            <section
                className="rounded-2xl border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold sm:text-2xl">
                            MF_AI Wyckoff Market-State Snapshot
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            Request one authenticated backend-generated market-state snapshot and render the returned
                            analysis.
                        </p>
                        <div className="mt-3">
                            <AuthStatusBadge authState={authState}/>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="mf-ai-period"
                                className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                            >
                                MF_AI Period
                            </label>
                            <select
                                id="mf-ai-period"
                                value={mfAiPeriod}
                                onChange={(event) => setMfAiPeriod(event.target.value as MfAiLocalPeriod)}
                                disabled={loading}
                                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                            >
                                <option value="1h">1 Hour</option>
                                <option value="4h">4 Hours</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={handleAnalyze}
                            disabled={!canRunOpenAiAnalysis}
                            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-black transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-dark dark:text-white dark:hover:bg-primary"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                    Analyzing...
                                </>
                            ) : (
                                `Analyze The Current State of the ${ticker || "Selected"} Market`
                            )}
                        </button>
                    </div>
                </div>

                {authState !== "authenticated" && authState !== "checking" && (
                    <div
                        className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                        Sign in through the MF admin flow before requesting real OpenAI analysis.
                    </div>
                )}

                <div className="mt-4">
                    <label htmlFor="mf-ai-context"
                           className="mb-2 block text-sm font-medium text-gray-800 dark:text-gray-100">
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
                    <div
                        className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
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
                        <MetadataItem label="Ticker" value={snapshot?.ticker ?? ticker ?? "—"}/>
                        <MetadataItem label="Selected MF_AI Period" value={mfAiPeriod}/>
                        <MetadataItem label="Response Requested Period" value={snapshot?.requested_period ?? "—"}/>
                        <MetadataItem label="Baseline Period" value={snapshot?.baseline_period ?? "—"}/>
                        <MetadataItem label="Snapshot ID" value={snapshot?.id ?? "—"}/>
                        <MetadataItem label="Range Start UTC" value={formatUtcMs(snapshot?.range_start_ms)}/>
                        <MetadataItem label="Range End UTC" value={formatUtcMs(snapshot?.range_end_ms)}/>
                        <MetadataItem label="Generated UTC" value={formatUtcMs(snapshot?.generated_ts_ms)}/>
                        <MetadataItem label="Analysis Status" value={getAnalysisStatus(snapshot)}/>
                        <MetadataItem label="Inference Provider" value={snapshot?.inference_provider ?? "—"}/>
                        <MetadataItem label="Model" value={snapshot?.model_name ?? "—"}/>
                        <MetadataItem label="Analysis Schema Version" value={getAnalysisSchemaVersion(snapshot)}/>
                    </div>

                    {warnings.length > 0 && (
                        <div
                            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                            <div className="mb-2 flex items-center gap-2 font-semibold">
                                <AlertTriangle className="h-4 w-4"/>
                                Warnings
                            </div>
                            <ul className="list-disc space-y-1 pl-5">
                                {warnings.map((warning, index) => (
                                    <li key={`${warning}-${index}`}>
                                        <pre className="whitespace-pre-wrap break-words font-sans">{warning}</pre>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <MfAiWyckoffMapChart
                snapshot={snapshot}
                cards={canonicalCards}
                selectedPeriod={mfAiPeriod}
            />

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {canonicalCards ? (
                    <>
                        <AnalysisCard
                            title="Dataset Read">{renderDatasetRead(canonicalCards.dataset_read)}</AnalysisCard>
                        <AnalysisCard title="Bottom Line">{renderBottomLine(canonicalCards.bottom_line)}</AnalysisCard>
                        <AnalysisCard
                            title="Wyckoff Structure">{renderWyckoffStructure(canonicalCards.wyckoff_structure)}</AnalysisCard>
                        <AnalysisCard title="Key Levels">{renderKeyLevels(canonicalCards.key_levels)}</AnalysisCard>
                        <AnalysisCard title="Tape Read">{renderTapeRead(canonicalCards.tape_read)}</AnalysisCard>
                        <AnalysisCard
                            title="Effort vs Result">{renderEffortVsResult(canonicalCards.effort_vs_result)}</AnalysisCard>
                        <AnalysisCard
                            title="Actor Behavior">{renderActorBehavior(canonicalCards.actor_behavior)}</AnalysisCard>
                        <AnalysisCard
                            title="Volume Profile / Market Acceptance Profile — Backend Data">
                            {renderMarketAcceptanceProfile(snapshot?.market_acceptance_profile)}
                        </AnalysisCard>
                        <AnalysisCard
                            title="Volume Profile — AI Interpretation">{renderVolumeProfile(canonicalCards.volume_profile)}</AnalysisCard>
                        <AnalysisCard
                            title="Confirmation / Invalidation">{renderConfirmationInvalidation(canonicalCards.confirmation_invalidation)}</AnalysisCard>
                    </>
                ) : (
                    <LegacyFallbackCards snapshot={snapshot}/>
                )}
            </section>

            <SnapshotNavigator
                ticker={ticker}
                selectedPeriod={mfAiPeriod}
                snapshot={snapshot}
                navigation={snapshotNavigation}
                loading={snapshotNavigationLoading}
                error={snapshotNavigationError}
                jumpSnapshotId={snapshotJumpId}
                onJumpSnapshotIdChange={setSnapshotJumpId}
                onNavigate={handleSnapshotNavigate}
            />
        </main>
    );
}