// types/mfb_p.ts

export type DecimalLike = string | number;

export interface MfbPAoi {
    id: number;
    account_id: string;

    // backend may include these; keep optional to avoid FE breakage
    label?: string | null;
    status?: string | null;
    aoi_type?: string | null;
    first_seen_ts_ms?: number | null;

    lifecycle_state?: string | null;
    entry_reason?: string | null;
    notes?: string | null;

    // human-only fields (ISO strings) may exist
    created_at?: string | null;
    updated_at?: string | null;
}

export interface MfbPWindow {
    start_ts_ms: number;
    end_ts_ms: number;
    lookback_minutes: number;
    period?: string; // "1h", "15min", etc.
}

/* ---------- Row shapes (canonical for HTTP detail) ---------- */

export interface MfbPStateRow {
    ts_minute_ms: number;
    ticker?: string;

    equity_usd?: DecimalLike;
    gross_notional_usd?: DecimalLike;
    margin_used_usd?: DecimalLike;
    withdrawable_usd?: DecimalLike;
    maintenance_margin_usd?: DecimalLike;
    gross_leverage?: DecimalLike;
    margin_utilization?: DecimalLike;

    position_size?: DecimalLike;
    entry_px?: DecimalLike;
    position_value?: DecimalLike;
    unrealized_pnl?: DecimalLike;
    liq_px?: DecimalLike;
    mark_px?: DecimalLike;

    available_to_trade_long_usd?: DecimalLike;
    available_to_trade_short_usd?: DecimalLike;
    max_trade_size_long?: DecimalLike;
    max_trade_size_short?: DecimalLike;

    is_gap_filled?: boolean;

    [key: string]: any;
}

export interface MfbPFlowRow {
    ts_minute_ms: number;
    ticker?: string;

    trade_count_total?: DecimalLike;
    trade_count_buy?: DecimalLike;
    trade_count_sell?: DecimalLike;

    notional_vol_total?: DecimalLike;
    notional_vol_buy?: DecimalLike;
    notional_vol_sell?: DecimalLike;

    net_signed_volume?: DecimalLike;

    synthetic?: boolean;

    [key: string]: any;
}

/* ---------- Events ---------- */

export type MfbPEventSeverity = "info" | "warning" | "error" | string;

export interface MfbPEventPayload {
    [key: string]: any;
}

export interface MfbPEvent {
    id?: number;
    aoi_id?: number;
    ticker?: string;
    ts_event_ms: number;
    event_type: string; // "CHOA", "CHOCH", etc.
    event_severity?: MfbPEventSeverity;
    payload?: MfbPEventPayload;
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

/* ---------- HTTP Detail ---------- */

export interface MfbPAoiDetailSeries {
    state: MfbPStateRow[]; // ✅ row arrays (not TsPoint maps)
    flow: MfbPFlowRow[];   // ✅ row arrays (densified by backend)
}

export interface MfbPAoiDetailMeta {
    lookback_minutes?: number;
    event_limit?: number;
    generated_at_ms?: number;

    window?: MfbPWindow; // ✅ authoritative boundaries when present
    series_health?: any;
    [key: string]: any;
}

export interface MfbPAoiDetail {
    kind: "mfb_p_aoi_detail";
    aoi: MfbPAoi;
    ticker: string;

    series: MfbPAoiDetailSeries;

    // may arrive as array or block; FE normalizes to block
    events: MfbPEventsBlock;

    meta: MfbPAoiDetailMeta;
}

/* ---------- WS Snapshot (often block-shaped) ---------- */

export interface MfbPBlock<T> {
    latest?: T | null;
    series?: T[] | null;
}

export interface MfbPSnapshot {
    kind: "mfb_p_snapshot";
    version?: string;

    ticker?: string;
    period?: string;

    aoi?: MfbPAoi;

    window?: MfbPWindow;

    // WS often sends {latest, series}
    state?: MfbPBlock<MfbPStateRow> | null;
    flow?: MfbPBlock<MfbPFlowRow> | null;

    // may be array or block
    events?: MfbPEventsBlock | MfbPEvent[] | null;

    meta?: any;
    analysis?: any;

    [key: string]: any;
}
