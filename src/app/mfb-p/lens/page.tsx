// /opt/frontend/a3therflow/app/mfb-p/lens/page.tsx

import React, { Suspense } from "react";
import LensClient from "./LensClient";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <LensClient />
        </Suspense>
    );
}