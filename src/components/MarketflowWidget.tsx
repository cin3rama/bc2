// src/components/MarketflowWidget.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMarketflowRuntime } from "@/hooks/useMarketflowRuntime";
import type { Observable } from "rxjs";
import type { LiveMinute } from "@/lib/marketflow/tick";

// ---------- Types & helpers (local, so this file is self-contained) ----------
type Severity =
    | "IGNITION_UP"
    | "IGNITION_DOWN"
    | "EXHAUSTION_UP"
    | "EXHAUSTION_DOWN"
    | "DD_SLOPE_UP"
    | "DD_SLOPE_DOWN";

function stateBadgeClass(state: string) {
    switch (state) {
        case "Expansion": return "bg-green-100 text-green-700";
        case "Markdown": return "bg-red-100 text-red-700";
        case "Accumulation": return "bg-blue-100 text-blue-700";
        case "Distribution": return "bg-yellow-100 text-yellow-700";
        default: return "bg-gray-100 text-gray-700";
    }
}

function alertColor(a: string) {
    if (a.startsWith("IGNITION_UP")) return "bg-green-100 text-green-700";
    if (a.startsWith("IGNITION_DOWN")) return "bg-red-100 text-red-700";
    if (a.startsWith("EXHAUSTION_")) return "bg-amber-100 text-amber-700";
    if (a.startsWith("DD_SLOPE_")) return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
}

// ---------- Tiny built-in toast shelf (no deps) ----------
type Toast = { id: string; text: string; cls: string; ts: number };

function ToastShelf({ toasts, onDismiss }: {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}) {
    return (
        <div className="fixed right-4 bottom-4 z-50 space-y-2">
            {toasts.map(t => (
                <div key={t.id}
                     className={`px-3 py-2 rounded shadow-md text-sm cursor-pointer ${t.cls}`}
                     onClick={() => onDismiss(t.id)}>
                    {t.text}
                </div>
            ))}
        </div>
    );
}

// Component
export type MarketflowWidgetProps = {
    httpBase?: string;
    ticker?: string;
    period?: "15min" | "1h" | "4h" | "1d";
    seedMinutes?: number;
    compact?: boolean;
    onAlert?: (alerts: string[], payload: any) => void;
    title?: string;
    // + NEW:
    marketflow$?: Observable<LiveMinute>;
};

export default function MarketflowWidget({
                                             httpBase = "https://botpilot--8000.ngrok.io",
                                             ticker = "SOL-USD",
                                             period = "1h",
                                             seedMinutes = 60,
                                             compact = false,
                                             onAlert,
                                             title,
                                             // + NEW:
                                             marketflow$,
                                         }: MarketflowWidgetProps) {

    const { state, baseSpread, lastTick, alerts } = useMarketflowRuntime({
        httpBase, ticker, period, seedMinutes, onAlert,
        // + NEW: forward the live stream
        marketflow$,
    });

    // Toasts only for high-salience alerts (IGNITION_*).
    const [toasts, setToasts] = useState<Toast[]>([]);
    const latestAlert = useMemo(() => alerts[alerts.length - 1], [alerts]);

    useEffect(() => {
        if (!latestAlert) return;
        if (latestAlert.startsWith("IGNITION_")) {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const cls = alertColor(latestAlert);
            setToasts(prev => [...prev, { id, text: `⚡ ${latestAlert}`, cls, ts: Date.now() }]);
            const timer = setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [latestAlert]);

    return (
        <div className="p-4 rounded-2xl border grid gap-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{title ?? `Marketflow (${ticker})`}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Regime badge */}
                    <span className={`px-2 py-1 rounded text-xs ${stateBadgeClass(state)}`}>{state}</span>

                    {/* Latest alert pill (if any) */}
                    {!!latestAlert && (
                        <span className={`px-2 py-1 rounded text-[11px] ${alertColor(latestAlert)}`}>
              {latestAlert}
            </span>
                    )}
                </div>
            </div>

            {/* Metrics */}
            {!compact && (
                <div className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>DD: <b>{(lastTick?.dd ?? 0).toLocaleString()}</b></div>
                    <div>
                        Spread: <b>{Math.round(lastTick?.spread ?? 0).toLocaleString()}</b>
                        <span className="text-gray-500"> (base {Math.round(baseSpread).toLocaleString()})</span>
                    </div>
                    <div>MM Net: <b>{Math.round(lastTick?.mm_net ?? 0).toLocaleString()}</b></div>
                    <div>AD Net: <b>{Math.round(lastTick?.ad_net ?? 0).toLocaleString()}</b></div>
                </div>
            )}

            {/* Alerts log (last 6) */}
            {!compact && alerts.length > 0 && (
                <div className="text-xs text-gray-700 space-y-1">
                    {alerts.slice(-6).reverse().map((a, i) => (
                        <div key={`${a}-${i}`} className={`${alertColor(a)} inline-block rounded px-1.5 py-0.5`}>
                            ⚡ {a}
                        </div>
                    ))}
                </div>
            )}

            {/* Toast shelf for high-salience events */}
            <ToastShelf
                toasts={toasts}
                onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
            />
        </div>
    );
}
