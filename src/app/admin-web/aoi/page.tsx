// /src/app/admin-web/aoi/page.tsx
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";

export default function AdminWebAoiListPage() {
    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <CardTitle>AOI Actor Policy Shell</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                This is the placeholder AOI list/read entry surface for Task 9A.
                                Task 9B will replace the placeholder row state below with the real
                                authenticated backend actor list.
                            </p>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs md:text-sm">
                                    <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-800">
                                        <th className="py-2 pr-4 text-left font-semibold">AOI ID</th>
                                        <th className="py-2 px-2 text-left font-semibold">Account</th>
                                        <th className="py-2 px-2 text-left font-semibold">Type</th>
                                        <th className="py-2 px-2 text-left font-semibold">Lifecycle</th>
                                        <th className="py-2 px-2 text-left font-semibold">Tier</th>
                                        <th className="py-2 px-2 text-left font-semibold">Mode</th>
                                        <th className="py-2 px-2 text-left font-semibold">Replay</th>
                                        <th className="py-2 px-2 text-left font-semibold">Reconcile</th>
                                        <th className="py-2 pl-2 text-right font-semibold">Detail</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    <tr className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="py-2 pr-4 align-top">#1</td>
                                        <td className="py-2 px-2 align-top font-mono text-[11px]">
                                            0xADMIN_PLACEHOLDER…
                                        </td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 px-2 align-top">—</td>
                                        <td className="py-2 pl-2 pr-0 align-top text-right">
                                            <Link
                                                href="/admin-web/aoi/detail?aoiId=1"
                                                className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-[11px] md:text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                Open Detail Shell
                                            </Link>
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300">
                                Placeholder only. Real actor list/read/edit integration belongs to Task 9B.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </AdminSessionGate>
        </main>
    );
}
