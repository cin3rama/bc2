// /src/app/admin-web/page.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";
import AdminAuthenticatedPlaceholderCard from "@/components/admin-web/AdminAuthenticatedPlaceholderCard";

export default function AdminWebHomePage() {
    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <AdminAuthenticatedPlaceholderCard />

                <section className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>AOI Actor Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    Task 9B will bind this surface to the validated actor-level admin
                                    endpoints for list/read/patch.
                                </p>
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs">
                                    Target fields: aoi_type, lifecycle_state, checkpoint_tier,
                                    checkpoint_mode, replay_enabled, reconcile_enabled, notes
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actor-Market Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    Task 9B will bind this surface to the validated actor-market
                                    list/read/patch endpoints for per-ticker policy control.
                                </p>
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs">
                                    Target fields: market_priority, market_lifecycle_state,
                                    replay_enabled, reconcile_enabled
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </AdminSessionGate>
        </main>
    );
}
