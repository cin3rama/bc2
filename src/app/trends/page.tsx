'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useWebsocket } from '@/hooks/useWebsocket';

// Define the shape of a trend data object.
type TrendData = {
    ticker: string;
    freq: string; // e.g. '5min', '15min', etc.
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

// Define a type for holding slope data per period.
type SlopeData = {
    slope_5min: number | null;
    slope_15min: number | null;
    slope_30min: number | null;
    slope_1h: number | null;
    slope_4hr: number | null;
    slope_1D: number | null;
};

// Helper function to convert a regression line ([startY, endY]) into an array of two points.
// Fixed x-values of -1 and 1 ensure that the line is centered (midpoint at x = 0).
const getLineData = (line: [number, number] | null) =>
    line ? [[-1, line[0]], [1, line[1]]] : [];

const TrendAnalysisPage = () => {
    // Using trend$ instead of orderflow$
    const { trend$ } = useWebsocket();

    // Initialize chart data and slope data with null values.
    const [chartData, setChartData] = useState<ChartData>({
        regression_line_5min: null,
        regression_line_15min: null,
        regression_line_30min: null,
        regression_line_1h: null,
        regression_line_4hr: null,
        regression_line_1D: null,
    });

    const [slopeData, setSlopeData] = useState<SlopeData>({
        slope_5min: null,
        slope_15min: null,
        slope_30min: null,
        slope_1h: null,
        slope_4hr: null,
        slope_1D: null,
    });

    // Mapping for slope indicators.
    const slopeMapping = [
        { key: 'slope_5min', display: '5 min', color: 'magenta' },
        { key: 'slope_15min', display: '15 min', color: 'orange' },
        { key: 'slope_30min', display: '30 min', color: 'teal' },
        { key: 'slope_1h', display: '1 hr', color: 'green' },
        { key: 'slope_4hr', display: '4 hr', color: 'hotpink' },
        { key: 'slope_1D', display: '1 day', color: 'cyan' },
    ];

    // Set up Highcharts options.
    const [chartOptions, setChartOptions] = useState<Highcharts.Options>({
        chart: {
            backgroundColor: 'var(--background)',
        },
        title: {
            text: 'Periods Trend Chart',
            style: { color: '#D3D3D3' },
        },
        subtitle: {
            text: 'Linear Regression Line of Best Fit',
            style: { color: '#D3D3D3' },
        },
        legend: {
            itemStyle: { color: '#D3D3D3' },
        },
        xAxis: [{
            min: -1,
            max: 1,
            tickColor: '#D3D3D3',
            labels: { style: { color: '#D3D3D3' } },
        }],
        yAxis: [{
            labels: { style: { color: '#D3D3D3' } },
        }],
        tooltip: {
            style: { color: '#D3D3D3' },
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
                lineWidth: 2,
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
                lineWidth: 2,
            },
            {
                name: '1 hr',
                type: 'line',
                data: getLineData(chartData.regression_line_1h),
                color: 'green',
                lineWidth: 2,
            },
            {
                name: '4 hr',
                type: 'line',
                data: getLineData(chartData.regression_line_4hr),
                color: 'hotpink',
                lineWidth: 2,
            },
            {
                name: '1 day',
                type: 'line',
                data: getLineData(chartData.regression_line_1D),
                color: 'cyan',
                lineWidth: 2,
            },
        ],
    });

    // Subscribe to the websocket observable and update chartData and slopeData.
    useEffect(() => {
        const subscription = trend$.subscribe((dataArrays: TrendData[][]) => {
            const flattened = dataArrays.flat();
            const updatedChartData: Partial<ChartData> = {};
            const updatedSlopeData: Partial<SlopeData> = {};

            flattened.forEach((item) => {
                const { freq, regression_line, slope } = item;
                switch (freq) {
                    case '5min':
                        updatedChartData.regression_line_5min = regression_line;
                        updatedSlopeData.slope_5min = slope;
                        break;
                    case '15min':
                        updatedChartData.regression_line_15min = regression_line;
                        updatedSlopeData.slope_15min = slope;
                        break;
                    case '30min':
                        updatedChartData.regression_line_30min = regression_line;
                        updatedSlopeData.slope_30min = slope;
                        break;
                    case '1h':
                        updatedChartData.regression_line_1h = regression_line;
                        updatedSlopeData.slope_1h = slope;
                        break;
                    case '4h':
                        updatedChartData.regression_line_4hr = regression_line;
                        updatedSlopeData.slope_4hr = slope;
                        break;
                    case '24h': // 1 day is now represented as '24h'
                        updatedChartData.regression_line_1D = regression_line;
                        updatedSlopeData.slope_1D = slope;
                        break;
                    default:
                        break;
                }
            });
            setChartData((prev) => ({ ...prev, ...updatedChartData }));
            setSlopeData((prev) => ({ ...prev, ...updatedSlopeData }));
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
                    lineWidth: 2,
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
                    lineWidth: 2,
                },
                {
                    name: '1 hr',
                    type: 'line',
                    data: getLineData(chartData.regression_line_1h),
                    color: 'green',
                    lineWidth: 2,
                },
                {
                    name: '4 hr',
                    type: 'line',
                    data: getLineData(chartData.regression_line_4hr),
                    color: 'hotpink',
                    lineWidth: 2,
                },
                {
                    name: '1 day',
                    type: 'line',
                    data: getLineData(chartData.regression_line_1D),
                    color: 'cyan',
                    lineWidth: 2,
                },
            ],
        }));
    }, [chartData]);

    return (
        <div className="p-4 w-full flex flex-col items-center">
            {/* Slope Indicator Area */}
            <div className="w-full max-w-4xl bg-[var(--background)] text-[#D3D3D3] p-4">
                <h2 className="text-center text-xl font-bold">Trend/Slope Indicator</h2>
                <div className="flex justify-around mt-2">
                    {slopeMapping.map((mapping) => (
                        <div key={mapping.key} className="text-center">
                            <span>{mapping.display}: </span>
                            <span style={{ color: mapping.color }}>
                {slopeData[mapping.key as keyof SlopeData] !== null
                    ? slopeData[mapping.key as keyof SlopeData]?.toFixed(2)
                    : '-'}
              </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chart Area */}
            <div className="w-full max-w-4xl">
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </div>
        </div>
    );
};

export default TrendAnalysisPage;
