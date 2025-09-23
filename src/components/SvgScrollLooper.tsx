'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export type SvgScrollLooperProps = {
    /** Build the URL for frame i (0-based): e.g., (i) => `/app/static/svg/stickman/frame_${String(i+1).padStart(2,'0')}.png` */
    //@ts-ignore
    pattern: (i: number) => string
    /** Total frames, e.g., 12 */
    frameCount: number
    /** Optional: selector or element to use as the ScrollTrigger. Defaults to the wrapper itself. */
    trigger?: string | Element | null
    /** ScrollTrigger start (default: 'top top') */
    start?: string
    /** ScrollTrigger end (default: '+=1200') */
    end?: string
    /** Pin the trigger during scroll (default: true) */
    pin?: boolean
    /** Extra classes for the wrapper (the wrapper should already be sized by its parent) */
    className?: string
}

export default function SvgScrollLooper({
                                            pattern,
                                            frameCount,
                                            trigger,
                                            start = 'top top',
                                            end = '+=1200',
                                            pin = true,
                                            className,
                                        }: SvgScrollLooperProps) {
    const imgsRef = useRef<(HTMLImageElement | null)[]>([])
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const currentIndexRef = useRef(0)

    const urls = useMemo(
        () => Array.from({ length: frameCount }, (_, i) => pattern(i)),
        [pattern, frameCount]
    )

    useEffect(() => {
        const wrapper = wrapperRef.current
        if (!wrapper || !frameCount) return

        // Reset visibility: only frame 0 is shown
        imgsRef.current.forEach((img) => img && gsap.set(img, { autoAlpha: 0 }))
        if (imgsRef.current[0]) gsap.set(imgsRef.current[0], { autoAlpha: 1 })
        currentIndexRef.current = 0

        const updateByProgress = (progress: number) => {
            // Map [0..1] → [0..frameCount-1], clamp
            const idx = Math.min(frameCount - 1, Math.max(0, Math.floor(progress * (frameCount - 1) + 1e-6)))
            if (idx === currentIndexRef.current) return
            const prev = imgsRef.current[currentIndexRef.current]
            const next = imgsRef.current[idx]
            if (prev) gsap.set(prev, { autoAlpha: 0 })
            if (next) gsap.set(next, { autoAlpha: 1 })
            currentIndexRef.current = idx
        }

        const triggerEl =
            (typeof trigger === 'string' ? document.querySelector(trigger) : trigger) || wrapper

        const st = ScrollTrigger.create({
            trigger: triggerEl as Element,
            start,
            end,
            scrub: true,
            pin,
            invalidateOnRefresh: true,
            onUpdate: (self) => updateByProgress(self.progress),
        })

        // Initialize based on current scroll position
        updateByProgress(st.progress)

        return () => {
            st.kill()
        }
    }, [frameCount, trigger, start, end, pin])

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
