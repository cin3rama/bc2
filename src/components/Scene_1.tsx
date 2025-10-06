'use client'

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import dynamic from 'next/dynamic'
import type { SvgFrameLooperProps } from '@/components/SvgFrameLooper'

gsap.registerPlugin(ScrollTrigger)

const SvgFrameLooper = dynamic(
    () => import('@/components/SvgFrameLooper'),
    { ssr: false }
) as React.ComponentType<SvgFrameLooperProps>

/**
 * Scene_1 – Assemble on scroll (pin + scrub)
 * Motion:
 *  - BG:    from RIGHT  → final
 *  - SIGN:  from LEFT   → final (left ~2%, top ~38%)
 *  - CROWD: from BOTTOM → final (left 4%, top 52%, w 28%, h 22%)
 *  - TEXT:  from TOP    → final (right ~3%, bottom ~8%)
 * Opacity: starts at 0; reaches 1 at 15% of the move.
 */

// ======= Tuning knobs =======
const HOLD_SCROLL = '+=1200' // how long this scene is pinned/scrubbed
const MOVE_TIME   = 10.0
const MOVE_TIME_NARRATION = 10.0// move duration per element (affects scroll “speed”)
const OPACITY_LAG = 0.15     // 15% after motion begins
// ============================

export default function Scene_1() {
    const sectionRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const section = sectionRef.current
        if (!section) return

        const ctx = gsap.context(() => {
            // Ensure everything starts hidden
            gsap.set(['#scene1-bg', '#scene1-sign', '#scene1-crowd', '#scene1-text'], { opacity: 0 })

            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: section,
                    start: 'top top',
                    end: HOLD_SCROLL,
                    scrub: true,
                    pin: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                },
            })

            // Background: slide in from RIGHT → x:0
            gsap.set('#scene1-bg', { xPercent: 100 })
            tl.to('#scene1-bg', { xPercent: 0, duration: MOVE_TIME, ease: 'power2.out' }, 0)
            tl.to('#scene1-bg', { opacity: 1, duration: MOVE_TIME * (1 - OPACITY_LAG), ease: 'none' }, 0 + MOVE_TIME * OPACITY_LAG)

            // Sign: from LEFT → final (we keep Y fixed by not animating y)
            gsap.set('#scene1-sign', { x: '-30vw' }) // off-screen-ish to the left
            tl.to('#scene1-sign', { x: 0, duration: MOVE_TIME, ease: 'power2.out' }, 0.05)
            tl.to('#scene1-sign', { opacity: 1, duration: MOVE_TIME * (1 - OPACITY_LAG), ease: 'none' }, 0.05 + MOVE_TIME * OPACITY_LAG)

            // Crowd: from BOTTOM → final
            gsap.set('#scene1-crowd', { y: '30vh' }) // below the stage
            tl.to('#scene1-crowd', { y: 0, duration: MOVE_TIME, ease: 'power2.out' }, 0.10)
            tl.to('#scene1-crowd', { opacity: 1, duration: MOVE_TIME * (1 - OPACITY_LAG), ease: 'none' }, 0.10 + MOVE_TIME * OPACITY_LAG)

            // Narration: from TOP → final
            gsap.set('#scene1-text', { y: '-20vh' }) // above the stage
            tl.to('#scene1-text', { y: 0, duration: MOVE_TIME_NARRATION, ease: 'power2.out' }, 0.15)
            tl.to('#scene1-text', { opacity: 1, duration: MOVE_TIME_NARRATION * (1 - OPACITY_LAG), ease: 'none' }, 0.15 + MOVE_TIME_NARRATION)
        }, section)

        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} id="scene-1" className="relative h-[100vh]">
            <div className="relative w-full max-w-[1920px] mx-auto aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">

                {/* Background (slides in from right) */}
                <img
                    id="scene1-bg"
                    src="/app/static/images/scene_1_bg.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
                    draggable={false}
                />

                <div className="absolute inset-0">
                    {/* Loona sign — final position (visible & proven) */}
                    <img
                        id="scene1-sign"
                        src="/app/static/images/loona_sign.png"
                        alt="Loona to the Moon"
                        className="absolute select-none pointer-events-none"
                        draggable={false}
                        style={{
                            left: '2%',   // tune freely
                            top:  '38%',  // tune freely (this is BELOW the sign area in your BG)
                        }}
                    />

                    {/* Crowd (SvgFrameLooper) — final position (below the sign) */}
                    <div
                        id="scene1-crowd"
                        className="absolute"
                        style={{
                            left: '7%',
                            top:  '79%',
                            width: '28%',
                            height: '22%',
                            pointerEvents: 'none',
                        }}
                        aria-label="Crowd placement zone"
                    >
                        <SvgFrameLooper
                            frameCount={23}
                            fps={12}
                            pattern={(i: number) => `/app/static/svg/stickman/frame${String(i + 1).padStart(2, '0')}.png`}
                            className="absolute inset-0"
                        />
                    </div>

                    {/* Narration — final position (lower-right) */}
                    <div
                        id="scene1-text"
                        className="absolute bg-black/55 text-white rounded-md px-4 py-3"
                        style={{
                            right: '3%',
                            bottom: '75%',
                            maxWidth: '32%',
                        }}
                    >
                        <h3 className="text-xl font-semibold mb-1">Airdrop Day</h3>
                        <p className="text-lg opacity-90">
                            Social Media is buzzing as word spreads: “LOONA TO THE MOON, AIR DROP TODAY!!!” The INSIDERS have done their job - FOMO spreads like the plague.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
