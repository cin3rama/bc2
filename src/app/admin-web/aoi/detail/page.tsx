// /src/app/admin-web/aoi/detail/page.tsx
import React, { Suspense } from "react";
import AdminAoiDetailClient from "./AdminAoiDetailClient";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <AdminAoiDetailClient />
        </Suspense>
    );
}