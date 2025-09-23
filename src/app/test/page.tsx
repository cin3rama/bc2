'use client'

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin)

/**
 * Simple scroll-driven SVG morph demo for Next.js App Router at app/test/page.tsx
 * - Uses GSAP + MorphSVGPlugin (and ScrollTrigger) to morph a single <path>
 * - Pins the section and scrubs the morph as you scroll
 *
 * Requirements (one-time):
 *   npm i gsap
 *   // If you have Club GreenSock, ensure MorphSVGPlugin is available at 'gsap/MorphSVGPlugin'.
 *   // Otherwise, during development you can use the trial build: 'gsap-trial/MorphSVGPlugin'.
 */

export default function TestMorphPage() {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const svgRef = useRef<SVGSVGElement | null>(null)

    // Inline path data extracted from your source SVGs (viewBox: 0 0 1080 1080)
    // We'll load your SVG path data at runtime from /public/svgs to avoid bundling massive strings.
    const BULL_URL = '/public/static/svgs/bc2_hp_string_bull_head-01.svg'
    const COMPASS_URL = '/public/static/svgs/bc2_hp_string_compass-01.svg'

    useEffect(() => {
        let ctx: any
        ;(async () => {
            // Dynamic import to avoid SSR issues in Next.js
            const gsapMod = await import('gsap')
            const gsap = (gsapMod as any).gsap || (gsapMod as any).default || gsapMod
            const { ScrollTrigger } = await import('gsap/ScrollTrigger')

            // Try Club version first, then trial build as a fallback
            let MorphSVGPlugin: any
            try {
                MorphSVGPlugin = (await import('gsap/MorphSVGPlugin')).MorphSVGPlugin
            } catch (e) {
                try {
                    MorphSVGPlugin = (await import('gsap/MorphSVGPlugin')).MorphSVGPlugin
                    // eslint-disable-next-line no-console
                    console.warn('Using gsap-trial/MorphSVGPlugin. Replace with Club GSAP build for production.')
                } catch (e2) {
                    console.error('MorphSVGPlugin not found. Install Club GSAP plugin or gsap-trial package to proceed.')
                    return
                }
            }

            gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin)

            ctx = gsap.context(() => {
                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top top',
                        end: '+=1500', // scroll distance
                        scrub: true,
                        pin: true
                    }
                })

                // Optional: a quick draw-on effect before/while morphing
                // Load & seed paths, then animate
                const loadPathD = async (url: string) => {
                    const res = await fetch(url)
                    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
                    const txt = await res.text()
                    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
                    const p = doc.querySelector('path')
                    if (!p) throw new Error('No <path> found in ' + url)
                    return p.getAttribute('d')!
                }

                Promise.all([loadPathD(BULL_URL), loadPathD(COMPASS_URL)]).then(([bullD, compassD]) => {
                    const vis = svgRef.current?.querySelector<SVGPathElement>('#morphPath')
                    const tgt = svgRef.current?.querySelector<SVGPathElement>('#targetPath')
                    if (!vis || !tgt) { console.error('Expected #morphPath and #targetPath inside the SVG'); return }
                    vis.setAttribute('d', bullD)
                    tgt.setAttribute('d', compassD)

                    gsap.set('#morphPath', { strokeDasharray: 4000, strokeDashoffset: 4000 })
                    tl.to('#morphPath', { strokeDashoffset: 0, duration: 0.35, ease: 'none' }, 0)
                    tl.to('#morphPath', { duration: 1, ease: 'none', morphSVG: { shape: '#targetPath', shapeIndex: 'auto' } }, 0)
                }).catch(err => console.error(err))

                // Core morph: bull -> compass
                tl.to('#morphPath', {
                    duration: 1,
                    ease: 'none',
                    // You can target a selector or pass raw path data
                    morphSVG: { shape: '#targetPath', shapeIndex: 'auto' }
                }, 0)
            }, containerRef)
        })()

        return () => ctx?.revert()
    }, [])

    return (
        <div ref={containerRef} className="min-h-[200vh] bg-black text-white">
            {/* Intro spacer to make scrolling feel natural before pinning */}
            <div className="h-[30vh] flex items-end justify-center text-center opacity-80">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Scroll Morph Demo</h1>
                    <p className="text-sm opacity-70">Bull string → Compass string</p>
                </div>
            </div>

            {/* Pinned stage */}
            <section className="h-[100vh] sticky top-0 grid place-items-center">
                <svg ref={svgRef}
                     className="w-[68vw] max-w-[900px] drop-shadow-lg"
                     viewBox="0 0 1080 1080"
                     role="img"
                     aria-label="Morphing decorative line art"
                >
                    <defs>
                        {/* target path is hidden; MorphSVG reads its geometry */}
                        <path id="targetPath" d="" />
                    </defs>

                    <g>
                        <path
                            id="morphPath"
                            d=""
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                        />
                    </g>
                </svg>
            </section>

            {/* Outro spacer */}
            <div className="h-[120vh]" />
        </div>
    )
}
