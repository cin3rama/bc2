'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

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
            backgroundColor: 'var(--background)',
        },
        title: {
            text: `Trend Chart - ${period}`,
            style: { color: '#D3D3D3' },
        },
        subtitle: {
            text: 'Time Series Data',
            style: { color: '#D3D3D3' },
        },
        xAxis: {
            type: 'datetime',
            tickColor: '#D3D3D3',
            labels: { style: { color: '#D3D3D3' } },
        },
        yAxis: {
            title: { text: 'Slope', style: { color: '#D3D3D3' } },
            labels: { style: { color: '#D3D3D3' } },
        },
        tooltip: {
            xDateFormat: '%Y-%m-%d %H:%M:%S',
            style: { color: '#D3D3D3' },
        },
        legend: {
            itemStyle: { color: '#D3D3D3' },
        },
        series: [
            {
                name: `${period} Slope`,
                type: 'line',
                data: seriesData,
                lineWidth: 2,
                color: 'magenta',
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
