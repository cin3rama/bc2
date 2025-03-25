'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { colorMapping } from '@/types/types-chart';

export type TrendDataPoint = {
    time_started: number;
    ticker: string;
    freq: string; // using "freq" instead of "period"
    slope: string; // slope is provided as a string
    regression_line: [number, number];
};

type TrendTimeSeriesChartProps = {
    period: string;
    data: TrendDataPoint[];
};

const TrendTimeSeriesChart: React.FC<TrendTimeSeriesChartProps> = ({ period, data }) => {
    // Delay rendering until after mounting
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const seriesData = data
        .map((point) => [point.time_started, Number(point.slope)])
        .sort((a, b) => a[0] - b[0]);

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: 'var(--chart-bg)',
        },
        title: {
            text: `Trend Chart - ${period}`,
            style: { color: 'var(--chart-text-color)' },
        },
        subtitle: {
            text: 'Time Series Data',
            style: { color: 'var(--chart-text-color)' },
        },
        xAxis: {
            type: 'datetime',
            tickColor: 'var(--chart-text-color)',
            labels: { style: { color: 'var(--chart-text-color)' } },
        },
        yAxis: {
            title: { text: 'Slope', style: { color: 'var(--chart-text-color)' } },
            labels: { style: { color: 'var(--chart-text-color)' } },
        },
        tooltip: {
            xDateFormat: '%Y-%m-%d %H:%M:%S',
            style: { color: 'var(--chart-tooltip-color)' },
        },
        legend: {
            itemStyle: { color: 'var(--chart-text-color)' },
        },
        series: [
            {
                name: `${period} Slope`,
                type: 'line',
                data: seriesData,
                lineWidth: 2,
                color: colorMapping[period] || 'magenta',
            },
        ],
    };

    return (
        <div className="w-full max-w-4xl mb-4">
            {mounted && (
                <HighchartsReact
                    highcharts={Highcharts}
                    options={options}
                    immutable={true}
                    allowChartUpdate={true}
                />
            )}
        </div>
    );
};

export default TrendTimeSeriesChart;
