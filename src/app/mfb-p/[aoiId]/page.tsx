// app/mfb-p/[aoiId]/page.tsx
import React from "react";
import MfbPParticipantClient from "@/components/mfb-p/MfbPParticipantClient";

// Add additional AOI IDs here as you bring more live
export function generateStaticParams() {
    return [
        { aoiId: "3" }, // c9dc
        { aoiId: "36" }, // 8185
        { aoiId: "72" }, // ba93
        { aoiId: "127" }, // 336a
        { aoiId: "707" }, // 2305
        { aoiId: "2308" }, // 7d28
    ];
}

interface PageProps {
    params: Promise<{
        aoiId: string;
    }>;
}

export default async function MfbPParticipantPage({ params }: PageProps) {
    const { aoiId } = await params;
    const aoiIdNum = Number(aoiId);

    return <MfbPParticipantClient aoiId={aoiIdNum} />;
}
