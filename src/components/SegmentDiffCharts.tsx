// SegmentDiffCharts.tsx
import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

interface SegmentDiffChartsProps {
    data: any;
    period: string;
    resetTime: number;
}

const SegmentDiffCharts: React.FC<SegmentDiffChartsProps> = ({ data, period, resetTime }) => {
    const [chartData1, setChartData1] = useState<number[][]>([]); // [timestamp, value]
    const [chartData2, setChartData2] = useState<{ [key: string]: number[][] }>({});
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const getDiff = () => {
        const sum = (rows: any[]) => rows.reduce((acc, r) => acc + (r.total_vol_trades || r.net_holding || 0), 0);
        return {
            mm: sum(data.mm_buyers_rows) + sum(data.mm_sellers_rows),
            acc: sum(data.top_accumulators_rows),
            dust: sum(data.top_dust_buyer_rows) + sum(data.top_dust_sellers_rows),
            total: data.period_market_buys.total_volume + data.period_market_sells.total_volume,
        };
    };

    // @ts-ignore
    useEffect(() => {
        setChartData1([]);
        setChartData2({ mm: [], acc: [], dust: [], retail: [] });
        const start = Date.now();

        timerRef.current = setInterval(() => {
            const now = Date.now();
            const diff = getDiff();
            const retail = diff.total - (diff.mm + diff.acc + diff.dust);
            const t = now;

            setChartData1((prev) => [...prev.slice(-59), [t, diff.mm], [t, diff.acc]]);
            setChartData2((prev) => ({
                mm: [...(prev.mm || []).slice(-59), [t, diff.mm]],
                acc: [...(prev.acc || []).slice(-59), [t, diff.acc]],
                dust: [...(prev.dust || []).slice(-59), [t, diff.dust]],
                retail: [...(prev.retail || []).slice(-59), [t, retail]],
            }));
        }, 60000);

        return () => timerRef.current && clearInterval(timerRef.current);
    }, [resetTime]);

    return (
        <div className="grid md:grid-cols-1 gap-6 mt-4">
            {/* Chart 1: MM + Accum/Dist */}
            <div>
                <h4 className="text-sm font-bold mb-1">Net Diff Over Time (Market Makers vs Acc/Dist)</h4>
                <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                        chart: { type: 'line' },
                        title: { text: undefined },
                        xAxis: { type: 'datetime' },
                        yAxis: { title: { text: 'Net USD Volume' } },
                        series: [
                            { name: 'Market Makers', data: chartData1.filter((_, i) => i % 2 === 0), type: 'line' },
                            { name: 'Acc/Dist', data: chartData1.filter((_, i) => i % 2 === 1), type: 'line' },
                        ],
                    }}
                />
            </div>

            {/* Chart 2: All Segments */}
            <div>
                <h4 className="text-sm font-bold mb-1">Net Diff Over Time (All Segments)</h4>
                <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                        chart: { type: 'line' },
                        title: { text: undefined },
                        xAxis: { type: 'datetime' },
                        yAxis: { title: { text: 'Net USD Volume' } },
                        series: [
                            { name: 'Market Makers', data: chartData2.mm, type: 'line' },
                            { name: 'Acc/Dist', data: chartData2.acc, type: 'line' },
                            { name: 'Dust', data: chartData2.dust, type: 'line' },
                            { name: 'Retail', data: chartData2.retail, type: 'line' },
                        ],
                    }}
                />
            </div>
        </div>
    );
};

export default SegmentDiffCharts;
