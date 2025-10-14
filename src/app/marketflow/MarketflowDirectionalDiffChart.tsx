"use client";

import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";

export type XY = [number, number | null];

export interface DiffChartProps {
    diff: XY[];           // directional_diff_data (or derived)
    isDark: boolean;
    onSetExtremes?: (min: number, max: number, meta?: { trigger?: string }) => void;
}

export interface ChartHandle {
    getChart: () => Highcharts.Chart | null;
}

function symmetricExtentFrom(series: XY[]) {
    const values = (series ?? [])
        .map(([, v]) => (v == null ? null : Number(v)))
        .filter((v): v is number => Number.isFinite(v as number));

    if (!values.length) return { min: -1, max: 1 };
    const maxAbs = Math.max(...values.map(Math.abs));
    const pad = maxAbs === 0 ? 1 : maxAbs * 0.05;
    return { min: -(maxAbs + pad), max: maxAbs + pad };
}

const MarketflowDirectionalDiffChart = forwardRef<ChartHandle, DiffChartProps>(
    ({ diff, isDark, onSetExtremes }, ref) => {
        // @ts-ignore
        const options = useMemo<Highcharts.Options>(() => {
            const { min, max } = symmetricExtentFrom(diff);
            return {
                chart: {
                    backgroundColor: "transparent",
                    zoomType: "x",
                },
                time: { useUTC: true },
                rangeSelector: { enabled: false },
                navigator: { enabled: false },
                scrollbar: { enabled: false },
                title: { text: "Directional Difference (MM + ACC/DIS)", style: { color: isDark ? "#fff" : "#000" } },
                credits: { enabled: false },
                xAxis: {
                    type: "datetime",
                    ordinal: false,
                    lineColor: isDark ? "#444" : "#ddd",
                    gridLineWidth: 0,
                    dateTimeLabelFormats: {
                        minute: "%H:%M",
                        hour: "%H:%M",
                    },
                    events: {
                        setExtremes: (e: any) => {
                            if (e.trigger === "sync") return;
                            if (typeof e.min === "number" && typeof e.max === "number") {
                                onSetExtremes?.(e.min, e.max, { trigger: e.trigger });
                            }
                        },
                    },
                },
                yAxis: {
                    title: { text: "Directional Diff", style: { color: isDark ? "#fff" : "#000" } },
                    gridLineColor: isDark ? "#333" : "#eee",
                    min,
                    max,
                    plotLines: [{ value: 0, color: isDark ? "#888" : "#666", width: 1.5, zIndex: 5 }],
                },
                legend: { enabled: false },
                tooltip: { shared: true, xDateFormat: "%Y-%m-%d %H:%M:%S UTC", valueDecimals: 2 },
                plotOptions: {
                    series: {
                        animation: false,
                        marker: { enabled: false },
                        connectNulls: true,
                        dataGrouping: { enabled: false },
                    },
                },
                series: [
                    { type: "line", name: "Directional Diff", data: diff as any },
                ],
            };
        }, [diff, isDark, onSetExtremes]);

        let chartRef: HighchartsReact.RefObject = null as any;

        useImperativeHandle(ref, () => ({
            getChart: () => chartRef?.chart ?? null,
        }));

        return (
            <HighchartsReact
                highcharts={Highcharts}
                constructorType="stockChart"
                options={options}
                callback={(c: any) => { (chartRef as any) = { chart: c }; }}
            />
        );
    }
);

export default MarketflowDirectionalDiffChart;
