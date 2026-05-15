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
                            <CardTitle>AOI Actor Policy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    Manage actor-level AOI policy through the protected mf_admin backend.
                                </p>
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs">
                                    Fields: aoi_type, lifecycle_state, checkpoint_tier, checkpoint_mode,
                                    replay_enabled, reconcile_enabled, notes
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Actor-Market Policy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <p>
                                    Manage per-market AOI policy while preserving backend runtime ownership.
                                </p>
                                <div className="rounded border border-gray-200 dark:border-gray-800 p-3 text-xs">
                                    Fields: market_priority, market_lifecycle_state, replay_enabled,
                                    reconcile_enabled
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </AdminSessionGate>
        </main>
    );
}
