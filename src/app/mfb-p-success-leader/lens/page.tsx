// app/mfb-p-success-leader/lens/page.tsx
import React, { Suspense } from "react";
import LensClient from "./LensClient";

export default function Page() {
    return (
        <Suspense fallback={null}>
            <LensClient />
            </Suspense>
    );
}
