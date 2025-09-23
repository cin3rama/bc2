'use client'

import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useHeaderConfig } from '@/contexts/HeaderConfigContext'
import type { SvgFrameLooperProps } from '@/components/SvgFrameLooper'

// Client-only import (the looper uses GSAP on the client)
const SvgFrameLooper = dynamic(
    () => import('@/components/SvgFrameLooper'),
    { ssr: false }
) as React.ComponentType<SvgFrameLooperProps>

/**
 * Stick Page – Baseline (looping crowd, no scroll control)
 * - Header shows ticker only
 * - 16:9 stage with background
 * - Cheering crowd loops independently (12 PNG frames @ 12fps, with alpha)
 *
 * Assets:
 *   /public/static/images/scene_1_bg.jpg → /app/static/images/scene_1_bg.jpg
 *   /public/static/svg/stickman/frame_01.png … frame_12.png → /app/static/svg/stickman/*.png
 */
export default function StickPage() {
    const { setConfig } = useHeaderConfig()

    // Ensure only the ticker selector shows in the Header for this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false })
    }, [setConfig])

    const SHOW_GUIDES = false

    return (
        <main className="w-full flex justify-center items-start">
            {/* Stage wrapper centers the 16:9 canvas and keeps it responsive */}
            <div className="relative w-full max-w-[1920px] mx-auto aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">
                {/* Background image (fills the stage) */}
                <img
                    src="/app/static/images/scene_1_bg.jpg"
                    alt='Scene 1 background — city with left-side sign ("LOONA TO THE MOON, AIR DROP TODAY!!!")'
                    className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
                    draggable={false}
                />

                {/* Animation layer (everything we animate goes here, above the background) */}
                <div id="scene-1-layer" className="absolute inset-0">
                    {/* Cheering crowd — looped (independent of scroll), placed below the sign */}
                    <div
                        id="crowd-zone"
                        className="absolute"
                        style={{ left: '4%', top: '75%', width: '28%', height: '22%', pointerEvents: 'none' }}
                        aria-label="Crowd placement zone"
                    >
                        <SvgFrameLooper
                            frameCount={12}
                            fps={12}
                            pattern={(i: number) =>
                                `/app/static/svg/stickman/frame_${String(i + 1).padStart(2, '0')}.png`
                            }
                            className="absolute inset-0"
                        />
                    </div>

                    {SHOW_GUIDES && (
                        <>
                            {/* Guide rectangle for the target zone below the sign */}
                            <div
                                className="absolute border-2 border-sky-400/60"
                                style={{ left: '4%', top: '52%', width: '28%', height: '22%' }}
                                title="Guide: target zone below the left sign"
                            />
                            {/* Stage outline */}
                            <div
                                className="absolute inset-0 ring-1 ring-fuchsia-400/40 pointer-events-none"
                                aria-hidden
                            />
                        </>
                    )}
                </div>
            </div>
        </main>
    )
}
