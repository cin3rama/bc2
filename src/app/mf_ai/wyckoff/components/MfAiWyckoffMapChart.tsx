// app/mf-ai/wyckoff/components/MfAiWyckoffMapChart.tsx
"use client";

import React, {useEffect, useMemo, useState} from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/Card";

type PriceZone = {
    low: number;
    high: number;
    mid: number;
    label: string;
};

type CandlePoint = [number, number, number, number, number];

type ProfileRow = {
    priceLow: number;
    priceHigh: number;
    priceMid: number;
    relativeVolume: number;
    totalVolume: number;
    tradeCount: number;
    insideValueArea: boolean;
    isPoc: boolean;
    isHvn: boolean;
    isLvn: boolean;
};

type ProfileLevels = {
    poc?: PriceZone;
    vah?: PriceZone;
    val?: PriceZone;
    currentPrice?: PriceZone;
};

type KeyLevelOverlay = {
    zone: PriceZone;
    grade?: unknown;
    commentary?: unknown;
};

type WyckoffZoneOverlay = {
    zone: PriceZone;
    label: string;
    status: "confirmed" | "provisional" | "invalidated";
};

type CandleSourceName = "market_chart.requested" | "market_chart.baseline" | "trade_tape.buckets";

type ChartData = {
    candles: CandlePoint[];
    candleSource: CandleSourceName;
    profileRows: ProfileRow[];
    levels: ProfileLevels;
    keyLevels: KeyLevelOverlay[];
    wyckoffZones: WyckoffZoneOverlay[];
    yMin: number;
    yMax: number;
    unavailableReason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
        const normalized = value.replaceAll(",", "").trim();
        if (!normalized) return null;

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function firstPresent(...values: unknown[]): unknown {
    return values.find((value) => value !== null && value !== undefined && value !== "");
}

function formatNumber(value: number | null | undefined, maxFractionDigits = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: maxFractionDigits,
    }).format(value);
}

function formatScalar(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") return value;
    if (typeof value === "number") return formatNumber(value, 4);
    if (typeof value === "boolean") return value ? "true" : "false";

    try {
        return JSON.stringify(value);
    } catch {
        return "—";
    }
}

function parsePriceZone(value: unknown): PriceZone | null {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number" && Number.isFinite(value)) {
        return {
            low: value,
            high: value,
            mid: value,
            label: formatNumber(value),
        };
    }

    if (typeof value === "string") {
        const normalized = value
            .replace(/\s+/g, "")
            .replace(/[—–−]/g, "-")
            .trim();

        if (!normalized) return null;

        const pieces = normalized
            .split("-")
            .map((piece) => Number(piece.replaceAll(",", "")))
            .filter((piece) => Number.isFinite(piece));

        if (pieces.length === 1) {
            const price = pieces[0];
            return {
                low: price,
                high: price,
                mid: price,
                label: value,
            };
        }

        if (pieces.length >= 2) {
            const low = Math.min(pieces[0], pieces[1]);
            const high = Math.max(pieces[0], pieces[1]);

            return {
                low,
                high,
                mid: (low + high) / 2,
                label: value,
            };
        }

        return null;
    }

    if (isRecord(value)) {
        const low = toNumber(firstPresent(
            value.low,
            value.lower,
            value.price_low,
            value.price_min,
            value.start,
            value.from
        ));

        const high = toNumber(firstPresent(
            value.high,
            value.upper,
            value.price_high,
            value.price_max,
            value.end,
            value.to
        ));

        const price = toNumber(firstPresent(
            value.price,
            value.level,
            value.mid,
            value.price_mid,
            value.zone,
            value.price_zone
        ));

        if (low !== null && high !== null) {
            const zoneLow = Math.min(low, high);
            const zoneHigh = Math.max(low, high);

            return {
                low: zoneLow,
                high: zoneHigh,
                mid: (zoneLow + zoneHigh) / 2,
                label: `${formatNumber(zoneLow)}–${formatNumber(zoneHigh)}`,
            };
        }

        if (price !== null) {
            return {
                low: price,
                high: price,
                mid: price,
                label: formatNumber(price),
            };
        }
    }

    return null;
}

function parseMarketChartCandle(value: unknown): CandlePoint | null {
    if (!isRecord(value)) return null;

    const tsMs = toNumber(value.ts_ms);
    const open = toNumber(value.open);
    const high = toNumber(value.high);
    const low = toNumber(value.low);
    const close = toNumber(value.close);

    if (
        tsMs === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
    ) {
        return null;
    }

    return [tsMs, open, high, low, close];
}

function parseTradeTapeBucket(value: unknown): CandlePoint | null {
    if (!isRecord(value)) return null;

    const bucketMs = toNumber(value.bucket_ms);
    const open = toNumber(value.open);
    const high = toNumber(value.high);
    const low = toNumber(value.low);
    const close = toNumber(value.close);

    if (
        bucketMs === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
    ) {
        return null;
    }

    return [bucketMs, open, high, low, close];
}

function parseProfileRow(value: unknown): ProfileRow | null {
    if (!isRecord(value)) return null;

    const priceLow = toNumber(value.price_low);
    const priceHigh = toNumber(value.price_high);
    const priceMid = toNumber(value.price_mid);
    const relativeVolume = toNumber(value.relative_volume);
    const totalVolume = toNumber(value.total_volume);
    const tradeCount = toNumber(value.trade_count);

    if (
        priceLow === null ||
        priceHigh === null ||
        priceMid === null ||
        relativeVolume === null
    ) {
        return null;
    }

    return {
        priceLow,
        priceHigh,
        priceMid,
        relativeVolume,
        totalVolume: totalVolume ?? 0,
        tradeCount: tradeCount ?? 0,
        insideValueArea: value.inside_value_area === true,
        isPoc: value.is_poc === true,
        isHvn: value.is_hvn === true,
        isLvn: value.is_lvn === true,
    };
}

function getSnapshotRecord(snapshot: unknown): Record<string, unknown> {
    return isRecord(snapshot) ? snapshot : {};
}

function getCardsRecord(cards: unknown): Record<string, unknown> {
    return isRecord(cards) ? cards : {};
}

function parseCandleSource(snapshotRecord: Record<string, unknown>): {
    candles: CandlePoint[];
    source: CandleSourceName;
} {
    const marketChart = isRecord(snapshotRecord.market_chart)
        ? snapshotRecord.market_chart
        : {};
    const marketChartCandles = isRecord(marketChart.candles)
        ? marketChart.candles
        : {};

    const requested = Array.isArray(marketChartCandles.requested)
        ? marketChartCandles.requested
            .map(parseMarketChartCandle)
            .filter((item): item is CandlePoint => item !== null)
            .sort((a, b) => a[0] - b[0])
        : [];

    if (requested.length > 0) {
        return {
            candles: requested,
            source: "market_chart.requested",
        };
    }

    const baseline = Array.isArray(marketChartCandles.baseline)
        ? marketChartCandles.baseline
            .map(parseMarketChartCandle)
            .filter((item): item is CandlePoint => item !== null)
            .sort((a, b) => a[0] - b[0])
        : [];

    if (baseline.length > 0) {
        return {
            candles: baseline,
            source: "market_chart.baseline",
        };
    }

    const inputSummary = isRecord(snapshotRecord.input_summary_json)
        ? snapshotRecord.input_summary_json
        : {};
    const tradeTape = isRecord(inputSummary.trade_tape) ? inputSummary.trade_tape : {};
    const buckets = Array.isArray(tradeTape.buckets) ? tradeTape.buckets : [];

    return {
        candles: buckets
            .map(parseTradeTapeBucket)
            .filter((item): item is CandlePoint => item !== null)
            .sort((a, b) => a[0] - b[0]),
        source: "trade_tape.buckets",
    };
}

function collectKeyLevels(cards: unknown): KeyLevelOverlay[] {
    const cardsRecord = getCardsRecord(cards);
    const rawKeyLevels = Array.isArray(cardsRecord.key_levels) ? cardsRecord.key_levels : [];
    const overlays: KeyLevelOverlay[] = [];

    rawKeyLevels.forEach((item) => {
        if (!isRecord(item)) return;

        const zone = parsePriceZone(item.price_zone);
        if (!zone) return;

        overlays.push({
            zone,
            grade: item.grade,
            commentary: item.commentary,
        });
    });

    return overlays;
}

function collectWyckoffZones(cards: unknown): WyckoffZoneOverlay[] {
    const cardsRecord = getCardsRecord(cards);
    const structure = isRecord(cardsRecord.wyckoff_structure)
        ? cardsRecord.wyckoff_structure
        : {};

    const groups: Array<{
        items: unknown;
        status: WyckoffZoneOverlay["status"];
    }> = [
        {items: structure.confirmed_labels, status: "confirmed"},
        {items: structure.provisional_labels, status: "provisional"},
        {items: structure.invalidated_labels, status: "invalidated"},
    ];

    const zones: WyckoffZoneOverlay[] = [];

    groups.forEach((group) => {
        const items = Array.isArray(group.items) ? group.items : [];

        items.forEach((item) => {
            if (!isRecord(item)) return;

            const zone = parsePriceZone(item.price_zone);
            if (!zone) return;

            const label =
                typeof item.label === "string" && item.label.trim()
                    ? item.label.trim()
                    : group.status;

            zones.push({
                zone,
                label,
                status: group.status,
            });
        });
    });

    return zones;
}

function collectChartData(snapshot: unknown, cards: unknown): ChartData {
    const snapshotRecord = getSnapshotRecord(snapshot);
    const {candles, source} = parseCandleSource(snapshotRecord);

    const map = isRecord(snapshotRecord.market_acceptance_profile)
        ? snapshotRecord.market_acceptance_profile
        : {};
    const profile = isRecord(map.profile) ? map.profile : {};
    const rows = Array.isArray(profile.rows) ? profile.rows : [];

    const profileRows = rows
        .map(parseProfileRow)
        .filter((item): item is ProfileRow => item !== null)
        .sort((a, b) => a.priceMid - b.priceMid);

    const metadata = isRecord(profile.metadata) ? profile.metadata : {};
    const derivedLevels = isRecord(profile.derived_levels) ? profile.derived_levels : {};
    const profileCurrentPriceContext = isRecord(profile.current_price_context)
        ? profile.current_price_context
        : {};
    const derivedCurrentPriceContext = isRecord(derivedLevels.current_price_context)
        ? derivedLevels.current_price_context
        : {};

    const levels: ProfileLevels = {
        poc: parsePriceZone(firstPresent(
            derivedLevels.poc,
            derivedLevels.poc_price,
            derivedLevels.poc_zone,
            derivedLevels.point_of_control,
            metadata.poc
        )) ?? undefined,
        vah: parsePriceZone(firstPresent(
            derivedLevels.vah,
            derivedLevels.value_area_high,
            metadata.vah
        )) ?? undefined,
        val: parsePriceZone(firstPresent(
            derivedLevels.val,
            derivedLevels.value_area_low,
            metadata.val
        )) ?? undefined,
        currentPrice: parsePriceZone(firstPresent(
            profileCurrentPriceContext.current_price,
            profileCurrentPriceContext.price,
            profileCurrentPriceContext.last_price,
            profileCurrentPriceContext.mark_price,
            profileCurrentPriceContext.oracle_price,
            derivedCurrentPriceContext.current_price,
            derivedCurrentPriceContext.price,
            derivedCurrentPriceContext.last_price,
            derivedLevels.current_price,
            derivedLevels.price,
            metadata.current_price,
            metadata.last_price
        )) ?? undefined,
    };

    const keyLevels = collectKeyLevels(cards);
    const wyckoffZones = collectWyckoffZones(cards);

    if (candles.length === 0 || profileRows.length === 0) {
        return {
            candles,
            candleSource: source,
            profileRows,
            levels,
            keyLevels,
            wyckoffZones,
            yMin: 0,
            yMax: 1,
            unavailableReason: "Chart data is not available for this snapshot.",
        };
    }

    const priceValues: number[] = [];

    candles.forEach((candle) => {
        priceValues.push(candle[2], candle[3]);
    });

    [levels.poc, levels.vah, levels.val, levels.currentPrice].forEach((zone) => {
        if (zone) priceValues.push(zone.low, zone.high, zone.mid);
    });

    keyLevels.forEach((level) => {
        priceValues.push(level.zone.low, level.zone.high, level.zone.mid);
    });

    wyckoffZones.forEach((zone) => {
        priceValues.push(zone.zone.low, zone.zone.high, zone.zone.mid);
    });

    if (priceValues.length === 0) {
        return {
            candles,
            candleSource: source,
            profileRows,
            levels,
            keyLevels,
            wyckoffZones,
            yMin: 0,
            yMax: 1,
            unavailableReason: "A visible price range could not be calculated.",
        };
    }

    const rawMin = Math.min(...priceValues);
    const rawMax = Math.max(...priceValues);
    const rawRange = rawMax - rawMin;

    const profileSteps = profileRows
        .map((row) => Math.abs(row.priceHigh - row.priceLow))
        .filter((value) => Number.isFinite(value) && value > 0);

    const profileStep = profileSteps.length > 0 ? Math.max(...profileSteps) : 0;
    const padding = Math.max(rawRange * 0.02, profileStep || 0);

    return {
        candles,
        candleSource: source,
        profileRows,
        levels,
        keyLevels,
        wyckoffZones,
        yMin: rawMin - padding,
        yMax: rawMax + padding,
    };
}

function useDarkMode() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        function updateDarkMode() {
            setIsDark(document.documentElement.classList.contains("dark"));
        }

        updateDarkMode();

        const observer = new MutationObserver(updateDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
}

function makePricePlotLine(
    value: number,
    text: string,
    color: string,
    labelColor: string,
    dashStyle: Highcharts.DashStyleValue = "ShortDash"
): Highcharts.YAxisPlotLinesOptions {
    return {
        value,
        color,
        width: 1,
        dashStyle,
        zIndex: 5,
        label: {
            text,
            align: "right",
            x: -4,
            style: {
                color: labelColor,
                fontSize: "10px",
                fontWeight: "700",
                textOutline: "1px contrast",
            },
        },
    };
}

function makePricePlotBand(
    zone: PriceZone,
    text: string,
    color: string,
    labelColor: string,
    zIndex = 2
): Highcharts.YAxisPlotBandsOptions {
    return {
        from: zone.low,
        to: zone.high === zone.low ? zone.low + 0.0000001 : zone.high,
        color,
        zIndex,
        label: {
            text,
            align: "right",
            x: -4,
            style: {
                color: labelColor,
                fontSize: "10px",
                fontWeight: "700",
                textOutline: "1px contrast",
            },
        },
    };
}

function MfAiWyckoffMapChart({
                                 snapshot,
                                 cards,
                             }: {
    snapshot: unknown;
    cards: unknown;
}) {
    const isDark = useDarkMode();

    const chartData = useMemo(() => collectChartData(snapshot, cards), [snapshot, cards]);

    const colors = useMemo(() => ({
        text: isDark ? "#f9fafb" : "#111827",
        chartText: isDark ? "#ffffff" : "#111827",
        mutedText: isDark ? "#d1d5db" : "#4b5563",
        grid: isDark ? "#374151" : "#e5e7eb",
        border: isDark ? "#4b5563" : "#d1d5db",
        candleUp: "#16a34a",
        candleDown: "#dc2626",
        poc: "#facc15",
        vah: "#60a5fa",
        val: "#c084fc",
        current: "#fb7185",
        confirmed: isDark ? "rgba(250, 204, 21, 0.18)" : "rgba(245, 158, 11, 0.18)",
        provisional: isDark ? "rgba(96, 165, 250, 0.14)" : "rgba(37, 99, 235, 0.14)",
        invalidated: isDark ? "rgba(156, 163, 175, 0.10)" : "rgba(107, 114, 128, 0.12)",
        keyLevel: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(100, 116, 139, 0.16)",
        valueArea: isDark ? "rgba(96, 165, 250, 0.36)" : "rgba(37, 99, 235, 0.28)",
        profile: isDark ? "rgba(209, 213, 219, 0.42)" : "rgba(100, 116, 139, 0.45)",
        hvn: isDark ? "rgba(34, 197, 94, 0.58)" : "rgba(22, 163, 74, 0.5)",
        lvn: isDark ? "rgba(248, 113, 113, 0.52)" : "rgba(220, 38, 38, 0.42)",
        pocBar: isDark ? "rgba(250, 204, 21, 0.90)" : "rgba(245, 158, 11, 0.82)",
    }), [isDark]);

    const levelPlotLines = useMemo<Highcharts.YAxisPlotLinesOptions[]>(() => {
        const lines: Highcharts.YAxisPlotLinesOptions[] = [];

        if (chartData.levels.vah) {
            lines.push(makePricePlotLine(
                chartData.levels.vah.mid,
                `VAH ${chartData.levels.vah.label}`,
                colors.vah,
                colors.chartText
            ));
        }

        if (chartData.levels.val) {
            lines.push(makePricePlotLine(
                chartData.levels.val.mid,
                `VAL ${chartData.levels.val.label}`,
                colors.val,
                colors.chartText
            ));
        }

        if (chartData.levels.currentPrice) {
            lines.push(makePricePlotLine(
                chartData.levels.currentPrice.mid,
                `Current ${chartData.levels.currentPrice.label}`,
                colors.current,
                colors.chartText,
                "Dash"
            ));
        }

        return lines;
    }, [chartData.levels, colors]);

    const candlePlotBands = useMemo<Highcharts.YAxisPlotBandsOptions[]>(() => {
        const bands: Highcharts.YAxisPlotBandsOptions[] = [];

        if (chartData.levels.poc) {
            bands.push(makePricePlotBand(
                chartData.levels.poc,
                `POC ${chartData.levels.poc.label}`,
                "rgba(250, 204, 21, 0.22)",
                colors.chartText,
                3
            ));
        }

        chartData.keyLevels.slice(0, 8).forEach((level, index) => {
            const grade = level.grade !== undefined ? ` g:${formatScalar(level.grade)}` : "";

            bands.push(makePricePlotBand(
                level.zone,
                `Key ${index + 1}${grade} — ${level.zone.label}`,
                colors.keyLevel,
                colors.chartText,
                2
            ));
        });

        chartData.wyckoffZones.slice(0, 8).forEach((item) => {
            const color =
                item.status === "confirmed"
                    ? colors.confirmed
                    : item.status === "provisional"
                        ? colors.provisional
                        : colors.invalidated;

            bands.push(makePricePlotBand(
                item.zone,
                `${item.label} — ${item.zone.label}`,
                color,
                colors.chartText,
                item.status === "confirmed" ? 3 : 2
            ));
        });

        return bands;
    }, [
        chartData.levels.poc,
        chartData.keyLevels,
        chartData.wyckoffZones,
        colors,
    ]);

    const profilePointRange = useMemo(() => {
        const ranges = chartData.profileRows
            .map((row) => Math.abs(row.priceHigh - row.priceLow))
            .filter((value) => Number.isFinite(value) && value > 0);

        if (ranges.length === 0) return undefined;

        return Math.max(...ranges);
    }, [chartData.profileRows]);

    const candlesOptions = useMemo<Highcharts.Options>(() => ({
        chart: {
            backgroundColor: "transparent",
            height: 460,
            spacing: [8, 8, 8, 8],
        },
        rangeSelector: {
            enabled: false,
        },
        navigator: {
            enabled: false,
        },
        scrollbar: {
            enabled: false,
        },
        title: {
            text: "Candles + Structure",
            align: "left",
            style: {
                color: colors.chartText,
                fontSize: "13px",
                fontWeight: "700",
            },
        },
        credits: {
            enabled: false,
        },
        xAxis: {
            type: "datetime",
            ordinal: false,
            lineColor: colors.border,
            tickColor: colors.border,
            labels: {
                style: {
                    color: colors.chartText,
                    textOutline: "none",
                },
            },
            dateTimeLabelFormats: {
                minute: "%H:%M",
                hour: "%H:%M",
            },
        },
        yAxis: {
            min: chartData.yMin,
            max: chartData.yMax,
            title: {
                text: "Price",
                style: {
                    color: colors.chartText,
                    fontWeight: "700",
                },
            },
            opposite: true,
            gridLineColor: colors.grid,
            labels: {
                style: {
                    color: colors.chartText,
                    textOutline: "none",
                },
            },
            plotLines: levelPlotLines,
            plotBands: candlePlotBands,
        },
        legend: {
            enabled: false,
            itemStyle: {
                color: colors.chartText,
            },
        },
        tooltip: {
            split: false,
            shared: true,
            xDateFormat: "%Y-%m-%d %H:%M:%S UTC",
            backgroundColor: isDark ? "#111827" : "#ffffff",
            borderColor: colors.border,
            style: {
                color: colors.chartText,
            },
        },
        plotOptions: {
            candlestick: {
                color: colors.candleDown,
                upColor: colors.candleUp,
                lineColor: colors.candleDown,
                upLineColor: colors.candleUp,
            },
        },
        series: [
            {
                type: "candlestick",
                name: "Price",
                data: chartData.candles,
                dataGrouping: {
                    enabled: false,
                },
            } as Highcharts.SeriesCandlestickOptions,
        ],
    }), [
        candlePlotBands,
        chartData.candles,
        chartData.yMax,
        chartData.yMin,
        colors,
        isDark,
        levelPlotLines,
    ]);

    const profileOptions = useMemo<Highcharts.Options>(() => ({
        chart: {
            backgroundColor: "transparent",
            height: 460,
            inverted: true,
            spacing: [8, 8, 8, 8],
        },
        title: {
            text: "Market Acceptance Profile",
            align: "left",
            style: {
                color: colors.chartText,
                fontSize: "13px",
                fontWeight: "700",
            },
        },
        credits: {
            enabled: false,
        },
        xAxis: {
            min: chartData.yMin,
            max: chartData.yMax,
            reversed: true,
            lineColor: colors.border,
            tickColor: colors.border,
            gridLineColor: colors.grid,
            gridLineWidth: 1,
            title: {
                text: undefined,
            },
            labels: {
                style: {
                    color: colors.chartText,
                    textOutline: "none",
                },
            },
            plotLines: levelPlotLines.map((line) => ({
                ...line,
                label: {
                    ...line.label,
                    align: "left",
                    x: 4,
                    style: {
                        ...line.label?.style,
                        color: colors.chartText,
                        textOutline: "1px contrast",
                    },
                },
            })),
            plotBands: chartData.levels.poc
                ? [makePricePlotBand(
                    chartData.levels.poc,
                    `POC ${chartData.levels.poc.label}`,
                    "rgba(250, 204, 21, 0.22)",
                    colors.chartText,
                    3
                )]
                : [],
        },
        yAxis: {
            min: 0,
            max: 1,
            reversed: false,
            title: {
                text: "Relative Volume",
                style: {
                    color: colors.chartText,
                    fontWeight: "700",
                },
            },
            gridLineWidth: 0,
            labels: {
                enabled: false,
                style: {
                    color: colors.chartText,
                },
            },
        },
        legend: {
            enabled: false,
            itemStyle: {
                color: colors.chartText,
            },
        },
        tooltip: {
            backgroundColor: isDark ? "#111827" : "#ffffff",
            borderColor: colors.border,
            style: {
                color: colors.chartText,
            },
            formatter: function () {
                const point = (this as unknown as {
                    point?: Highcharts.Point & {
                        priceLow?: number;
                        priceHigh?: number;
                        totalVolume?: number;
                        tradeCount?: number;
                        relativeVolume?: number;
                    }
                }).point;

                return [
                    `<strong>${formatNumber(point?.priceLow)}–${formatNumber(point?.priceHigh)}</strong>`,
                    `Relative volume: ${formatNumber(point?.relativeVolume, 4)}`,
                    `Total volume: ${formatNumber(point?.totalVolume, 4)}`,
                    `Trades: ${formatNumber(point?.tradeCount, 0)}`,
                ].join("<br/>");
            },
        },
        plotOptions: {
            column: {
                borderWidth: 0,
                grouping: false,
                pointPadding: 0,
                groupPadding: 0,
                pointRange: profilePointRange,
            },
            series: {
                animation: false,
            },
        },
        series: [
            {
                type: "column",
                name: "Relative Volume",
                data: chartData.profileRows.map((row) => ({
                    x: row.priceMid,
                    y: row.relativeVolume,
                    color: row.isPoc
                        ? colors.pocBar
                        : row.isHvn
                            ? colors.hvn
                            : row.isLvn
                                ? colors.lvn
                                : row.insideValueArea
                                    ? colors.valueArea
                                    : colors.profile,
                    priceLow: row.priceLow,
                    priceHigh: row.priceHigh,
                    relativeVolume: row.relativeVolume,
                    totalVolume: row.totalVolume,
                    tradeCount: row.tradeCount,
                })),
            } as Highcharts.SeriesColumnOptions,
        ],
    }), [
        chartData.levels.poc,
        chartData.profileRows,
        chartData.yMax,
        chartData.yMin,
        colors,
        isDark,
        levelPlotLines,
        profilePointRange,
    ]);

    if (!snapshot) return null;

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Wyckoff Structure + Volume Profile / Market Acceptance Profile</CardTitle>
            </CardHeader>
            <CardContent>
                {chartData.unavailableReason ? (
                    <div
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                        {chartData.unavailableReason}
                    </div>
                ) : (
                    <>
                        <div
                            className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-5">
                            <div>Candles: {formatNumber(chartData.candles.length, 0)}</div>
                            <div>Source: {chartData.candleSource}</div>
                            <div>Profile rows: {formatNumber(chartData.profileRows.length, 0)}</div>
                            <div>Visible low: {formatNumber(chartData.yMin)}</div>
                            <div>Visible high: {formatNumber(chartData.yMax)}</div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div className="rounded-xl border border-gray-200 p-2 dark:border-gray-800 lg:col-span-2">
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    constructorType="stockChart"
                                    options={candlesOptions}
                                />
                            </div>

                            <div className="rounded-xl border border-gray-200 p-2 dark:border-gray-800 lg:col-span-1">
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={profileOptions}
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <span>POC / VAH / VAL / current price are rendered only from backend-provided MAP levels.</span>
                            <span>Key and Wyckoff zones are rendered only from supplied AI/backend fields.</span>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default MfAiWyckoffMapChart;
