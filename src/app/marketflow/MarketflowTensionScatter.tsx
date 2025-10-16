"use client";

import React, { useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

interface ScatterPoint {
    x: number;
    y: number;
    ts: number;
}

interface Props {
    points: ScatterPoint[];
    isDark: boolean;
}

export default function MarketflowTensionScatter({ points, isDark }: Props) {
    const options = useMemo<Highcharts.Options>(() => {
        return {
            chart: { type: "scatter", backgroundColor: "transparent" },
            title: { text: "Flow–Price Tension Map", style: { color: isDark ? "#fff" : "#000" } },
            credits: { enabled: false },
            xAxis: {
                type: "linear", // prevents 1970 slider issue
                title: { text: "Δ Directional Diff", style: { color: isDark ? "#fff" : "#000" } },
                lineColor: isDark ? "#444" : "#ddd",
                gridLineWidth: 0,
                plotLines: [{ value: 0, color: isDark ? "#888" : "#666", width: 1.5 }],
            },
            yAxis: {
                title: { text: "Δ Price", style: { color: isDark ? "#fff" : "#000" } },
                gridLineColor: isDark ? "#333" : "#eee",
                plotLines: [{ value: 0, color: isDark ? "#888" : "#666", width: 1.5 }],
            },
            tooltip: {
                formatter: function () {
                    // @ts-ignore
                    const p = this.point;
                    const dt = new Date(p.ts).toISOString().replace("T", " ").replace(".000Z", " UTC");
                    return `<b>${dt}</b><br>ΔDiff: ${p.x.toFixed(2)}<br>ΔPrice: ${p.y.toFixed(4)}`;
                },
                backgroundColor: isDark ? "#111" : "#fff",
                borderColor: isDark ? "#666" : "#ccc",
                style: { color: isDark ? "#fff" : "#000" },
            },
            plotOptions: {
                scatter: {
                    marker: { radius: 3, symbol: "circle" },
                    states: { hover: { enabled: true, lineWidthPlus: 0 } },
                },
                series: { animation: false },
            },
            series: [
                {
                    type: "scatter",
                    name: "ΔFlow vs ΔPrice",
                    data: points.map((p) => ({ x: p.x, y: p.y, ts: p.ts })),
                },
            ],
        };
    }, [points, isDark]);

    return (
        <HighchartsReact highcharts={Highcharts} options={options} />
    );
}
