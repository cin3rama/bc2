// /src/app/admin-web/av2/controls/page.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AdminSessionGate from "@/components/admin-web/AdminSessionGate";

export default function Av2ControlsPage() {
    return (
        <main className="flex flex-col gap-4">
            <AdminSessionGate>
                <Card>
                    <CardHeader>
                        <CardTitle>AV2 Controls / Administration</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            AV2 operational controls and read-only configuration.
                        </p>
                    </CardContent>
                </Card>
            </AdminSessionGate>
        </main>
    );
}
