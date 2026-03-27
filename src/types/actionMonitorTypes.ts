// /app/action-monitor/types.ts

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

export interface ActionMonitorEnvelope {
    type: 'update_data';
    payload: ActionMonitorSnapshot;
}

export interface ActionMonitorSnapshot {
    kind: 'mf_action_monitor_snapshot';
    version: 1;
    meta: ActionMonitorMeta;
    price: ActionMonitorMetricBlock;
    totals: ActionMonitorMetricBlock;
    flow: ActionMonitorMetricBlock;
    impact: ActionMonitorMetricBlock;
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

export interface ActionMonitorCategories {
    mm_buyers: ActionMonitorCategory;
    mm_sellers: ActionMonitorCategory;
    accumulators: ActionMonitorCategory;
    distributors: ActionMonitorCategory;
}

export interface ActionMonitorCategory {
    label: string;
    sort: string;
    totals: ActionMonitorMetricBlock;
    participants: ActionMonitorParticipant[];
    rom: ActionMonitorMetricBlock;
}

export interface ActionMonitorParticipant {
    account_id: string;
    total_vol: DecimalString;
    total_trades: number;
    rank: number;
    prev_rank_badges: string[];
}

export interface ActionMonitorSeries {
    per_minute: ActionMonitorPerMinuteSeries;
}

export interface ActionMonitorPerMinuteSeries {
    buy_vol: Array<[UnixMs, DecimalString]>;
    sell_vol: Array<[UnixMs, DecimalString]>;
    trade_count: Array<[UnixMs, number]>;
}

/**
 * Flexible metric block for currently-known top-level sections whose exact
 * leaf fields are not yet fully locked in FE context. This preserves strong
 * outer typing without inventing backend fields.
 */
export type ActionMonitorMetricBlock = Record<
    string,
    DecimalString | number | string | boolean | null
>;
