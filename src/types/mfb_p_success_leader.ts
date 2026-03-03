// src/types/mfb_p_success_leader.ts
// MFB_P v1.2 Success Leader WS payload contracts (LOCKED)
//
// Global invariants:
// - All times are UTC milliseconds (number)
// - All numeric values are Decimal in DB; over WS they may arrive as string (recommended) or number.
// - Payloads are delivered inside the WS envelope: { type: "update_data", payload: <object> }
// - backend-ch SELECTs jsonb and forwards verbatim (no computation, no double-json encoding)

export type DecimalLike = string | number;

/** WS envelope used across MFB payloads */
export interface WsUpdateDataEnvelope<TPayload> {
    type: "update_data";
    payload: TPayload;
}

/** Allowed windows in v1.2 */
export type SuccessLeaderWindowDays = 7 | 30 | 60;

/** kind discriminator for per-account snapshot */
export const SUCCESS_LEADER_SNAPSHOT_KIND = "mfb_p_success_leader_snapshot" as const;

/** kind discriminator for leaderboard */
export const SUCCESS_LEADER_LEADERBOARD_KIND = "mfb_p_success_leaderboard_snapshot" as const;

/** Shared meta block */
export interface SuccessLeaderMetaV1 {
    /** run_id from success_seeker_daily pipeline */
    run_id: string;
}

/**
 * Per-account Success Leader snapshot (v1)
 * Delivered by: /ws/mfb_p_success_leader_account/
 *
 * Hard rules:
 * - Omission rule: if insufficient observations or any required input missing, the BE omits the snapshot entirely
 * - Therefore: if FE receives this object, all required metrics MUST be non-null.
 */
export interface SuccessLeaderAccountSnapshotV1 {
    kind: typeof SUCCESS_LEADER_SNAPSHOT_KIND;
    version: 1;

    meta: SuccessLeaderMetaV1;

    /** Hyper account id (0x...) */
    account_id: string;

    /** UTC day boundary ms (as-of day) */
    asof_day_ms: number;

    /** window length */
    window_days: SuccessLeaderWindowDays;

    /** Required metrics (non-null if payload exists) */
    equity_start: DecimalLike;
    equity_end: DecimalLike;

    /** Sum of daily external cashflows over the window (positive=in, negative=out) */
    cashflow_cumulative: DecimalLike;

    /** Value series used for returns (v1 skeleton: value_start = equity_start; value_end = equity_end - cashflow_cumulative) */
    value_start: DecimalLike;
    value_end: DecimalLike;

    /** Percentage growth over window (keep sign) */
    pct_growth: DecimalLike;

    /** Number of daily observations available in the window calculation */
    days_observed: number;
}

/**
 * Leaderboard row (v1)
 * Delivered inside leaderboard payload by: /ws/mfb_p_success_leader/
 *
 * Note: This row intentionally matches the per-account snapshot’s required metrics
 * so FE can reuse cards/renderers.
 */
export interface SuccessLeaderLeaderboardRowV1 {
    account_id: string;
    window_days: SuccessLeaderWindowDays;

    equity_start: DecimalLike;
    equity_end: DecimalLike;
    cashflow_cumulative: DecimalLike;
    value_start: DecimalLike;
    value_end: DecimalLike;
    pct_growth: DecimalLike;
    days_observed: number;

    /** Optional rank index if BE provides it; FE should not require it */
    rank?: number;
}

/**
 * Leaderboard snapshot (v1)
 * Delivered by: /ws/mfb_p_success_leader/
 *
 * This is the "top-K leaders" object for a given (asof_day_ms, window_days).
 */
export interface SuccessLeaderLeaderboardSnapshotV1 {
    kind: typeof SUCCESS_LEADER_LEADERBOARD_KIND;
    version: 1;

    meta: SuccessLeaderMetaV1;

    /** UTC day boundary ms */
    asof_day_ms: number;

    /** window length */
    window_days: SuccessLeaderWindowDays;

    /** Ordered best-to-worst by pct_growth DESC, then tiebreakers (BE-defined) */
    leaders: SuccessLeaderLeaderboardRowV1[];
}

/** Union helpers */
export type SuccessLeaderPayloadV1 =
    | SuccessLeaderAccountSnapshotV1
    | SuccessLeaderLeaderboardSnapshotV1;

/** Narrowing helpers */
export function isSuccessLeaderAccountSnapshotV1(
    x: any
): x is SuccessLeaderAccountSnapshotV1 {
    return (
        !!x &&
        x.kind === SUCCESS_LEADER_SNAPSHOT_KIND &&
        x.version === 1 &&
        typeof x.account_id === "string" &&
        typeof x.asof_day_ms === "number"
    );
}

export function isSuccessLeaderLeaderboardSnapshotV1(
    x: any
): x is SuccessLeaderLeaderboardSnapshotV1 {
    return (
        !!x &&
        x.kind === SUCCESS_LEADER_LEADERBOARD_KIND &&
        x.version === 1 &&
        typeof x.asof_day_ms === "number" &&
        Array.isArray(x.leaders)
    );
}