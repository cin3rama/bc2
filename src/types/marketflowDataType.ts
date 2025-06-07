export type MarketflowDataType = {
    mm_buyers_rows: any[];
    mm_sellers_rows: any[];
    top_accumulators_rows: any[];
    top_distributors_rows: any[];
    top_dust_buyer_rows: any[];
    top_dust_sellers_rows: any[];
    top_dust_total_rows: {
        total_dust_trades: number;
        total_dust_volume: number;
    };
    period_market_buys: {
        total_trades: number;
        total_volume: number;
    };
    period_market_sells: {
        total_trades: number;
        total_volume: number;
    };
    period_market_total: {
        total_trades: number;
        total_volume: number;
    };
};
