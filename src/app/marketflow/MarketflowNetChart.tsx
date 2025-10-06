"use client";

import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";


export type XY = [number, number | null];


export interface NetChartProps {
    mmNet: XY[];
    adNet: XY[];
    isDark: boolean;
    onSetExtremes?: (min: number, max: number, meta?: { trigger?: string }) => void;
}


export interface ChartHandle {
    getChart: () => Highcharts.Chart | null;
}


function symmetricExtents(seriesA: XY[], seriesB: XY[]) {
    const values = [...seriesA, ...seriesB]
        .map(([, v]) => (v == null ? null : Number(v)))
        .filter((v): v is number => Number.isFinite(v as number));
    if (!values.length) return { min: -1, max: 1 };
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)));
    const pad = maxAbs === 0 ? 1 : maxAbs * 0.05;
    return { min: -(maxAbs + pad), max: maxAbs + pad };
}

const MarketflowNetChart = forwardRef<ChartHandle, NetChartProps>(
    ({ mmNet, adNet, isDark, onSetExtremes }, ref) => {
        //@ts-ignore
        const options = useMemo<Highcharts.Options>(() => {
            const { min, max } = symmetricExtents(mmNet as XY[], adNet as XY[]);
            return {
                chart: {
                    backgroundColor: "transparent",
                    zoomType: "x",
                },
                time: { useUTC: true },
                rangeSelector: { enabled: false },
                navigator: { enabled: false },
                scrollbar: { enabled: false },
                title: { text: "Marketflow Net Values (1‑min)", style: { color: isDark ? "#fff" : "#000" } },
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
                        setExtremes: function (e: any) {
                            if (e.trigger === "sync") return;
                            if (typeof e.min === "number" && typeof e.max === "number") {
                                onSetExtremes?.(e.min, e.max, { trigger: e.trigger });
                            }
                        },
                    },
                },
                yAxis: {
                    title: { text: "Net Value", style: { color: isDark ? "#fff" : "#000" } },
                    gridLineColor: isDark ? "#333" : "#eee",
                    min,
                    max,
                    plotLines: [{ value: 0, color: isDark ? "#888" : "#666", width: 1.5, zIndex: 5 }],
                },
                legend: { enabled: true, itemStyle: { color: isDark ? "#fff" : "#000" } },
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
                    { type: "line", name: "Market Makers (NET)", data: mmNet as any },
                    { type: "line", name: "Accumulators/Distributors (NET)", data: adNet as any },
                ],
            };
        }, [mmNet, adNet, isDark, onSetExtremes]);

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
// expose chart instance through ref
                    (chartRef as any) = { chart: c };
                }}
            />
        );
    }
);


export default MarketflowNetChart;