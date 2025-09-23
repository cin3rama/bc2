'use client'

import React, { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

/** Place at: /public/static/glb/cheering_crowd.glb  → URL: /app/static/glb/cheering_crowd.glb */
const GLB = '/app/static/glb/cheering_crowd.glb'

export default function StickCrowdPair({ className }: { className?: string }) {
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
            <directionalLight position={[-3, 3, 2]} intensity={0.7} />

            <Suspense fallback={null}>
                <Pair />
            </Suspense>
        </Canvas>
    )
}

function Pair() {
    const { scene, animations } = useGLTF(GLB)

    // Find up to two animated roots (direct children with a SkinnedMesh somewhere inside)
    const roots = useMemo(() => {
        const hasSkinnedDesc = (o: THREE.Object3D) => {
            let found = false
            o.traverse((n) => { if (n instanceof THREE.SkinnedMesh) found = true })
            return found
        }

        const direct = scene.children.filter(hasSkinnedDesc)

        // Fallback: find top-level ancestors of any SkinnedMesh under the scene
        const fallback: THREE.Object3D[] = []
        if (direct.length === 0) {
            scene.traverse((n) => {
                if (n instanceof THREE.SkinnedMesh) {
                    let top: THREE.Object3D = n
                    while (top.parent && top.parent !== scene) top = top.parent
                    if (!fallback.includes(top)) fallback.push(top)
                }
            })
        }

        return (direct.length ? direct : fallback).slice(0, 2)
    }, [scene])

    // Simple placements for the two characters
    const placements = useMemo(
        () => [
            { p: [-0.45, -0.12, 0] as [number, number, number], r: [0, -0.06, 0] as [number, number, number], s: 0.95, d: 0.12, sp: 1.02 },
            { p: [ 0.35, -0.06, 0] as [number, number, number], r: [0,  0.08, 0] as [number, number, number], s: 1.03, d: 0.48, sp: 0.97 },
        ],
        []
    )

    return (
        <group>
            {roots.map((root, i) => (
                <AnimatedClone
                    key={`root-${i}`}
                    base={root}
                    clips={animations}
                    p={placements[i % placements.length].p}
                    r={placements[i % placements.length].r}
                    s={placements[i % placements.length].s}
                    d={placements[i % placements.length].d}
                    sp={placements[i % placements.length].sp}
                />
            ))}
        </group>
    )
}

function AnimatedClone({
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
    // Deep clone this sub-tree so it has its own skeleton/bones
    const inst = useMemo(() => SkeletonUtils.clone(base) as THREE.Object3D, [base])
    const mixer = useMemo(() => new THREE.AnimationMixer(inst), [inst])

    useEffect(() => {
        if (!clips?.length) return

        // Build a set of node names on this instance
        const names = new Set<string>()
        inst.traverse((o) => { if (o.name) names.add(o.name) })

        const nodeName = (trackName: string) => {
            const dot = trackName.indexOf('.')
            return dot === -1 ? trackName : trackName.slice(0, dot)
        }

        // Choose the clip that matches the MOST tracks on THIS instance
        let bestClip: THREE.AnimationClip | undefined
        let bestCount = -1
        for (const c of clips) {
            const count = c.tracks.reduce((acc, t) => acc + (names.has(nodeName(t.name)) ? 1 : 0), 0)
            if (count > bestCount) { bestCount = count; bestClip = c }
        }
        if (!bestClip || bestCount <= 0) {
            // No matching tracks; render static
            return
        }

        // Filter to matching tracks for this instance to avoid PropertyBinding warnings
        const filteredTracks = bestClip.tracks.filter((t) => names.has(nodeName(t.name)))
        const useClip = Object.assign(bestClip.clone(), { tracks: filteredTracks })

        const action = mixer.clipAction(useClip, inst)
        action.enabled = true
        action.setEffectiveWeight(1)
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
        <primitive object={inst} position={p} rotation={r} scale={[0.7 * s, 0.7 * s, 0.7 * s]} />
    )
}

useGLTF.preload(GLB)
