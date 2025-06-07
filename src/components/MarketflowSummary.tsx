// MarketflowSummary.tsx
import React, { useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

interface MarketflowSummaryProps {
    data: any;
    resetTime: number;
}

const MarketflowSummary: React.FC<MarketflowSummaryProps> = ({ data, resetTime }) => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const elapsedTime = useRef(0);

    // @ts-ignore
    useEffect(() => {
        elapsedTime.current = 0;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            elapsedTime.current++;
        }, 1000);
        return () => timerRef.current && clearInterval(timerRef.current);
    }, [resetTime]);

    // === Helper: Absolute Buy+Sell Totals ===
    const totalVolumes = () => {
        const mm = data.mm_buyers_rows.concat(data.mm_sellers_rows);
        const acc = data.top_accumulators_rows.concat(data.top_distributors_rows);
        const dust = data.top_dust_buyer_rows.concat(data.top_dust_sellers_rows);
        const total = data.period_market_total.total_volume;

        const sum = (rows: any[], field = 'total_vol_trades') =>
            rows.reduce((acc, r) => acc + Math.abs(r[field] || 0), 0);

        const mmVol = sum(mm);
        const accVol = sum(acc, 'net_holding');
        const dustVol = sum(dust);
        const retailVol = Math.abs(total - (mmVol + accVol + dustVol));

        return [
            { name: 'Market Makers', y: mmVol },
            { name: 'Acc/Dist', y: accVol },
            { name: 'Dust', y: dustVol },
            { name: 'Retail', y: retailVol },
        ];
    };

    // === Helper: Net Diffs (Buy - Sell) ===
    const netDiffs = () => {
        const net = (buyRows: any[], sellRows: any[]) => {
            const buy = buyRows.reduce((a, r) => a + (r.total_vol_trades || 0), 0);
            const sell = sellRows.reduce((a, r) => a + (r.total_vol_trades || 0), 0);
            return buy + sell; // sell is negative, so add
        };

        const mmDiff = net(data.mm_buyers_rows, data.mm_sellers_rows);
        //@ts-ignore
        const accDiff = data.top_accumulators_rows.reduce((a, r) => a + (r.net_holding || 0), 0);
        const dustDiff = net(data.top_dust_buyer_rows, data.top_dust_sellers_rows);
        const totalDiff = (data.period_market_buys.total_volume || 0) + (data.period_market_sells.total_volume || 0);
        const retailDiff = totalDiff - (mmDiff + accDiff + dustDiff);

        return [
            { name: 'Market Makers', y: mmDiff },
            { name: 'Acc/Dist', y: accDiff },
            { name: 'Dust', y: dustDiff },
            { name: 'Retail', y: retailDiff },
        ];
    };

    return (
        <div className="grid md:grid-cols-2 gap-4 mt-4">
            {/* Pie Chart: Total Volume Share */}
            <div>
                <h4 className="text-sm font-bold mb-1">Total Market Volume by Segment</h4>
                <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                        chart: { type: 'pie' },
                        title: { text: undefined },
                        series: [
                            {
                                name: 'Volume',
                                data: totalVolumes(),
                                type: 'pie',
                            },
                        ],
                    }}
                />
            </div>

            {/* Pie Chart: Net Diff Share */}
            <div>
                <h4 className="text-sm font-bold mb-1">Net Diff Share (Buy - Sell)</h4>
                <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                        chart: { type: 'pie' },
                        title: { text: undefined },
                        series: [
                            {
                                name: 'Net Diff',
                                data: netDiffs(),
                                type: 'pie',
                            },
                        ],
                    }}
                />
            </div>
        </div>
    );
};

export default MarketflowSummary;
