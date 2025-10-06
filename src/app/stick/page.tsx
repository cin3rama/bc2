'use client'

import React, { useEffect } from 'react'
import { useHeaderConfig } from '@/contexts/HeaderConfigContext'
import Scene_1 from '@/components/Scene_1'

export default function StickPage() {
    const { setConfig } = useHeaderConfig()
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false })
    }, [setConfig])

    return (
        <main className="w-full">
            <div className="h-[20vh]}" />
            <Scene_1 />
            {/* <Scene_2 /> … <Scene_8 /> later */}
            <div className="h-[120vh]" />
        </main>
    )
}
