"use client";


import React, { forwardRef, useImperativeHandle, useMemo } from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";


export type OHLC = [number, number | null, number | null, number | null, number | null];


export interface CandlesChartProps {
    ohlc: OHLC[];
    isDark: boolean;
    onSetExtremes?: (min: number, max: number, meta?: { trigger?: string }) => void;
}


export interface ChartHandle { getChart: () => Highcharts.Chart | null }


const MarketflowCandlesChart = forwardRef<ChartHandle, CandlesChartProps>(
    ({ ohlc, isDark, onSetExtremes }, ref) => {
        const options = useMemo<Highcharts.Options>(() => ({
            chart: { backgroundColor: "transparent" },
            //@ts-ignore
            time: { useUTC: true },
            rangeSelector: { enabled: false },
            navigator: { enabled: true },
            scrollbar: { enabled: true },
            title: { text: "1‑Minute Candles", style: { color: isDark ? "#fff" : "#000" } },
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
                title: { text: "Price", style: { color: isDark ? "#fff" : "#000" } },
                gridLineColor: isDark ? "#333" : "#eee",
            },
            tooltip: { split: true, xDateFormat: "%Y-%m-%d %H:%M:%S UTC" },
            plotOptions: {
                series: { dataGrouping: { enabled: false } },
            },
            series: [
                { type: "candlestick", name: "Price", data: ohlc as any },
            ],
        }), [ohlc, isDark, onSetExtremes]);


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


export default MarketflowCandlesChart;