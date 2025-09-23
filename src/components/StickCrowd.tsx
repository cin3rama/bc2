'use client'

import React, { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

/** Public URL (with basePath): /app/static/glb/cheering_instance.glb */
const GLB = '/app/static/glb/cheering_instance.glb'

export default function StickCrowd({ className }: { className?: string }) {
    return (
        <Canvas
            orthographic
            camera={{ position: [0, 0, 100], zoom: 120 }}
            gl={{ antialias: true, alpha: true }}
            className={className}
            style={{ width: '100%', height: '100%' }}
        >
            <ambientLight intensity={1.2} />
            <directionalLight position={[2, 4, 6]} intensity={1.4} />
            <Suspense fallback={null}>
                <Crowd />
            </Suspense>
        </Canvas>
    )
}

function Crowd() {
    const { scene, animations } = useGLTF(GLB)

    const cfgs = useMemo(() => {
        const rows = 3, cols = 4, rg = 0.9, cg = 0.9
        const bx = -((cols - 1) * cg) / 2, by = -((rows - 1) * rg) / 2
        const R = (a: number, b: number) => a + Math.random() * (b - a)
        return Array.from({ length: rows * cols }, (_, i) => ({
            key: `s${i}`,
            p: [bx + (i % cols) * cg + R(-0.12, 0.12), by + Math.floor(i / cols) * rg + R(-0.08, 0.08), -Math.floor(i / cols) * 0.15 + R(-0.02, 0.02)] as [number, number, number],
            r: [0, R(-0.15, 0.15), 0] as [number, number, number],
            s: R(0.85, 1.05),
            d: R(0, 0.8) + Math.floor(i / cols) * 0.15 + (i % 2) * 0.1,
            sp: R(0.92, 1.08),
        }))
    }, [])

    return (
        <group>
            {cfgs.map((c) => (
                <Stick
                    key={c.key}
                    base={scene}
                    clips={animations}
                    p={c.p}
                    r={c.r}
                    s={c.s}
                    d={c.d}
                    sp={c.sp}
                />
            ))}
        </group>
    )
}

function Stick({
                   base, clips, p, r, s, d, sp
               }: {
    base: THREE.Object3D
    clips: THREE.AnimationClip[]
    p: [number, number, number]
    r: [number, number, number]
    s: number
    d: number
    sp: number
}) {
    // Deep clone per instance (separate skeleton; names preserved)
    const inst = useMemo(() => SkeletonUtils.clone(base) as THREE.Object3D, [base])
    const mixer = useMemo(() => new THREE.AnimationMixer(inst), [inst])

    useEffect(() => {
        const clip = clips?.[0]
        if (!clip) return

        // Build a name set from the clone (for filtering tracks that won't bind)
        const names = new Set<string>()
        inst.traverse((o: any) => o?.name && names.add(o.name))

        const nodeName = (trackName: string) => {
            const dot = trackName.indexOf('.')
            return dot === -1 ? trackName : trackName.slice(0, dot)
        }

        const filtered = clip.tracks.filter((t) => names.has(nodeName(t.name)))
        // Use filtered clip if we dropped anything
        const useClip =
            filtered.length && filtered.length !== clip.tracks.length
                ? Object.assign(clip.clone(), { tracks: filtered })
                : clip

        const action = mixer.clipAction(useClip, inst)
        action.reset().setLoop(THREE.LoopRepeat, Infinity).play()
        action.time = d % (useClip.duration || 1)
        action.timeScale = sp

        return () => {
            action.stop()
            mixer.stopAllAction()
            ;(mixer as any).uncacheRoot?.(inst)
        }
    }, [clips, inst, mixer, d, sp])

    useFrame((_, dt) => mixer.update(dt))

    return (
        <primitive
            object={inst}
            position={p}
            rotation={r}
            scale={[0.7 * s, 0.7 * s, 0.7 * s]}
        />
    )
}

useGLTF.preload(GLB)
