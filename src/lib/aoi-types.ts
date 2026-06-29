// /src/lib/aoi-types.ts
export type CanonicalAoiType =
    | "mm_bot"
    | "fakeout"
    | "position_trader"
    | "active_basis_bot"
    | "success_leader"
    | "scalper"
    | "zero_net_event_actor"
    | "campaign_inventory_manager"
    | "retained_accumulator"
    | "other"
    | "unclassified";

export const CANONICAL_AOI_TYPES = [
    "mm_bot",
    "fakeout",
    "position_trader",
    "active_basis_bot",
    "success_leader",
    "scalper",
    "zero_net_event_actor",
    "campaign_inventory_manager",
    "retained_accumulator",
    "other",
    "unclassified",
] as const satisfies readonly CanonicalAoiType[];

export type AoiLegendValue = CanonicalAoiType | "fallback";

export const DEFAULT_AOI_TYPE_LEGEND_VALUES: readonly AoiLegendValue[] = [
    "mm_bot",
    "position_trader",
    "success_leader",
    "active_basis_bot",
    "fakeout",
    "scalper",
    "zero_net_event_actor",
    "campaign_inventory_manager",
    "retained_accumulator",
    "other",
    "unclassified",
    "fallback",
] as const;

export function isCanonicalAoiType(value: unknown): value is CanonicalAoiType {
    return (
        typeof value === "string" &&
        (CANONICAL_AOI_TYPES as readonly string[]).includes(value.trim().toLowerCase())
    );
}

export function normalizeAoiType(value: unknown): CanonicalAoiType | null {
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    return isCanonicalAoiType(normalized) ? normalized : null;
}

export function getAoiTypeLabel(value: unknown): string {
    const normalized = normalizeAoiType(value);
    if (normalized) return normalized;

    if (typeof value !== "string") return "—";

    const raw = value.trim().toLowerCase();
    if (!raw) return "—";

    if (raw === "tactical_routing_sleeve") {
        return "fallback";
    }

    return raw;
}