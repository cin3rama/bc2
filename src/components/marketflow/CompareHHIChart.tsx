'use client';

import React, {
    useMemo,
    useRef,
    useImperativeHandle,
    forwardRef,
} from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

export type TimeSeriesPoint = [number, number];

export interface CompareHHIChartProps {
    data: TimeSeriesPoint[];
}

export interface CompareHHIChartHandle {
    getChart: () => Highcharts.Chart | undefined;
}

/**
 * HHI Spread (MM – AD)
 * Positive = MM more concentrated, Negative = AD more concentrated.
 */
const CompareHHIChart = forwardRef<CompareHHIChartHandle, CompareHHIChartProps>(
    ({ data }, ref) => {
        const hcRef = useRef<HighchartsReact.RefObject>(null);

        useImperativeHandle(ref, () => ({
            getChart: () => hcRef.current?.chart,
        }));

        const options = useMemo<Highcharts.Options>(
            () => ({
                chart: {
                    type: 'line',
                    height: 280,
                    backgroundColor: 'transparent',
                },
                title: { text: undefined },
                xAxis: {
                    type: 'datetime',
                    lineColor: '#e5e7eb',
                    tickColor: '#e5e7eb',
                },
                yAxis: {
                    title: { text: 'HHI Spread (MM – AD)' },
                    gridLineColor: 'rgba(148, 163, 184, 0.35)',
                    plotLines: [
                        {
                            value: 0,
                            width: 1,
                            color: '#6b7280',
                            dashStyle: 'ShortDash',
                            zIndex: 3,
                        },
                    ],
                },
                legend: { enabled: false },
                credits: { enabled: false },
                tooltip: {
                    shared: true,
                    xDateFormat: '%Y-%m-%d %H:%M',
                    valueDecimals: 2,
                },
                series: [
                    {
                        type: 'line',
                        name: 'HHI Spread (MM – AD)',
                        data,
                    },
                ],
            }),
            [data]
        );

        if (!data || data.length === 0) {
            return (
                <div className="flex h-72 items-center justify-center text-sm text-neutral-500 dark:text-neutral-100/70">
                    Waiting for first live update…
                </div>
            );
        }

        return (
            <div className="h-72">
                <HighchartsReact ref={hcRef as any} highcharts={Highcharts} options={options} />
            </div>
        );
    }
);

CompareHHIChart.displayName = 'CompareHHIChart';

export default CompareHHIChart;
