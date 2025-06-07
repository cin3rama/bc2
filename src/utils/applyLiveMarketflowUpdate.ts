// applyLiveMarketflowUpdate.ts

// @ts-ignore
export function applyLiveMarketflowUpdate(liveData, currentData) {
    const updated = structuredClone(currentData);

    const isBuy = liveData.side === 'BUY';
    const tradeValue = parseFloat(liveData.size) * parseFloat(liveData.price);
    const address = isBuy ? liveData.user_buyer : liveData.user_seller;

    // === Market Makers ===
    const mmKey = isBuy ? 'mm_buyers_rows' : 'mm_sellers_rows';
    const mmAddressKey = isBuy ? 'user_buyer' : 'user_seller';
    // @ts-ignore
    updated[mmKey] = updated[mmKey]?.map(row => {
        if (row[mmAddressKey] === address) {
            row.total_number_of_trades += 1;
            row.total_vol_trades += isBuy ? tradeValue : -tradeValue;
        }
        return row;
    });

    // === Accumulators/Distributors ===
    const accKey = isBuy ? 'top_accumulators_rows' : 'top_distributors_rows';
    const accAddressKey = isBuy ? 'top_buyer' : 'top_seller';
    // @ts-ignore
    updated[accKey] = updated[accKey]?.map(row => {
        if (row[accAddressKey] === address) {
            row.net_holding += isBuy ? tradeValue : -tradeValue;
        }
        return row;
    });

    // === Dust (Optional: Apply if logic needed, e.g. size <= threshold) ===
    const dustThreshold = 0.0002;
    if (parseFloat(liveData.size) <= dustThreshold) {
        const dustKey = isBuy ? 'top_dust_buyer_rows' : 'top_dust_sellers_rows';
        const dustAddressKey = isBuy ? 'user_buyer' : 'user_seller';
        // @ts-ignore
        updated[dustKey] = updated[dustKey]?.map(row => {
            if (row[dustAddressKey] === address) {
                row.total_number_of_trades += 1;
                row.total_vol_trades += isBuy ? tradeValue : -tradeValue;
            }
            return row;
        });

        // Update top_dust_total_rows
        if (updated.top_dust_total_rows) {
            updated.top_dust_total_rows.total_dust_trades += 1;
            updated.top_dust_total_rows.total_dust_volume += tradeValue;
        }
    }

    // === Period Market Totals ===
    if (updated.period_market_buys && isBuy) {
        updated.period_market_buys.total_trades += 1;
        updated.period_market_buys.total_volume += tradeValue;
    } else if (updated.period_market_sell && !isBuy) {
        updated.period_market_sell.total_trades += 1;
        updated.period_market_sell.total_volume -= tradeValue;
    }

    if (updated.period_market_total) {
        updated.period_market_total.total_trades += 1;
        updated.period_market_total.total_volume += Math.abs(tradeValue);
    }

    return updated;
}
