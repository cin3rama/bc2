// app/mfb-p/lens/page.tsx
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import MfbPParticipantClient from "@/components/mfb-p/MfbPParticipantClient";

export default function MfbPLensPage() {
    const sp = useSearchParams();
    const aoiIdRaw = sp.get("aoiId");
    const aoiId = aoiIdRaw ? Number(aoiIdRaw) : NaN;

    if (!Number.isFinite(aoiId)) {
        return <div className="p-4 text-sm text-red-600 dark:text-red-400">Missing/invalid aoiId.</div>;
    }

    return <MfbPParticipantClient aoiId={aoiId} />;
}
