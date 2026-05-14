// /src/app/admin-web/aoi/[aoiId]/page.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";

export default function AdminWebAoiDetailPage({
                                                  params,
                                              }: {
    params: { aoiId: string };
}) {
    const { aoiId } = params;

    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <section className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Actor Policy Editor Shell — AOI #{aoiId}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">AOI Type</span>
                                    <select
                                        disabled
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
                                    >
                                        <option>Task 9B wiring</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">Lifecycle State</span>
                                    <select
                                        disabled
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
                                    >
                                        <option>Task 9B wiring</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">Checkpoint Tier</span>
                                    <select
                                        disabled
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
                                    >
                                        <option>Task 9B wiring</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <span className="mb-1 block font-medium">Checkpoint Mode</span>
                                    <select
                                        disabled
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
                                    >
                                        <option>Task 9B wiring</option>
                                    </select>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" disabled className="h-4 w-4" />
                                    <span>Replay Enabled</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" disabled className="h-4 w-4" />
                                    <span>Reconcile Enabled</span>
                                </label>

                                <label className="text-sm md:col-span-2">
                                    <span className="mb-1 block font-medium">Notes / Description</span>
                                    <textarea
                                        disabled
                                        rows={5}
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
                                        value="Task 9B will bind this editor to the real backend actor policy detail/patch contract."
                                        readOnly
                                    />
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actor-Market Policy Shell</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-800">
                                            <th className="py-2 pr-4 text-left font-semibold">Ticker</th>
                                            <th className="py-2 px-2 text-left font-semibold">Coin</th>
                                            <th className="py-2 px-2 text-left font-semibold">Priority</th>
                                            <th className="py-2 px-2 text-left font-semibold">Lifecycle</th>
                                            <th className="py-2 px-2 text-left font-semibold">Replay</th>
                                            <th className="py-2 px-2 text-left font-semibold">Reconcile</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="py-2 pr-4 align-top">BTC-USD</td>
                                            <td className="py-2 px-2 align-top">BTC</td>
                                            <td className="py-2 px-2 align-top">—</td>
                                            <td className="py-2 px-2 align-top">—</td>
                                            <td className="py-2 px-2 align-top">—</td>
                                            <td className="py-2 px-2 align-top">—</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300">
                                    Task 9B will replace this placeholder with the real actor-market
                                    list/read/edit UI against the validated backend admin endpoints.
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </AdminSessionGate>
        </main>
    );
}
