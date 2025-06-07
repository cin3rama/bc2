// utils/handleRealtimeMarketData.ts
import { MarketflowDataType } from '@/types/marketflowDataType';

type Trade = {
    side: 'BUY' | 'SELL';
    size: string;
    price: string;
    user_buyer: string;
    user_seller: string;
};

export function handleRealtimeMarketData(
    trade: Trade,
    prevData: MarketflowDataType
): MarketflowDataType {
    const isBuy = trade.side === 'BUY';
    const tradeValue = parseFloat(trade.size) * parseFloat(trade.price);
    const tradeSize = parseFloat(trade.size);
    const tradeIncrement = 1;
    const rectColor = isBuy ? 'green' : 'red';

    const updatedData: MarketflowDataType = structuredClone(prevData);

    // --- Market Makers ---
    if (!isBuy) {
        updatedData.mm_buyers_rows = updatedData.mm_buyers_rows.map((row) => {
            if (row.user_buyer === trade.user_buyer) {
                return {
                    ...row,
                    total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                    total_vol_trades: row.total_vol_trades + tradeValue,
                    periodAccumulation: (row.periodAccumulation || 0) + tradeValue,
                    flash: true,
                    flashColor: rectColor,
                };
            }
            return row;
        });
    }

    if (isBuy) {
        updatedData.mm_sellers_rows = updatedData.mm_sellers_rows.map((row) => {
            if (row.user_seller === trade.user_seller) {
                return {
                    ...row,
                    total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                    total_vol_trades: row.total_vol_trades - tradeValue,
                    periodDistributions: (row.periodDistributions || 0) - tradeValue,
                    flash: true,
                    flashColor: rectColor,
                };
            }
            return row;
        });
    }

    // --- Accumulators ---
    updatedData.top_accumulators_rows = updatedData.top_accumulators_rows.map((row) => {
        if (isBuy && row.top_buyer === trade.user_buyer) {
            return {
                ...row,
                net_holding: row.net_holding + tradeValue,
                periodAccumulation: (row.periodAccumulation || 0) + tradeValue,
                flash: true,
                flashColor: rectColor,
            };
        }
        if (!isBuy && row.top_buyer === trade.user_seller) {
            return {
                ...row,
                net_holding: row.net_holding - tradeValue,
                periodAccumulation: (row.periodAccumulation || 0) - tradeValue,
                flash: true,
                flashColor: rectColor,
            };
        }
        return row;
    });

    // --- Distributors ---
    updatedData.top_distributors_rows = updatedData.top_distributors_rows.map((row) => {
        if (!isBuy && row.top_seller === trade.user_seller) {
            return {
                ...row,
                net_holding: row.net_holding - tradeValue,
                periodDistributions: (row.periodDistributions || 0) - tradeValue,
                flash: true,
                flashColor: rectColor,
            };
        }
        if (isBuy && row.top_seller === trade.user_buyer) {
            return {
                ...row,
                net_holding: row.net_holding + tradeValue,
                periodDistributions: (row.periodDistributions || 0) + tradeValue,
                flash: true,
                flashColor: rectColor,
            };
        }
        return row;
    });

    // --- Dust Segment ---
    const isDust = tradeSize <= 0.0002;
    if (isDust) {
        if (isBuy) {
            updatedData.top_dust_buyer_rows = updatedData.top_dust_buyer_rows.map((row) => {
                if (row.user_buyer === trade.user_buyer) {
                    return {
                        ...row,
                        total_dust_trades: row.total_dust_trades + tradeIncrement,
                        total_dust_volume: row.total_dust_volume + tradeValue,
                        flash: true,
                        flashColor: rectColor,
                    };
                }
                return row;
            });
        } else {
            updatedData.top_dust_sellers_rows = updatedData.top_dust_sellers_rows.map((row) => {
                if (row.user_seller === trade.user_seller) {
                    return {
                        ...row,
                        total_dust_trades: row.total_dust_trades + tradeIncrement,
                        total_dust_volume: row.total_dust_volume - tradeValue,
                        flash: true,
                        flashColor: rectColor,
                    };
                }
                return row;
            });
        }

        // Update dust total
        updatedData.top_dust_total_rows.total_dust_trades += tradeIncrement;
        updatedData.top_dust_total_rows.total_dust_volume += tradeValue;
    }

    // --- Period Market Totals ---
    if (isBuy) {
        updatedData.period_market_buys.total_trades += tradeIncrement;
        updatedData.period_market_buys.total_volume += tradeValue;
    } else {
        updatedData.period_market_sells.total_trades += tradeIncrement;
        updatedData.period_market_sells.total_volume += tradeValue;
    }

    updatedData.period_market_total.total_trades += tradeIncrement;
    updatedData.period_market_total.total_volume += tradeValue;

    return updatedData;
}
