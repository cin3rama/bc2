'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import Scene_1 from '@/components/Scene_1'
import LoadingIndicator from '@/components/LoadingIndicator';

export default function StickPage() {
    const { setConfig } = useHeaderConfig()
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false })
    }, [setConfig])

    // Existing data holder (kept in case other parts use it)
    const [orderflowData, setOrderflowData] = useState<any>({})

    // New: holds the raw JSON result you want to manually copy
    const [results, setResults] = useState<any>(null)

    const { ticker, period } = useTickerPeriod()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const endTime = Math.floor(Date.now())
            const periodMapping: Record<string, number> = {
                '15min': 900000,
                '1h': 3600000,
                '4h': 14400000,
                '1d': 86400000,
                '1w': 604800000,
            }
            const periodMs = periodMapping[period]
            if (!periodMs) {
                throw new Error(`Unsupported period: ${period}`)
            }
            const startTime = endTime - periodMs
            const url = `https://botpilot--8000.ngrok.io/ai_prompt/?sym=${ticker}&start_time=${startTime}&end_time=${endTime}&limit=20`

            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Network response was not ok (${response.status})`)
            }
            const result = await response.json()

            // Populate both states
            setOrderflowData(result)
            setResults(result)
        } catch (err: any) {
            console.error('Error fetching orderflow data:', err)
            setError(err?.message ?? 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [ticker, period])

    useEffect(() => {
        // Auto-load on mount or when ticker/period changes
        fetchData()
    }, [fetchData])

    if (loading) {
        return <LoadingIndicator message="Loading...this may take a while, big data" />
    }

    return (
        <main className="w-full">
            <div className="h-[20vh]" />

            <div className="mx-auto max-w-5xl w-full space-y-4 px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 rounded-2xl shadow-sm border border-neutral-300 dark:border-neutral-700 hover:shadow transition
                       bg-neutral-50 dark:bg-neutral-800 text-text dark:text-text-dark"
                        aria-label="Fetch JSON"
                    >
                        Fetch JSON
                    </button>

                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Ticker: <strong>{ticker}</strong> &middot; Period: <strong>{period}</strong>
          </span>
                </div>

                {error && (
                    <div className="text-sm text-error border border-error/30 bg-error/5 rounded-lg p-3">
                        {error}
                    </div>
                )}

                {/* Copyable JSON output area */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Results (copyable JSON)
                    </label>
                    <textarea
                        readOnly
                        value={results ? JSON.stringify(results, null, 2) : '// No results yet'}
                        className="w-full h-80 md:h-96 font-mono text-sm p-3 rounded-xl border border-neutral-300 dark:border-neutral-700
                       bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 resize-y"
                    />
                </div>
            </div>

            <Scene_1 />
            {/* <Scene_2 /> … <Scene_8 /> later */}
            <div className="h-[120vh]" />
        </main>
    )
}

