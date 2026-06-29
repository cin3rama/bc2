// /src/components/aoi/AOITypeSymbol.tsx
"use client";

import React, { type CSSProperties } from "react";
import {
    DEFAULT_AOI_TYPE_LEGEND_VALUES,
    getAoiTypeLabel,
    normalizeAoiType,
    type AoiLegendValue,
} from "@/lib/aoi-types";

type AOITypeSymbolProps = {
    aoiType: unknown;
    equityUsd?: unknown;
    isActiveAoi?: boolean;
    title?: string;
    className?: string;
    sizeClassName?: string;
};

type AOITypeDisplayProps = {
    aoiType: unknown;
    equityUsd?: unknown;
    isActiveAoi?: boolean;
    className?: string;
    labelClassName?: string;
    title?: string;
};

type AOITypeLegendProps = {
    title?: string;
    values?: readonly AoiLegendValue[];
    className?: string;
};

function toNumeric(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    return null;
}

function getSizeClass(equityUsd: unknown): string {
    const numeric = toNumeric(equityUsd);

    if (numeric !== null && numeric > 10_000_000) return "w-4 h-4";
    if (numeric !== null && numeric >= 1_000_000) return "w-3 h-3";
    return "w-2.5 h-2.5";
}

function formatTitle(aoiType: unknown, equityUsd: unknown): string {
    const label = getAoiTypeLabel(aoiType);
    const numeric = toNumeric(equityUsd);

    if (numeric === null) {
        return label;
    }

    return `${label} · ${numeric.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;
}

export function AOITypeSymbol({
                                  aoiType,
                                  equityUsd,
                                  isActiveAoi,
                                  title,
                                  className = "",
                                  sizeClassName,
                              }: AOITypeSymbolProps) {
    if (
        !isActiveAoi &&
        (aoiType === null || aoiType === undefined || aoiType === "") &&
        (equityUsd === null || equityUsd === undefined || equityUsd === "")
    ) {
        return null;
    }

    const normalized = normalizeAoiType(aoiType);
    const rawType =
        typeof aoiType === "string" ? aoiType.trim().toLowerCase() : "";
    const effectiveType =
        normalized ?? (rawType === "tactical_routing_sleeve" ? "fallback" : rawType || "fallback");

    const resolvedTitle = title ?? formatTitle(aoiType, equityUsd);
    const resolvedSize = sizeClassName ?? getSizeClass(equityUsd);

    let classNames =
        `relative inline-flex shrink-0 items-center justify-center border ${resolvedSize} ${className}`.trim();
    let style: CSSProperties | undefined;
    let inner: React.ReactNode = null;

    switch (effectiveType) {
        case "mm_bot":
            classNames += " rounded-full bg-yellow-400 border-yellow-500";
            break;

        case "position_trader":
            classNames += " rounded-full bg-violet-500 border-violet-600";
            break;

        case "success_leader":
            classNames += " rounded-full bg-green-500 border-green-600";
            break;

        case "active_basis_bot":
            classNames += " rounded-full border-gray-500";
            style = {
                background:
                    "linear-gradient(90deg, #ffffff 0%, #ffffff 50%, #000000 50%, #000000 100%)",
            };
            break;

        case "fakeout":
            classNames += " rounded-full border-gray-500";
            style = {
                background:
                    "linear-gradient(90deg, #ef4444 0%, #ef4444 50%, #ffffff 50%, #ffffff 100%)",
            };
            break;

        case "scalper":
            classNames += " rounded-full border-violet-600";
            style = {
                background:
                    "linear-gradient(90deg, #a855f7 0%, #a855f7 50%, #ffffff 50%, #ffffff 100%)",
            };
            break;

        case "zero_net_event_actor":
            classNames += " rounded-full bg-yellow-300 border-black";
            inner = (
                <>
                    <span className="pointer-events-none absolute left-[18%] top-1/2 w-[64%] -translate-y-1/2 rotate-45 border-t-2 border-black" />
                    <span className="pointer-events-none absolute left-[18%] top-1/2 w-[64%] -translate-y-1/2 -rotate-45 border-t-2 border-black" />
                </>
            );
            break;

        case "campaign_inventory_manager":
            classNames += " rotate-45 rounded-[2px] bg-purple-600 border-purple-700";
            break;

        case "retained_accumulator":
            classNames += " rotate-45 rounded-[2px] bg-green-500 border-green-600";
            break;

        case "other":
        case "unclassified":
        case "archived":
        case "position":
        case "fallback":
        default:
            classNames += " rounded-full bg-black border-black";
            break;
    }

    return (
        <span className={classNames} style={style} title={resolvedTitle}>
            {inner}
        </span>
    );
}

export function AOITypeDisplay({
                                   aoiType,
                                   equityUsd,
                                   isActiveAoi,
                                   className = "",
                                   labelClassName = "",
                                   title,
                               }: AOITypeDisplayProps) {
    const label = getAoiTypeLabel(aoiType);
    const hasDisplayableLabel = label !== "—";

    return (
        <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
            {hasDisplayableLabel ? (
                <AOITypeSymbol
                    aoiType={aoiType}
                    equityUsd={equityUsd}
                    isActiveAoi={isActiveAoi}
                    title={title}
                />
            ) : null}
            <span className={labelClassName}>{label}</span>
        </span>
    );
}

export function AOITypeLegend({
                                  title = "AOI Type Legend",
                                  values = DEFAULT_AOI_TYPE_LEGEND_VALUES,
                                  className = "",
                              }: AOITypeLegendProps) {
    return (
        <div className={`flex justify-center ${className}`.trim()}>
            <div className="rounded shadow bg-white dark:bg-gray-800 px-4 py-3 text-text dark:text-text-inverted">
                <div className="text-sm font-semibold text-center mb-3">{title}</div>

                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs">
                    {values.map((value) => (
                        <div key={value} className="inline-flex items-center gap-2">
                            <AOITypeSymbol
                                isActiveAoi={true}
                                aoiType={value}
                                equityUsd="1000000"
                            />
                            <span>{value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}