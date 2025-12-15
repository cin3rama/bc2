// types/mfb_p.ts

export type TsPoint = [number, number]; // [ts_ms, value]

export interface MfbPAoi {
    id: number;
    account_id: string;
    label: string;
    status: string;
    aoi_type: string;
    first_seen_ts_ms: number;
    lifecycle_state: string;
    entry_reason: string;
    notes: string;
    created_at: string;   // ISO datetime string
    updated_at: string;   // ISO datetime string
}

export interface MfbPWindow {
    start_ts_ms: number;
    end_ts_ms: number;
    lookback_minutes: number;
    period: string; // "1h", "15min", etc.
}

/* ---------- State ---------- */

export interface MfbPStateLatest {
    ts_minute_ms: number;
    ticker: string;

    equity_usd: number;
    gross_notional_usd: number;
    margin_used_usd: number;
    withdrawable_usd: number;
    maintenance_margin_usd: number;
    gross_leverage: number;
    margin_utilization: number;

    position_size: number;
    entry_px: number;
    position_value: number;
    unrealized_pnl: number;
    liq_px: number;
    mark_px: number;

    available_to_trade_long_usd: number;
    available_to_trade_short_usd: number;
    max_trade_size_long: number;
    max_trade_size_short: number;
}

export interface MfbPStateSeries {
    equity_usd?: TsPoint[];
    gross_leverage?: TsPoint[];
    margin_utilization?: TsPoint[];
    position_size?: TsPoint[];
    mark_px?: TsPoint[];
}

export interface MfbPState {
    latest: MfbPStateLatest;
    series: MfbPStateSeries;
}

/* ---------- Flow ---------- */

export interface MfbPFlowLatest {
    ts_minute_ms: number;
    ticker: string;

    trade_count_total: number;
    trade_count_buy: number;
    trade_count_sell: number;

    notional_vol_total: number;
    notional_vol_buy: number;
    notional_vol_sell: number;

    net_signed_volume: number;
}

export interface MfbPFlowSeries {
    notional_vol_total?: TsPoint[];
    net_signed_volume?: TsPoint[];
    trade_count_total?: TsPoint[];
}

export interface MfbPFlow {
    latest: MfbPFlowLatest;
    series: MfbPFlowSeries;
}

/* ---------- Events ---------- */

export type MfbPEventSeverity = "info" | "warning" | "error" | string;

export interface MfbPEventPayload {
    [key: string]: any;
}

export interface MfbPEvent {
    id: number;
    aoi_id: number;
    ticker: string;
    ts_event_ms: number;
    event_type: string;          // e.g. "CHOA", "CHOCH"
    event_severity: MfbPEventSeverity;
    payload: MfbPEventPayload;
}

export interface MfbPEventSummary {
    event_counts_by_type: Record<string, number>;
    max_severity_in_window: MfbPEventSeverity | null;
    has_recent_choa: boolean;
    has_recent_choch: boolean;
}

export interface MfbPEventsBlock {
    recent: MfbPEvent[];
    summary: MfbPEventSummary;
}

/* ---------- Analysis ---------- */

export interface MfbPAnalysisFlags {
    is_active?: boolean;
    recent_idle_then_active?: boolean;
    [key: string]: boolean | undefined;
}

export interface MfbPAnalysisScores {
    activity_score?: number;
    [key: string]: number | undefined;
}

export interface MfbPAnalysis {
    flags: MfbPAnalysisFlags;
    scores: MfbPAnalysisScores;
    notes: string[];
}

/* ---------- Snapshot & HTTP Detail ---------- */

export interface MfbPSnapshotMeta {
    generated_at_ms: number;
}

export interface MfbPSnapshot {
    kind: "mfb_p_snapshot";
    version: string; // "mfb_p-1.0.0"

    ticker: string;
    anchor_ts_minute_ms: number;

    aoi: MfbPAoi;
    window: MfbPWindow;

    state: MfbPState;
    flow: MfbPFlow;

    events: MfbPEventsBlock;
    analysis: MfbPAnalysis;

    meta: MfbPSnapshotMeta;
}

export interface MfbPAoiDetailSeries {
    state: MfbPStateSeries;
    flow: MfbPFlowSeries;
}

export interface MfbPAoiDetailMeta {
    lookback_minutes: number;
    event_limit: number;
    generated_at_ms: number;
    series_health: any;
}

export interface MfbPAoiDetail {
    kind: "mfb_p_aoi_detail";
    aoi: MfbPAoi;
    ticker: string;
    series: MfbPAoiDetailSeries;
    events: MfbPEventsBlock;
    meta: MfbPAoiDetailMeta;
}
