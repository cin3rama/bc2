'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'

export type SvgFrameLooperProps = {
    /** Build the URL for frame i (0-based). Example:
     *  (i) => `/app/static/svg/stickman/frame_${String(i + 1).padStart(2, '0')}.png`
     */
    pattern: (i: number) => string
    /** Total number of frames (e.g., 12) */
    frameCount: number
    /** Frames per second (defaults to 12) */
    fps?: number
    /** Start at this frame index (0-based). Defaults to 0 */
    startFrame?: number
    /** Whether playback runs. Defaults to true */
    play?: boolean
    /** Extra classes for the wrapper (the wrapper should be sized by the parent) */
    className?: string
}

export default function SvgFrameLooper({
                                           pattern,
                                           frameCount,
                                           fps = 12,
                                           startFrame = 0,
                                           play = true,
                                           className,
                                       }: SvgFrameLooperProps) {
    const imgsRef = useRef<(HTMLImageElement | null)[]>([])
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const tlRef = useRef<gsap.core.Timeline | null>(null)
    const currentIndexRef = useRef<number>(0)

    const urls = useMemo(
        () => Array.from({ length: frameCount }, (_, i) => pattern(i)),
        [pattern, frameCount]
    )

    useEffect(() => {
        const wrapper = wrapperRef.current
        if (!wrapper || !frameCount) return

        // Respect prefers-reduced-motion: show first frame only
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches

        // Reset visibility: only the initial frame is visible
        const safeIndex = Math.min(Math.max(0, startFrame | 0), frameCount - 1)
        imgsRef.current.forEach((img) => img && gsap.set(img, { autoAlpha: 0 }))
        if (imgsRef.current[safeIndex]) gsap.set(imgsRef.current[safeIndex], { autoAlpha: 1 })
        currentIndexRef.current = safeIndex

        // Kill any existing timeline before making a new one
        tlRef.current?.kill()
        tlRef.current = null

        // If paused by prop or reduced motion, don't animate—just show the starting frame
        if (!play || prefersReduced || frameCount <= 1 || fps <= 0) {
            return
        }

        // Drive a dummy state value with a stepped ease and swap image visibility
        const state = { f: safeIndex }
        const duration = frameCount / fps // e.g., 12 frames @ 12fps = 1s

        const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'none' } })
        tl.to(state, {
            f: safeIndex + frameCount,
            duration,
            ease: `steps(${frameCount})`,
            onUpdate: () => {
                // Wrap into [0..frameCount-1]
                const idx = Math.floor(state.f) % frameCount
                if (idx === currentIndexRef.current) return

                const prev = imgsRef.current[currentIndexRef.current]
                const next = imgsRef.current[idx]
                if (prev) gsap.set(prev, { autoAlpha: 0 })
                if (next) gsap.set(next, { autoAlpha: 1 })
                currentIndexRef.current = idx
            },
        })

        tlRef.current = tl

        // Pause when tab is hidden to save cycles
        const onVis = () => {
            if (!tlRef.current) return
            if (document.hidden) tlRef.current.pause()
            else if (play) tlRef.current.resume()
        }
        document.addEventListener('visibilitychange', onVis)

        return () => {
            document.removeEventListener('visibilitychange', onVis)
            tlRef.current?.kill()
            tlRef.current = null
        }
    }, [frameCount, fps, play, startFrame])

    return (
        <div
            ref={wrapperRef}
            className={`relative w-full h-full ${className ?? ''}`}
            style={{ pointerEvents: 'none' }}
        >
            {urls.map((src, i) => (
                <img
                    key={i}
                    //@ts-ignore
                    ref={(el) => (imgsRef.current[i] = el)}
                    src={src}
                    alt={`frame ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                    draggable={false}
                />
            ))}
        </div>
    )
}
