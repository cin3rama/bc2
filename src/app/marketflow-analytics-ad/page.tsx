'use client'

import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {motion} from 'framer-motion'
import {
    AlertTriangle,
    BarChart2,
    Gauge,
    Loader2,
    PieChart as PieIcon,
    RefreshCcw,
    ShieldAlert,
} from 'lucide-react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {useHeaderConfig} from '@/contexts/HeaderConfigContext'
import {useTickerPeriod} from '@/contexts/TickerPeriodContext'
import { API_BASE } from '@/lib/env';

// --- Local UI primitives ----------------------------------------------------
const cn = (...a: (string | undefined | false)[]) => a.filter(Boolean).join(' ')

function Card({className, children}: React.PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={cn(
                'rounded-2xl border border-secondary dark:border-secondary-dark bg-surface dark:bg-surface-dark',
                className,
            )}
        >
            {children}
        </div>
    )
}

function CardHeader({className, children}: React.PropsWithChildren<{ className?: string }>) {
    return (
        <div className={cn('px-4 pt-4 pb-2 text-gray-700 dark:text-text-inverted/80', className)}>{children}</div>
    )
}

function CardContent({className, children}: React.PropsWithChildren<{ className?: string }>) {
    return (
        <div className={cn('px-4 pb-4 text-secondary-dark dark:text-text-inverted/80', className)}>{children}</div>
    )
}

function CardTitle({className, children}: React.PropsWithChildren<{ className?: string }>) {
    return <h3 className={cn('font-semibold', className)}>{children}</h3>
}

function CardDescription({className, children}: React.PropsWithChildren<{ className?: string }>) {
    return <p className={cn('text-sm text-secondary-dark dark:text-text-inverted/80', className)}>{children}</p>
}

// Buttons & Inputs -----------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
    size?: 'sm' | 'md' | 'lg'
}

function Button({className, children, variant = 'default', size = 'md', ...props}: ButtonProps) {
    const variantCls =
        variant === 'secondary'
            ? 'bg-secondary text-text-inverted hover:bg-secondary-dark border border-secondary dark:border-secondary-dark'
            : variant === 'ghost'
                ? 'bg-transparent hover:bg-secondary/20 dark:hover:bg-secondary-dark/40 border border-transparent text-secondary dark:text-text-inverted'
                : variant === 'destructive'
                    ? 'bg-error text-text-inverted hover:bg-error-dark border border-error-dark'
                    : variant === 'outline'
                        ? 'bg-transparent border border-secondary dark:border-secondary-dark text-secondary dark:text-text-inverted'
                        : 'bg-primary text-neutral-900 hover:bg-primary-light border border-primary-dark'

    const sizeCls =
        size === 'sm'
            ? 'px-2 py-1 text-xs rounded-lg'
            : size === 'lg'
                ? 'px-5 py-3 text-base rounded-2xl'
                : 'px-3 py-2 text-sm rounded-xl'

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none',
                variantCls,
                sizeCls,
                className,
            )}
            {...props}
        >
            {children}
        </button>
    )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={cn(
                'w-full rounded-md border border-secondary dark:border-secondary-dark bg-surface dark:bg-surface-dark',
                'px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary',
                props.className,
            )}
        />
    )
}

function Label({className, children, htmlFor}: { className?: string; children: React.ReactNode; htmlFor?: string }) {
    return (
        <label
            htmlFor={htmlFor}
            className={cn('text-xs uppercase tracking-wide text-secondary dark:text-text-inverted/80', className)}
        >
            {children}
        </label>
    )
}

/**
 * MARKETFLOW ANALYTICS — ACC/DIS PAGE (Phase 1)
 * Same layout/UX as the MM dashboard, but the data source is the `accdis` domain.
 * Fetches from: https://api.a3therflow.com/concentration-data?ticker=...&start_time=...&end_time=...&limit_raw=...
 * Live updates: subscribe to marketflowAnalytics$ (rxjs) from hooks/useWebsocket
 */

// ---- Types -----------------------------------------------------------------

type TopShares = Record<string, number> // keys: "1","3","5","10","20" → cumulative share (0..1)

type SideBundle = {
    hhi: number | null
    top_shares: TopShares | null
    top_share?: number | null
    n_participants?: number | null
    volume_sum?: number | null
}

type RegimeFlags = {
    is_fragmented: boolean
    is_concentrated: boolean
    is_dominated: boolean
    trap_risk: boolean
    squeeze_risk: boolean
}

type DomainConcentration = {
    ticker: string
    domain: 'mm' | 'accdis' | 'all'
    k_used: number
    buy: SideBundle | null
    sell: SideBundle | null
    lci?: number | null
    lci_star?: number | null
    fci?: number | null
    imbalance_frac?: number | null
    // NOTE: backend may send coverage.buy_frac/sell_frac (preferred) or coverage.buy/sell (legacy)
    coverage?: { buy?: number | null; sell?: number | null; buy_frac?: number | null; sell_frac?: number | null } | null
    regime_tag?: string | null
    regime_flags?: RegimeFlags | null
    reasons?: string[] | null
    meta?: Record<string, any> | null
    toasts?: any[] | null
}

type ConcentrationPayload = {
    ticker: string
    meta: {
        window: { start_time: string | number; end_time: string | number }
        generated_at_ms: number
        version: string
        source: string
        requested_period?: string
        effective_window?: { start_time: number; end_time: number }
        last_ready_window_start_ms?: number
        data_lag_ms?: number
    }
    concentration: {
        mm?: DomainConcentration | null
        accdis?: DomainConcentration | null
        all?: DomainConcentration | null
    }
}

// ---- Constants --------------------------------------------------------------

const api_endpoint = `${API_BASE}/api/mfa`
const DEFAULT_LIMIT_RAW = 200
const TICKER_OPTIONS = ['SOL-USD', 'BTC-USD', 'ETH-USD', 'ZEC-USD']

// chart palette
const CHART_SERIES = ['#8884d8', '#82ca9d', '#ffc658']
const PIE_COLORS = ['#8884d8', '#82ca9d']

// ---- Helpers ----------------------------------------------------------------

function pct(n?: number | null, digits = 0) {
    if (n === undefined || n === null || Number.isNaN(n)) return '—'
    return `${(n * 100).toFixed(digits)}%`
}

function fmt(n?: number | null, digits = 2) {
    if (n === undefined || n === null || Number.isNaN(n)) return '—'
    return Number(n).toLocaleString(undefined, {maximumFractionDigits: digits})
}

function regimeBadgeClass(tag?: string | null) {
    const base = 'px-2 py-0.5 rounded-full text-xs font-medium'
    if (!tag) return `${base} bg-secondary/20 dark:bg-secondary-dark/40 text-secondary dark:text-text-inverted`
    switch ((tag || '').toLowerCase()) {
        case 'concentrated':
            return `${base} bg-primary/20 text-secondary dark:bg-primary/10 dark:text-primary`
        case 'fragmented':
            return `${base} bg-accent/20 text-secondary dark:bg-accent/10 dark:text-accent`
        case 'dominated':
            return `${base} bg-error/20 text-error dark:bg-error/10 dark:text-error`
        default:
            return `${base} bg-secondary/20 dark:bg-secondary-dark/40 text-secondary dark:text-text-inverted`
    }
}

function msFromLocal(datetimeLocal: string): number | null {
    if (!datetimeLocal) return null
    const d = new Date(datetimeLocal)
    const ms = d.getTime()
    return Number.isFinite(ms) ? ms : null
}

function shareOrNull(numerator?: number | null, denom?: number | null) {
    if (!Number.isFinite(numerator as number) || !Number.isFinite(denom as number) || !denom) return null
    return (numerator as number) / (denom as number)
}

function TopSharesLine({ts}: { ts?: TopShares | null }) {
    const seriesData = useMemo(() => {
        const entries = ts ? Object.entries(ts) : []
        entries.sort((a, b) => Number(a[0]) - Number(b[0]))
        return entries.map(([k, v]) => ({name: `Top ${k}`, y: v * 100}))
    }, [ts])
    const options = useMemo(() => {
        return {
            chart: {type: 'line', height: 260, backgroundColor: 'transparent'},
            title: {text: undefined},
            xAxis: {categories: seriesData.map((p) => p.name)},
            yAxis: {title: {text: 'Share %'}, max: 100, min: 0},
            tooltip: {valueSuffix: '%'},
            legend: {enabled: false},
            series: [
                {type: 'line', data: seriesData.map((p) => p.y), color: CHART_SERIES[0], marker: {enabled: true}},
            ],
        } as Highcharts.Options
    }, [seriesData])
    return <HighchartsReact highcharts={Highcharts} options={options}/>
}

function CoveragePie({buy, sell}: { buy?: number | null; sell?: number | null }) {
    const options = useMemo(() => {
        return {
            chart: {type: 'pie', height: 200, spacing: [10, 10, 10, 10], backgroundColor: 'transparent'},
            title: {text: undefined},
            tooltip: {pointFormat: '<b>{point.percentage:.0f}%</b>'},
            plotOptions: {
                pie: {
                    innerSize: '60%',
                    dataLabels: {enabled: true, format: '{point.name}: {point.percentage:.0f}%'},
                },
            },
            series: [
                {
                    type: 'pie',
                    name: 'Coverage',
                    data: [
                        {name: 'Buy coverage', y: (buy ?? 0) * 100, color: PIE_COLORS[0]},
                        {name: 'Sell coverage', y: (sell ?? 0) * 100, color: PIE_COLORS[1]},
                    ],
                },
            ],
        } as Highcharts.Options
    }, [buy, sell])
    return <HighchartsReact highcharts={Highcharts} options={options}/>
}

// ---- Page -------------------------------------------------------------------

export default function MarketflowAnalyticsADPage() {
    const {setConfig} = useHeaderConfig()
    const { ticker, setTicker} = useTickerPeriod()

    // ensure header shows ticker, but period here is derived from manual time controls
    useEffect(() => {
        setConfig({showTicker: true, showPeriod: false})
    }, [setConfig])

    // const [ticker, setTicker] = useState<string>(ctxTicker || 'SOL-USD')
    const [startLocal, setStartLocal] = useState<string>(() => new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16))
    const [endLocal, setEndLocal] = useState<string>(() => new Date().toISOString().slice(0, 16))
    const [limit, setLimit] = useState<number>(DEFAULT_LIMIT_RAW)

    const [data, setData] = useState<ConcentrationPayload | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Live subscription state (same pattern as MM page)
    const [liveEnabled, setLiveEnabled] = useState(true)
    const [wsStatus, setWsStatus] = useState<'closed' | 'open' | 'error'>('closed')
    // access rxjs observable from shared hook (uses https under the hood for ngrok)
    const {marketflowAnalytics$} = require('@/hooks/useWebsocket').useWebsocket()

    const doFetch = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const qs = new URLSearchParams({ticker})
            const url = `${api_endpoint}?${qs.toString()}&period=1h&limit=${limit}`
            const resp = await fetch(url)
            if (!resp.ok) throw new Error(`Request failed: ${resp.status}`)
            const json = (await resp.json()) as ConcentrationPayload
            setData(json)
        } catch (e: any) {
            setError(e?.message || 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [ticker, startLocal, endLocal, limit])

    useEffect(() => {
        if (ticker) doFetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticker])

    // --- Subscribe to rxjs websocket subject (marketflowAnalytics$) ---
    useEffect(() => {
        if (!liveEnabled || !marketflowAnalytics$) return
        setWsStatus('open')

        const sub = marketflowAnalytics$.subscribe({
            next: (msg: any) => {
                try {
                    if (!msg) return
                    // Full payload: { payload: ConcentrationPayload }
                    const full = msg.payload
                    if (full && full.concentration) {
                        const tk = full.ticker || full.concentration?.accdis?.ticker || full.concentration?.mm?.ticker
                        if (tk && tk !== ticker) return

                        // normalize coverage for accdis branch if present
                        const ad = full.concentration.accdis
                        if (ad?.coverage && (ad.coverage.buy_frac != null || ad.coverage.sell_frac != null)) {
                            ad.coverage = {
                                buy: ad.coverage.buy ?? ad.coverage.buy_frac ?? null,
                                sell: ad.coverage.sell ?? ad.coverage.sell_frac ?? null,
                            }
                        }
                        setData(full)
                        return
                    }

                    // Delta: { type: 'minute_update', ticker, accdis: DomainConcentration }
                    if (msg.type === 'minute_update') {
                        const msgTicker = msg.ticker || msg?.concentration?.accdis?.ticker || msg?.concentration?.mm?.ticker
                        if (msgTicker && msgTicker !== ticker) return
                        const accdis = msg.accdis || msg?.concentration?.accdis
                        if (!accdis) return

                        const cov = accdis.coverage
                        const normCoverage = cov
                            ? {
                                buy: cov.buy ?? cov.buy_frac ?? null,
                                sell: cov.sell ?? cov.sell_frac ?? null,
                            }
                            : undefined
                        const nextAd = {...accdis, coverage: normCoverage}

                        setData((prev) => {
                            const base: ConcentrationPayload =
                                prev ?? {
                                    ticker: msgTicker || ticker,
                                    meta: {
                                        window: {start_time: 0, end_time: 0},
                                        generated_at_ms: Date.now(),
                                        version: 'live',
                                        source: 'ws',
                                    },
                                    concentration: {mm: null, accdis: null, all: null},
                                }
                            return {
                                ...base,
                                meta: {...base.meta, generated_at_ms: Date.now(), source: 'ws'},
                                concentration: {...base.concentration, accdis: nextAd as any},
                            }
                        })
                    }
                } catch (e) {
                    console.error('[marketflowAnalytics$][AD] parse error', e)
                }
            },
            error: () => setWsStatus('error'),
            complete: () => setWsStatus('closed'),
        })

        return () => {
            sub.unsubscribe()
            setWsStatus('closed')
        }
    }, [liveEnabled, marketflowAnalytics$, ticker])

    // ---- pick the ACC/DIS domain ------------------------------------------------
    const accdis = data?.concentration?.accdis || null
    const buy = accdis?.buy || null
    const sell = accdis?.sell || null

    // KPIs
    const hhi = accdis?.buy?.hhi ?? null // keep buy-focused HHI as primary
    const lci = accdis?.lci ?? null
    const fci = accdis?.fci ?? null
    const imb = accdis?.imbalance_frac ?? null

    // derive coverage from volume sums; fallback to backend coverage.{buy_frac,sell_frac} or legacy coverage.{buy,sell}
    const buyVol = buy?.volume_sum ?? null
    const sellVol = sell?.volume_sum ?? null
    const totalVol = (Number(buyVol) || 0) + (Number(sellVol) || 0)

    const derivedBuyShare = shareOrNull(buyVol, totalVol)
    const derivedSellShare = shareOrNull(sellVol, totalVol)

    const coverageBuy = (derivedBuyShare ?? accdis?.coverage?.buy ?? accdis?.coverage?.buy_frac) ?? null
    const coverageSell = (derivedSellShare ?? accdis?.coverage?.sell ?? accdis?.coverage?.sell_frac) ?? null

    const generatedAt = data?.meta?.generated_at_ms

    const copyJSON = useCallback(() => {
        if (!data) return
        navigator.clipboard?.writeText(JSON.stringify(data, null, 2))
    }, [data])

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-gray-900 dark:text-gray-100">
                        <motion.div initial={{opacity: 0, y: -6}} animate={{opacity: 1, y: 0}}
                                    className="text-2xl font-semibold">
                            Marketflow Analytics — Accumulators & Distributors (Phase 1)
                        </motion.div>
                        {accdis?.regime_tag &&
                            <span className={regimeBadgeClass(accdis.regime_tag)}>{accdis.regime_tag}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border',
                            wsStatus === 'open' && 'border-green-500/40 text-green-600 dark:text-green-400',
                            wsStatus === 'error' && 'border-rose-500/40 text-rose-600 dark:text-rose-400',
                            wsStatus === 'closed' && 'border-zinc-300/40 text-zinc-500 dark:text-zinc-400',
                        )}>
                          Live: {wsStatus}
                        </span>
                        {generatedAt ? `Generated: ${new Date(generatedAt).toLocaleString()}` : ''}
                    </div>
                </div>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="ticker">Ticker</Label>
                                <select
                                    id="ticker"
                                    className="border-secondary dark:border-secondary rounded-md bg-neutral-100 dark:bg-gray-900 p-2"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                >
                                    {TICKER_OPTIONS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="start">Start (local)</Label>
                                <Input id="start" type="datetime-local" value={startLocal}
                                       onChange={(e) => setStartLocal(e.target.value)}/>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="end">End (local)</Label>
                                <Input id="end" type="datetime-local" value={endLocal}
                                       onChange={(e) => setEndLocal(e.target.value)}/>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="limit">limit_raw</Label>
                                <Input
                                    id="limit"
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={limit}
                                    onChange={(e) => setLimit(Number(e.target.value) || 1)}
                                />
                            </div>

                            <div className="flex items-end gap-2">
                                <Button onClick={doFetch} disabled={loading} className="w-full">
                                    {loading ? (
                                        <span className="inline-flex items-center gap-2">
                                          <Loader2 className="h-4 w-4 animate-spin"/> Fetching
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                                          <RefreshCcw className="h-4 w-4"/> Fetch
                                        </span>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={copyJSON} disabled={!data}
                                        className="whitespace-nowrap">Copy JSON</Button>
                            </div>

                            <div className="flex items-end gap-2">
                                <Label className="sr-only">Live</Label>
                                <Button
                                    variant={liveEnabled ? 'secondary' : 'outline'}
                                    onClick={() => setLiveEnabled((v) => !v)}
                                >
                                    {liveEnabled ? 'Live ON' : 'Live OFF'}
                                </Button>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-3 text-sm text-rose-500 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4"/> {error}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* KPI Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile title="HHI (buy focus)" value={fmt(hhi, 3)} sub="Herfindahl–Hirschman Index"
                          icon={<BarChart2 className="h-4 w-4"/>}/>
                <StatTile title="LCI" value={fmt(lci, 3)} sub="Liquidity Concentration Index"
                          icon={<Gauge className="h-4 w-4"/>}/>
                <StatTile title="FCI" value={fmt(fci, 3)} sub="Flow Concentration Index"
                          icon={<Gauge className="h-4 w-4"/>}/>
                <StatTile title="Imbalance" value={pct(imb, 0)} sub="Buy vs Sell participation"
                          icon={<AlertTriangle className="h-4 w-4"/>}/>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="shadow-sm lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PieIcon className="h-4 w-4"/> Coverage (k-used: {accdis?.k_used ?? '—'})
                        </CardTitle>
                        <CardDescription>Share of accumulator/distributor volume covered by top-k
                            participants</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CoveragePie buy={coverageBuy} sell={coverageSell}/>
                        <div className="grid grid-cols-2 text-sm text-muted-foreground">
                            <div>Buy: {pct(coverageBuy, 0)}</div>
                            <div>Sell: {pct(coverageSell, 0)}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Top-k Cumulative Shares (Buy — Accumulators)</CardTitle>
                        <CardDescription>How quickly the top ranks accumulate share</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopSharesLine ts={buy?.top_shares || null}/>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Top-k Cumulative Shares (Sell — Distributors)</CardTitle>
                        <CardDescription>How quickly the top ranks accumulate share</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopSharesLine ts={sell?.top_shares || null}/>
                    </CardContent>
                </Card>
            </div>

            {/* Buy/Sell Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Buy Side — Accumulators</CardTitle>
                        <CardDescription>
                            Participants: {fmt(buy?.n_participants, 0)} • Volume: {fmt(buy?.volume_sum)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatTile title="HHI" value={fmt(buy?.hhi, 3)}/>
                            <StatTile title="Top 1" value={pct(buy?.top_shares?.['1'], 0)}/>
                            <StatTile title="Top 3" value={pct(buy?.top_shares?.['3'], 0)}/>
                            <StatTile title="Top 5" value={pct(buy?.top_shares?.['5'], 0)}/>
                            <StatTile title="Top 10" value={pct(buy?.top_shares?.['10'], 0)}/>
                            <StatTile title="Top 20" value={pct(buy?.top_shares?.['20'], 0)}/>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Sell Side — Distributors</CardTitle>
                        <CardDescription>
                            Participants: {fmt(sell?.n_participants, 0)} • Volume: {fmt(sell?.volume_sum)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatTile title="HHI" value={fmt(sell?.hhi, 3)}/>
                            <StatTile title="Top 1" value={pct(sell?.top_shares?.['1'], 0)}/>
                            <StatTile title="Top 3" value={pct(sell?.top_shares?.['3'], 0)}/>
                            <StatTile title="Top 5" value={pct(sell?.top_shares?.['5'], 0)}/>
                            <StatTile title="Top 10" value={pct(sell?.top_shares?.['10'], 0)}/>
                            <StatTile title="Top 20" value={pct(sell?.top_shares?.['20'], 0)}/>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Regime & Reasons / Toasts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="shadow-sm lg:col-span-2 mb-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Regime & Rationale (Acc/Dis)</CardTitle>
                        <CardDescription>Flags and reasons for current tag</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                            {accdis?.regime_flags && (
                                <>
                                  <span
                                      className={`px-2 py-0.5 rounded-full ${accdis.regime_flags.is_fragmented ? 'bg-sky-200 text-sky-900 dark:bg-sky-300/20 dark:text-sky-300' : 'dark:bg-neutral-200 bg-gray-900'}`}
                                  >
                                    fragmented
                                  </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full ${accdis.regime_flags.is_concentrated ? 'bg-amber-200 text-amber-900 dark:bg-amber-300/20 dark:text-amber-300' : 'dark:bg-neutral-200 bg-gray-900'}`}
                                    >
                                    concentrated
                                  </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full ${accdis.regime_flags.is_dominated ? 'bg-rose-200 text-rose-900 dark:bg-rose-300/20 dark:text-rose-300' : 'dark:bg-neutral-200 bg-gray-900'}`}
                                    >
                                    dominated
                                  </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full ${accdis.regime_flags.trap_risk ? 'bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-300/20 dark:text-fuchsia-300' : 'dark:bg-neutral-200 bg-gray-900'}`}
                                    >
                                    trap risk
                                  </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full ${accdis.regime_flags.squeeze_risk ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-300/20 dark:text-emerald-300' : 'dark:bg-neutral-200 bg-gray-900'}`}
                                    >
                                    squeeze risk
                                  </span>
                                </>
                            )}
                        </div>
                        <ul className="list-disc pl-6 text-sm space-y-1">
                            {(accdis?.reasons || []).map((r, i) => (
                                <li key={i}>{r}</li>
                            ))}
                            {(!accdis?.reasons || accdis?.reasons.length === 0) && (
                                <li className="text-muted-foreground">No reasons provided.</li>
                            )}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="shadow-sm mb-8">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Alerts / Toasts</CardTitle>
                        <CardDescription>Recent regime changes & signals</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 ">
                        {(accdis?.toasts ?? []).length > 0 ? (
                            (accdis!.toasts as any[]).map((t, i) => {
                                const isObj = t && typeof t === 'object'
                                const key = (isObj && (t.id ?? (t as any).title ?? (t as any).message)) || i
                                const title = isObj ? (t.title ?? (t as any).type ?? 'Alert') : undefined
                                const message = isObj ? (t.message ?? '') : String(t)
                                const sev = isObj ? ((t as any).severity ?? (t as any).type ?? 'info') : 'info'

                                const sevCls =
                                    sev === 'error'
                                        ? 'bg-error/10 text-error border border-error/40'
                                        : sev === 'warning'
                                            ? 'bg-accent/10 text-accent border border-accent/40'
                                            : sev === 'success'
                                                ? 'bg-success/10 text-success border border-success/40'
                                                : 'bg-secondary/10 text-secondary border border-secondary/40'

                                return (
                                    <div key={key} className={`text-sm border rounded-md p-2 ${sevCls}`}>
                                        {title ? <div className="font-medium">{title}</div> : null}
                                        <div>{message}</div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-sm text-muted-foreground">None yet. (Appears once previous states are
                                supplied.)</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ---- Small tiles component (at bottom to avoid TS hoist issues) ------------
function StatTile({
                      title,
                      value,
                      sub,
                      icon,
                  }: {
    title: string
    value: string
    sub?: string
    icon?: React.ReactNode
}) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </CardContent>
        </Card>
    )
}
