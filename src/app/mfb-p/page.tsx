// app/mfb-p/page.tsx
"use client";  // MUST be the first non-empty line

import React, { useEffect } from "react";
import Link from "next/link";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/Card";

type AoiListItem = {
    id: number;
    label: string;
    accountId: string;
    defaultTicker: string;
    status: "active" | "inactive";
};

const AOI_CONFIG: AoiListItem[] = [
    {
        id: 3,
        label: "Dev AOI for ZEC",
        accountId: "0x152e41f0b83e6cad4b5dc730c1d6279b7d67c9dc",
        defaultTicker: "ZEC-USD",
        status: "active",
    },
];

function shortAccountId(full: string): string {
    if (!full?.startsWith("0x") || full.length <= 10) return full;
    const tail = full.slice(-5);
    return `0x…${tail}`;
}

export default function MfbPHubPage() {
    const { setConfig } = useHeaderConfig();
    const { ticker } = useTickerPeriod();

    // Ensure the header dropdowns are visible on this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: true });
    }, [setConfig]);

    return (
        <main className="flex flex-col gap-4 p-2 md:p-4">
            {/* Page header */}
            <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-text dark:text-text-inverted">
                        MFB_P – Accounts of Interest
                    </h1>
                    <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                        Monitor key participants for{" "}
                        <span className="font-semibold">{ticker}</span> and drill into
                        their live behavior and events.
                    </p>
                </div>
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Note:</span> This hub lists AOIs. Click
                    a row to open a dedicated participant lens.
                </div>
            </section>

            {/* AOI Watchlist */}
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>AOI Watchlist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {AOI_CONFIG.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No AOIs configured yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">
                                            AOI
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            Account
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            Default Ticker
                                        </th>
                                        <th className="py-2 px-2 text-left font-semibold">
                                            Status
                                        </th>
                                        <th className="py-2 pl-2 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {AOI_CONFIG.map((aoi) => (
                                        <tr
                                            key={aoi.id}
                                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            <td className="py-2 pr-4 align-top">
                                                <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {aoi.label}
                                                        </span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            AOI #{aoi.id}
                                                        </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 align-top">
                                                    <span className="font-mono text-[11px]">
                                                        {shortAccountId(aoi.accountId)}
                                                    </span>
                                            </td>
                                            <td className="py-2 px-2 align-top">
                                                <span>{aoi.defaultTicker}</span>
                                            </td>
                                            <td className="py-2 px-2 align-top">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                            aoi.status === "active"
                                                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                        }`}
                                                    >
                                                        {aoi.status.toUpperCase()}
                                                    </span>
                                            </td>
                                            <td className="py-2 pl-2 pr-0 align-top text-right">
                                                <Link
                                                    href={`/mfb-p/${aoi.id}`}
                                                    className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    Open Lens
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
