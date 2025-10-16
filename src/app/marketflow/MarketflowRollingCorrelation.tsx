"use client";

import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";

export type XY = [number, number | null];

export interface RollingCorrelationProps {
    corr: XY[];
    isDark: boolean;
}

export interface ChartHandle {
    getChart: () => Highcharts.Chart | null;
}

const MarketflowRollingCorrelation = forwardRef<ChartHandle, RollingCorrelationProps>(
    ({ corr, isDark }, ref) => {
        // @ts-ignore
        const options = useMemo<Highcharts.Options>(() => {
            return {
                chart: {
                    backgroundColor: "transparent",
                    zoomType: "x",
                },
                title: {
                    text: "Rolling Correlation (ΔFlow vs ΔPrice)",
                    style: { color: isDark ? "#fff" : "#000" },
                },
                credits: { enabled: false },
                time: { useUTC: true },
                rangeSelector: { enabled: false },
                navigator: { enabled: false },
                scrollbar: { enabled: false },
                xAxis: {
                    type: "datetime",
                    ordinal: false,
                    lineColor: isDark ? "#444" : "#ddd",
                    gridLineWidth: 0,
                    dateTimeLabelFormats: {
                        minute: "%H:%M",
                        hour: "%H:%M",
                    },
                },
                yAxis: {
                    title: { text: "Correlation", style: { color: isDark ? "#fff" : "#000" } },
                    gridLineColor: isDark ? "#333" : "#eee",
                    min: -1,
                    max: 1,
                    plotLines: [
                        { value: 0, color: isDark ? "#888" : "#666", width: 1.5, zIndex: 5 },
                        { value: 1, color: "#4ade80", width: 0.8, dashStyle: "ShortDot" },
                        { value: -1, color: "#f87171", width: 0.8, dashStyle: "ShortDot" },
                    ],
                },
                tooltip: {
                    shared: true,
                    xDateFormat: "%Y-%m-%d %H:%M:%S UTC",
                    valueDecimals: 3,
                    backgroundColor: isDark ? "#111" : "#fff",
                    borderColor: isDark ? "#666" : "#ccc",
                    style: { color: isDark ? "#fff" : "#000" },
                },
                legend: { enabled: false },
                plotOptions: {
                    series: {
                        animation: false,
                        connectNulls: true,
                        dataGrouping: { enabled: false },
                    },
                },
                series: [
                    {
                        type: "line",
                        name: "Rolling Correlation",
                        data: corr as any,
                        color: "#3b82f6",
                        tooltip: { valueDecimals: 3 },
                    },
                ],
            };
        }, [corr, isDark]);

        let chartRef: HighchartsReact.RefObject = null as any;

        useImperativeHandle(ref, () => ({
            getChart: () => chartRef?.chart ?? null,
        }));

        return (
            <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={options}
                callback={(c: any) => {
                    (chartRef as any) = { chart: c };
                }}
            />
        );
    }
);

export default MarketflowRollingCorrelation;
