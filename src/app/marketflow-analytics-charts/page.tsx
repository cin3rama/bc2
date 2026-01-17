// /opt/frontend/a3therflow/app/marketflow-analytics-charts/page.tsx
import React, { Suspense } from "react";
import MarketflowAnalyticsChartsClient from "./MarketflowAnalyticsChartsClient";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <MarketflowAnalyticsChartsClient />
        </Suspense>
    );
}
