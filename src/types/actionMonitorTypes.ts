// /types/actionMonitorTypes.ts

export type ActionMonitorPeriod =
    | '1min'
    | '5min'
    | '15min'
    | '1h'
    | '4h'
    | '1d'
    | '1w';

export type DecimalString = string;
export type UnixMs = number;
export type ChangeDirection = 'up' | 'down' | 'flat';

export interface ActionMonitorEnvelope {
    type: 'update_data';
    payload: ActionMonitorSnapshot;
}

export type ActionMonitorPositionTotal = {
    value: string | null;
    position_change_dir: ChangeDirection;
};

export interface ActionMonitorSnapshot {
    kind: 'mf_action_monitor_snapshot';
    version: 1;
    meta: ActionMonitorMeta;
    price: Record<string, unknown>;
    totals?: Record<string, unknown>;
    flow: Record<string, unknown>;
    impact: ActionMonitorImpactBlock;
    categories: ActionMonitorCategories;
    series: ActionMonitorSeries;
}

export interface ActionMonitorMeta {
    ticker: string;
    period: ActionMonitorPeriod | string;
    window_ms: UnixMs;
    start_ms: UnixMs;
    asof_ms: UnixMs;
    generated_ts_ms: UnixMs;
}

export interface ActionMonitorImpactBlock {
    up_move_absorption?: DecimalString | number | null;
    down_move_absorption?: DecimalString | number | null;
    buy_vol_per_up_dollar?: DecimalString | number | null;
    sell_vol_per_down_dollar?: DecimalString | number | null;
    [key: string]: unknown;
}

export interface ActionMonitorCategories {
    mm_buyers: ActionMonitorCategory;
    mm_sellers: ActionMonitorCategory;
    accumulators: ActionMonitorCategory;
    distributors: ActionMonitorCategory;
}

export interface ActionMonitorCategory {
    label: string;
    sort: unknown;
    totals: Record<string, unknown>;
    rom: Record<string, unknown>;
    participants: ActionMonitorParticipant[];
    by_aoi_type_position?: Record<
        string,
        ActionMonitorPositionTotal | null | undefined
    >;
    net_position_total?: ActionMonitorPositionTotal | null;
}

export interface ActionMonitorParticipant {
    account_id: string;
    total_vol: DecimalString | number | null;
    total_trades: number | null;
    rank: number | null;
    prev_rank_badges?: unknown[];
    rank_change_dir?: ChangeDirection;
    vol_change_dir?: ChangeDirection;
    trades_change_dir?: ChangeDirection;
    is_active_aoi?: boolean;
    position_size?: string | null;
    position_change_dir?: ChangeDirection;
    [key: string]: unknown;
}

export interface ActionMonitorSeries {
    per_minute?: {
        buy_vol?: Array<[UnixMs, DecimalString]>;
        sell_vol?: Array<[UnixMs, DecimalString]>;
        trade_count?: Array<[UnixMs, number]>;
    };
    impact_1m?: ActionMonitorImpactSeries;
    [key: string]: unknown;
}

export interface ActionMonitorImpactSeries {
    up_move_absorption: Array<[UnixMs, DecimalString]>;
    down_move_absorption: Array<[UnixMs, DecimalString]>;
    up_vol: Array<[UnixMs, DecimalString]>;
    down_vol: Array<[UnixMs, DecimalString]>;
}