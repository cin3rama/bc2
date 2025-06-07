'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function AnimatedRadialLogo() {
    const groupRefs = useRef<Record<string, SVGGElement | null>>({
        L1_bot: null, L1_top: null,
        L2_bot: null, L2_top: null,
        L3_lft: null, L3_rt: null,
        L4_lft: null, L4_rt: null,
    });

    const [showCard, setShowCard] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const ringRefs = useRef<SVGCircleElement[]>([]);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (!hasMounted) return;

        const tl = gsap.timeline({ defaults: { ease: 'power2.out', transformOrigin: 'center' } });

        Object.entries(groupRefs.current).forEach(([id, el], i) => {
            if (el) {
                tl.from(el, {
                    opacity: 0,
                    scale: 0.8,
                    duration: 0.4,
                }, i * 0.1);
            }
        });

        ringRefs.current.forEach((ring, i) => {
            gsap.fromTo(ring,
                { scale: 0, opacity: 0.3 },
                {
                    scale: 2.4,
                    opacity: 0,
                    duration: 2.5,
                    repeat: -1,
                    ease: 'sine.out',
                    delay: i * 0.6,
                    transformOrigin: '0px 0px',
                });
        });
    }, [hasMounted]);

    const handleMouseEnter = () => {
        Object.values(groupRefs.current).forEach(el => {
            if (el) gsap.to(el, { filter: 'brightness(1.4)', duration: 0.3 });
        });
    };

    const handleMouseLeave = () => {
        Object.values(groupRefs.current).forEach(el => {
            if (el) gsap.to(el, { filter: 'brightness(1)', duration: 0.3 });
        });
    };

    const handleClick = () => {
        setShowCard(true);
    };

    if (!hasMounted) return null;

    return (
        <div className="relative w-[250px] h-[250px] flex items-center justify-center cursor-pointer"
             onMouseEnter={handleMouseEnter}
             onMouseLeave={handleMouseLeave}
             onClick={handleClick}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-48.885 -48.885 97.77 97.77" className="w-full h-full">
                <defs>
                    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                    </filter>
                </defs>

                {/* Animated Halo Rings */}
                {[...Array(3)].map((_, i) => (
                    <circle
                        key={i}
                        ref={el => {
                            if (el) ringRefs.current[i] = el;
                        }}
                        cx="0"
                        cy="0"
                        r="42"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="2"
                        filter="url(#blur)"
                    />
                ))}

                {/* Arc Groups */}
                <g transform="translate(0, 0)">
                    <g id="L1_top" ref={(el) => groupRefs.current.L1_top = el}>
                        <path fill="#34c6eb" d="M53.69,30.95l1.12-4.18c-3.88-1.04-7.97-1.04-11.85,0l1.12,4.18c3.14-.84,6.47-.84,9.61,0Z" />
                        <path fill="#40afda" d="M62.01,35.76l3.06-3.06c-2.95-2.95-6.5-4.93-10.26-5.93l-1.12,4.18c3.05.81,5.93,2.42,8.32,4.81Z" />
                        <path fill="#1a6184" d="M62.01,35.76c2.39,2.39,3.99,5.27,4.81,8.32l4.18-1.12c-1-3.76-2.98-7.31-5.93-10.26h0l-3.06,3.06h0Z" />
                        <path fill="#083551" d="M71,42.96l-4.18,1.12c.84,3.14.84,6.47,0,9.61l4.18,1.12c1.04-3.88,1.04-7.98,0-11.85Z" />
                        <path fill="#59d9ff" d="M44.08,30.95l-1.12-4.18c-3.76,1-7.31,2.98-10.26,5.93l3.06,3.06c2.39-2.39,5.27-3.99,8.32-4.81Z" />
                    </g>

                    <g id="L1_bot" ref={(el) => groupRefs.current.L1_bot = el}>
                        <path fill="#083551" d="M30.95,44.08l-4.18-1.12c-1.04,3.88-1.04,7.98,0,11.85l4.18-1.12c-.84-3.14-.84-6.47,0-9.61Z" />
                        <path fill="#59d9ff" d="M53.69,66.82l1.12,4.18c3.76-1,7.31-2.98,10.26-5.93l-3.06-3.06c-2.39,2.39-5.27,3.99-8.32,4.81Z" />
                        <path fill="#1a6184" d="M30.95,53.69l-4.18,1.12c1,3.76,2.98,7.31,5.93,10.26l3.06-3.06c-2.39-2.39-3.99-5.27-4.81-8.32Z" />
                        <path fill="#34c6eb" d="M44.08,66.82l-1.12,4.18c3.88,1.04,7.97,1.04,11.85,0l-1.12-4.18c-3.14.84-6.47.84-9.61,0Z" />
                        <path fill="#40afda" d="M35.76,62.01h0l-3.06,3.06h0c2.95,2.95,6.5,4.93,10.26,5.93l1.12-4.18c-3.05-.81-5.93-2.42-8.32-4.81Z" />
                    </g>

                    <g id="L2_bot" ref={(el) => groupRefs.current.L2_bot = el}>
                        <path fill="#1a6184" d="M22.58,41.84l-4.18-1.12c-1.43,5.35-1.43,10.99,0,16.34l4.18-1.12c-1.23-4.61-1.23-9.48,0-14.1Z" />
                        <path fill="#34c6eb" d="M29.63,68.14h0l-3.06,3.06h0c4.07,4.07,8.96,6.79,14.15,8.17l1.12-4.18c-4.47-1.19-8.7-3.54-12.2-7.05Z" />
                        <path fill="#083551" d="M41.84,75.19l-1.12,4.18c5.35,1.43,10.99,1.43,16.34,0l-1.12-4.18c-4.61,1.23-9.48,1.23-14.1,0Z" />
                        <path fill="#40afda" d="M22.58,55.93l-4.18,1.12c1.38,5.18,4.11,10.08,8.17,14.15l3.06-3.06c-3.51-3.51-5.86-7.73-7.05-12.2Z" />
                        <path fill="#083551" d="M29.63,29.63l-3.06-3.06c-4.07,4.07-6.79,8.96-8.17,14.15l4.18,1.12c1.19-4.47,3.54-8.7,7.05-12.2Z" />
                    </g>

                    <g id="L2_top" ref={(el) => groupRefs.current.L2_top = el}>
                        <path fill="#34c6eb" d="M68.14,29.63l3.06-3.06c-4.07-4.07-8.96-6.79-14.15-8.17l-1.12,4.18c4.47,1.19,8.7,3.54,12.2,7.05Z" />
                        <path fill="#59d9ff" d="M55.93,22.58l1.12-4.18c-5.35-1.43-10.99-1.43-16.34,0l1.12,4.18c4.61-1.23,9.48-1.23,14.1,0Z" />
                        <path fill="#40afda" d="M68.14,29.63c3.51,3.51,5.86,7.73,7.05,12.2l4.18-1.12c-1.38-5.18-4.11-10.08-8.17-14.15h0l-3.06,3.06h0Z" />
                        <path fill="#1a6184" d="M75.19,55.93l4.18,1.12c1.43-5.35,1.43-10.99,0-16.34l-4.18,1.12c1.23,4.61,1.23,9.48,0,14.1Z" />
                        <path fill="#083551" d="M68.14,68.14l3.06,3.06c4.07-4.07,6.79-8.96,8.17-14.15l-4.18-1.12c-1.19,4.47-3.54,8.7-7.05,12.2Z" />
                    </g>


                    <g id="L3_rt" ref={(el) => groupRefs.current.L3_rt = el}>
                        <path fill="#1a6184" d="M74.26,74.26l3.06,3.06c5.18-5.18,8.65-11.43,10.42-18.03l-4.18-1.12c-1.57,5.89-4.67,11.46-9.29,16.09Z" />
                        <path fill="#083551" d="M58.17,83.56l1.12,4.18c6.6-1.76,12.85-5.23,18.03-10.42l-3.06-3.06c-4.62,4.62-10.19,7.72-16.09,9.29Z" />
                        <path fill="#59d9ff" d="M74.26,23.51l3.06-3.06c-5.18-5.18-11.42-8.65-18.03-10.42l-1.12,4.18c5.89,1.57,11.46,4.67,16.09,9.29Z" />
                        <path fill="#40afda" d="M83.56,58.17l4.18,1.12c1.82-6.81,1.82-14.01,0-20.82l-4.18,1.12c1.62,6.08,1.62,12.5,0,18.58Z" />
                        <path fill="#34c6eb" d="M74.26,23.51c4.62,4.62,7.72,10.19,9.29,16.09l4.18-1.12c-1.76-6.6-5.23-12.85-10.42-18.03h0l-3.06,3.06h0Z" />
                    </g>


                    <g id="L3_lft" ref={(el) => groupRefs.current.L3_lft = el}>
                        <path fill="#40afda" d="M14.21,39.59l-4.18-1.12c-1.82,6.81-1.82,14.01,0,20.82l4.18-1.12c-1.62-6.08-1.62-12.5,0-18.58Z" />
                        <path fill="#1a6184" d="M23.51,23.51l-3.06-3.06c-5.18,5.18-8.65,11.42-10.42,18.03l4.18,1.12c1.57-5.89,4.67-11.46,9.29-16.09Z" />
                        <path fill="#083551" d="M39.59,14.21l-1.12-4.18c-6.6,1.76-12.85,5.23-18.03,10.42l3.06,3.06c4.62-4.62,10.19-7.72,16.09-9.29Z" />
                        <path fill="#34c6eb" d="M14.21,58.17l-4.18,1.12c1.76,6.6,5.23,12.85,10.42,18.03l3.06-3.06c-4.62-4.62-7.72-10.19-9.29-16.09Z" />
                        <path fill="#58d9ff" d="M38.47,87.74l1.12-4.18c-5.89-1.57-11.46-4.67-16.09-9.29h0l-3.06,3.06h0c5.18,5.18,11.42,8.65,18.03,10.42Z" />
                    </g>

                    <g id="L4_lft" ref={(el) => groupRefs.current.L4_lft = el}>
                        <path fill="#58d9ff" d="M5.84,60.42l-4.18,1.12c2.14,8.03,6.36,15.62,12.66,21.91l3.06-3.06c-5.74-5.74-9.58-12.66-11.54-19.97Z" />
                        <path fill="#34c6eb" d="M1.66,61.54l4.18-1.12c-2.01-7.55-2.01-15.52,0-23.07l-4.18-1.12c-2.21,8.28-2.21,17.03,0,25.31Z" />
                        <path fill="#1a6184" d="M37.35,5.84l-1.12-4.18c-8.03,2.14-15.62,6.36-21.91,12.66l3.06,3.06c5.74-5.74,12.66-9.59,19.97-11.54Z" />
                        <path fill="#40afda" d="M17.38,17.38l-3.06-3.06c-6.3,6.3-10.52,13.89-12.66,21.91l4.18,1.12c1.95-7.32,5.8-14.23,11.54-19.97Z" />
                        <path fill="#083551" d="M60.42,5.84l1.12-4.18c-8.28-2.21-17.03-2.21-25.31,0l1.12,4.18c7.55-2.01,15.52-2.01,23.07,0Z" />
                    </g>

                    <g id="L4_rt" ref={(el) => groupRefs.current.L4_rt = el}>
                        <path fill="#59d9ff" d="M80.39,17.38c5.74,5.74,9.58,12.66,11.54,19.97l4.18-1.12c-2.14-8.03-6.36-15.62-12.66-21.91h0l-3.06,3.06h0Z" />
                        <path fill="#083551" d="M37.35,91.93l-1.12,4.18c8.28,2.21,17.03,2.21,25.31,0l-1.12-4.18c-7.55,2.01-15.52,2.01-23.07,0Z" />
                        <path fill="#1a6184" d="M60.42,91.93l1.12,4.18c8.03-2.14,15.62-6.36,21.91-12.66l-3.06-3.06c-5.74,5.74-12.66,9.58-19.97,11.54Z" />
                        <path fill="#40afda" d="M80.39,80.39l3.06,3.06c6.3-6.3,10.52-13.89,12.66-21.91l-4.18-1.12c-1.95,7.32-5.8,14.23-11.54,19.97Z" />
                        <path fill="#34c6eb" d="M91.93,60.42l4.18,1.12c2.21-8.28,2.21-17.03,0-25.31l-4.18,1.12c2.01,7.55,2.01,15.52,0,23.07Z" />
                    </g>
                </g>
            </svg>

            {showCard && (
                <div className="absolute top-0 left-[calc(100%+10px)] w-[350px] h-[280px] bg-white dark:bg-gray-900 shadow-xl rounded-md p-4 text-sm z-50">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="font-bold text-lg">Info Card</h2>
                        <button onClick={() => setShowCard(false)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                    <p>This is a placeholder info card. Content goes here.</p>
                </div>
            )}
        </div>
    );
}
