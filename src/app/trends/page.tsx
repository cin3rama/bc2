'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useWebsocket } from '@/hooks/useWebsocket';

// Define the shape of a trend data object.
type TrendData = {
    ticker: string;
    freq: string; // Represents period (e.g., '5min', '15min', etc.)
    slope: number;
    regression_line: [number, number]; // [startY, endY]
    time_started: number;
};

// Define a type for holding regression line data per period.
type ChartData = {
    regression_line_5min: [number, number] | null;
    regression_line_15min: [number, number] | null;
    regression_line_30min: [number, number] | null;
    regression_line_1h: [number, number] | null;
    regression_line_4hr: [number, number] | null;
    regression_line_1D: [number, number] | null;
};

// Helper function to convert a regression line ([startY, endY]) into an array of two points.
// Fixed x-values of -1 and 1 ensure that the line is centered (midpoint at x = 0).
const getLineData = (line: [number, number] | null) =>
    line ? [[-1, line[0]], [1, line[1]]] : [];

const TrendAnalysisPage = () => {
    // Using trend$ instead of orderflow$
    const { trend$ } = useWebsocket();

    // Initialize chart data with null values.
    const [chartData, setChartData] = useState<ChartData>({
        regression_line_5min: null,
        regression_line_15min: null,
        regression_line_30min: null,
        regression_line_1h: null,
        regression_line_4hr: null,
        regression_line_1D: null,
    });

    // Set up Highcharts options.
    const [chartOptions, setChartOptions] = useState<Highcharts.Options>({
        chart: {
            backgroundColor: 'var(--background)',
        },
        title: {
            text: 'Periods Trend Chart',
            style: {
                color: '#D3D3D3',
            },
        },
        subtitle: {
            text: 'Linear Regression Line of Best Fit',
            style: {
                color: '#D3D3D3',
            },
        },
        legend: {
            itemStyle: {
                color: '#D3D3D3',
            },
        },
        xAxis: [{
            min: -1,
            max: 1,
            tickColor: '#D3D3D3',
            labels: {
                style: {
                    color: '#D3D3D3',
                },
            },
        }],
        yAxis: [{
            labels: {
                style: {
                    color: '#D3D3D3',
                },
            },
        }],
        tooltip: {
            style: {
                color: '#D3D3D3',
            },
        },
        plotOptions: {
            series: {},
            line: { animation: false },
        },
        series: [
            {
                name: '5 min',
                type: 'line',
                data: getLineData(chartData.regression_line_5min),
                color: 'magenta',
                lineWidth: 1,
            },
            {
                name: '15 min',
                type: 'line',
                data: getLineData(chartData.regression_line_15min),
                color: 'orange',
                lineWidth: 2,
            },
            {
                name: '30 min',
                type: 'line',
                data: getLineData(chartData.regression_line_30min),
                color: 'teal',
                lineWidth: 3,
            },
            {
                name: '1 hr',
                type: 'line',
                data: getLineData(chartData.regression_line_1h),
                color: 'green',
                lineWidth: 4,
            },
            {
                name: '4 hr',
                type: 'line',
                data: getLineData(chartData.regression_line_4hr),
                color: 'purple',
                lineWidth: 8,
            },
            {
                name: '1 day',
                type: 'line',
                data: getLineData(chartData.regression_line_1D),
                color: 'black',
                lineWidth: 8,
            },
        ],
    });

    // Subscribe to the websocket observable and update chartData.
    useEffect(() => {
        const subscription = trend$.subscribe((dataArrays: TrendData[][]) => {
            // Flatten the array-of-arrays into a single array.
            const flattened = dataArrays.flat();
            // Prepare an update for the chart data.
            const updatedChartData: Partial<ChartData> = {};
            flattened.forEach((item) => {
                const { freq, regression_line } = item;
                switch (freq) {
                    case '5min':
                        updatedChartData.regression_line_5min = regression_line;
                        break;
                    case '15min':
                        updatedChartData.regression_line_15min = regression_line;
                        break;
                    case '30min':
                        updatedChartData.regression_line_30min = regression_line;
                        break;
                    case '1h':
                        updatedChartData.regression_line_1h = regression_line;
                        break;
                    case '4h':
                        updatedChartData.regression_line_4hr = regression_line;
                        break;
                    case '1d':
                        updatedChartData.regression_line_1D = regression_line;
                        break;
                    default:
                        break;
                }
            });
            setChartData((prev) => ({ ...prev, ...updatedChartData }));
        });
        return () => subscription.unsubscribe();
    }, [trend$]);

    // Update chart options whenever chartData changes.
    useEffect(() => {
        setChartOptions((prevOptions) => ({
            ...prevOptions,
            series: [
                {
                    name: '5 min',
                    type: 'line',
                    data: getLineData(chartData.regression_line_5min),
                    color: 'magenta',
                    lineWidth: 1,
                },
                {
                    name: '15 min',
                    type: 'line',
                    data: getLineData(chartData.regression_line_15min),
                    color: 'orange',
                    lineWidth: 2,
                },
                {
                    name: '30 min',
                    type: 'line',
                    data: getLineData(chartData.regression_line_30min),
                    color: 'teal',
                    lineWidth: 3,
                },
                {
                    name: '1 hr',
                    type: 'line',
                    data: getLineData(chartData.regression_line_1h),
                    color: 'green',
                    lineWidth: 4,
                },
                {
                    name: '4 hr',
                    type: 'line',
                    data: getLineData(chartData.regression_line_4hr),
                    color: 'purple',
                    lineWidth: 8,
                },
                {
                    name: '1 day',
                    type: 'line',
                    data: getLineData(chartData.regression_line_1D),
                    color: 'black',
                    lineWidth: 8,
                },
            ],
        }));
    }, [chartData]);

    return (
        <div className="p-4 w-full flex justify-center">
            <div className="w-full max-w-4xl">
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </div>
        </div>
    );
};

export default TrendAnalysisPage;
