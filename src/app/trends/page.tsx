'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useWebsocket } from '@/hooks/useWebsocket';
import TrendChartsSection from '@/components/TrendChartsSection';

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
    // Using trend$ from useWebsocket.
    const { trend$ } = useWebsocket();

    // Raw trend data from the websocket (consolidated object).
    const [rawTrendData, setRawTrendData] = useState<{ [key: string]: TrendData[] } | null>(null);

    // Main chart and slope data states.
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

    // Set up initial Highcharts options for the main chart.
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
        xAxis: [
            {
                min: -1,
                max: 1,
                tickColor: '#D3D3D3',
                labels: { style: { color: '#D3D3D3' } },
            },
        ],
        yAxis: [
            {
                labels: { style: { color: '#D3D3D3' } },
            },
        ],
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
                data: getLineData(null),
                color: 'magenta',
                lineWidth: 2,
            },
            {
                name: '15 min',
                type: 'line',
                data: getLineData(null),
                color: 'orange',
                lineWidth: 2,
            },
            {
                name: '30 min',
                type: 'line',
                data: getLineData(null),
                color: 'teal',
                lineWidth: 2,
            },
            {
                name: '1 hr',
                type: 'line',
                data: getLineData(null),
                color: 'green',
                lineWidth: 2,
            },
            {
                name: '4 hr',
                type: 'line',
                data: getLineData(null),
                color: 'hotpink',
                lineWidth: 2,
            },
            {
                name: '1 day',
                type: 'line',
                data: getLineData(null),
                color: 'cyan',
                lineWidth: 2,
            },
        ],
    });

    // Subscribe once to the trend$ observable.
    useEffect(() => {
        const subscription = trend$.subscribe((data: any) => {
            // Expect data to be an array with one consolidated object.
            const consolidated = Array.isArray(data) ? data[0] : data;
            // Save the consolidated data for the child component.
            setRawTrendData(consolidated);

            // Mapping from frequency to the keys in chartData and slopeData.
            const periodMap: { [key: string]: { chartKey: keyof ChartData; slopeKey: keyof SlopeData } } = {
                '5min': { chartKey: 'regression_line_5min', slopeKey: 'slope_5min' },
                '15min': { chartKey: 'regression_line_15min', slopeKey: 'slope_15min' },
                '30min': { chartKey: 'regression_line_30min', slopeKey: 'slope_30min' },
                '1h': { chartKey: 'regression_line_1h', slopeKey: 'slope_1h' },
                '4h': { chartKey: 'regression_line_4hr', slopeKey: 'slope_4hr' },
                '24h': { chartKey: 'regression_line_1D', slopeKey: 'slope_1D' },
            };

            const updatedChartData: Partial<ChartData> = {};
            const updatedSlopeData: Partial<SlopeData> = {};

            // For each period, get the newest data point (first element).
            Object.keys(periodMap).forEach((period) => {
                const periodArray: TrendData[] = consolidated[period];
                if (periodArray && periodArray.length > 0) {
                    // Use the first element as the newest data point.
                    const newest = periodArray[0];
                    updatedChartData[periodMap[period].chartKey] = newest.regression_line;
                    updatedSlopeData[periodMap[period].slopeKey] = newest.slope;
                }
            });

            setChartData((prev) => ({ ...prev, ...updatedChartData }));
            setSlopeData((prev) => ({ ...prev, ...updatedSlopeData }));
        });
        return () => subscription.unsubscribe();
    }, [trend$]);


    // Update chart options when chartData changes.
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

            {/* Main Chart Area */}
            <div className="w-full max-w-4xl">
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </div>

            {/* New Charts Section - pass the raw trend data */}
            <TrendChartsSection trendData={rawTrendData} />
        </div>
    );
};

export default TrendAnalysisPage;
