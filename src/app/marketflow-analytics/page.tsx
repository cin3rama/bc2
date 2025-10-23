'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    AlertTriangle,
    BarChart2,
    ClipboardCopy,
    Gauge,
    Loader2,
    PieChart as PieIcon,
    RefreshCcw,
    ShieldAlert,
} from 'lucide-react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { useHeaderConfig } from '@/contexts/HeaderConfigContext'
import { useTickerPeriod } from '@/contexts/TickerPeriodContext'

// --- Local UI primitives (drop-in replacements for shadcn/ui) -----------------
const cn = (...a: (string|undefined|false)[]) => a.filter(Boolean).join(' ')

function Card({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <div className={cn('rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900', className)}>{children}</div>
}
function CardHeader({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <div className={cn('px-4 pt-4 pb-2', className)}>{children}</div>
}
function CardContent({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <div className={cn('px-4 pb-4', className)}>{children}</div>
}
function CardTitle({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <h3 className={cn('font-semibold', className)}>{children}</h3>
}
function CardDescription({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <p className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)}>{children}</p>
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
    size?: 'sm' | 'md' | 'lg'
}
function Button({ className, children, variant = 'default', size = 'md', ...props }: ButtonProps) {
    const variantCls =
        variant === 'secondary'
            ? 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
            : variant === 'ghost'
                ? 'bg-transparent hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 border border-transparent'
                : variant === 'destructive'
                    ? 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-700'
                    : variant === 'outline'
                        ? 'bg-transparent border border-neutral-300 dark:border-neutral-700'
                        : 'bg-black text-white hover:bg-neutral-800 border border-neutral-900'

    const sizeCls = size === 'sm' ? 'px-2 py-1 text-xs rounded-lg' : size === 'lg' ? 'px-5 py-3 text-base rounded-2xl' : 'px-3 py-2 text-sm rounded-xl'

    return (
        <button
            className={cn(
                'inline-flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none',
                variantCls,
                sizeCls,
                className
            )}
            {...props}
        >
            {children}
        </button>
    )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={cn('w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600', props.className)} />
}

function Label({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) {
    return <label htmlFor={htmlFor} className={cn('text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-300', className)}>{children}</label>
}

/**
 * MARKETFLOW ANALYTICS PAGE
 * Dashboard for visualizing concentration metrics (Phase 1).
 * Fetches from: https://botpilot--8080.ngrok.io/concentration-data?ticker=...&start_time=...&end_time=...&limit_raw=...
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
    coverage?: { buy?: number | null; sell?: number | null } | null
    regime_tag?: string | null
    regime_flags?: RegimeFlags | null
    reasons?: string[] | null
    meta?: Record<string, any> | null
    toasts?: string[] | null
}

type ConcentrationPayload = {
    ticker: string
    meta: {
        window: { start_time: string | number; end_time: string | number }
        generated_at_ms: number
        version: string
        source: string
    }
    concentration: {
        mm?: DomainConcentration
        accdis?: DomainConcentration | null
        all?: DomainConcentration | null
    }
}

// ---- Constants --------------------------------------------------------------

const API_BASE = 'https://botpilot--8000.ngrok.io/concentration-data'
const DEFAULT_LIMIT_RAW = 200
const TICKER_OPTIONS = ['SOL-USD', 'BTC-USD', 'ETH-USD']

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
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits })
}

function regimeBadgeClass(tag?: string | null) {
    const base = 'px-2 py-0.5 rounded-full text-xs font-medium'
    if (!tag) return `${base} bg-neutral-200 dark:bg-neutral-800`
    switch (tag.toLowerCase()) {
        case 'concentrated':
            return `${base} bg-amber-200 text-amber-900 dark:bg-amber-300/20 dark:text-amber-300`
        case 'fragmented':
            return `${base} bg-sky-200 text-sky-900 dark:bg-sky-300/20 dark:text-sky-300`
        case 'dominated':
            return `${base} bg-rose-200 text-rose-900 dark:bg-rose-300/20 dark:text-rose-300`
        default:
            return `${base} bg-neutral-200 dark:bg-neutral-800`
    }
}

function msFromLocal(datetimeLocal: string): number | null {
    if (!datetimeLocal) return null
    const d = new Date(datetimeLocal)
    const ms = d.getTime()
    return Number.isFinite(ms) ? ms : null
}

function buildTopSharesSeries(ts?: TopShares | null) {
    if (!ts) return [] as Array<{ k: string; share: number }>
    const entries = Object.entries(ts)
    entries.sort((a, b) => Number(a[0]) - Number(b[0]))
    return entries.map(([k, v]) => ({ k: `Top ${k}`, share: v }))
}

// ---- UI Subcomponents -------------------------------------------------------

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

function CoveragePie({ buy, sell }: { buy?: number | null; sell?: number | null }) {
    const options = useMemo(() => {
        return {
            chart: { type: 'pie', height: 260, spacing: [10, 10, 10, 10] },
            title: { text: undefined },
            tooltip: { pointFormat: '<b>{point.percentage:.0f}%</b>' },
            plotOptions: {
                pie: {
                    innerSize: '60%',
                    dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.0f}%' },
                },
            },
            series: [
                {
                    type: 'pie',
                    name: 'Coverage',
                    data: [
                        { name: 'Buy coverage', y: (buy ?? 0) * 100, color: PIE_COLORS[0] },
                        { name: 'Sell coverage', y: (sell ?? 0) * 100, color: PIE_COLORS[1] },
                    ],
                },
            ],
        } as Highcharts.Options
    }, [buy, sell])
    return <HighchartsReact highcharts={Highcharts} options={options} />
}

function TopSharesLine({ ts }: { ts?: TopShares | null }) {
    const seriesData = useMemo(() => {
        const entries = ts ? Object.entries(ts) : []
        entries.sort((a, b) => Number(a[0]) - Number(b[0]))
        return entries.map(([k, v]) => ({ name: `Top ${k}`, y: v * 100 }))
    }, [ts])
    const options = useMemo(() => {
        return {
            chart: { type: 'line', height: 260 },
            title: { text: undefined },
            xAxis: { categories: seriesData.map((p) => p.name) },
            yAxis: { title: { text: 'Share %' }, max: 100, min: 0 },
            tooltip: { valueSuffix: '%' },
            legend: { enabled: false },
            series: [
                { type: 'line', data: seriesData.map((p) => p.y), color: CHART_SERIES[0], marker: { enabled: true } },
            ],
        } as Highcharts.Options
    }, [seriesData])
    return <HighchartsReact highcharts={Highcharts} options={options} />
}

// ---- Page -------------------------------------------------------------------

export default function MarketflowAnalyticsPage() {
    const { setConfig } = useHeaderConfig()
    const { ticker: ctxTicker } = useTickerPeriod()

    // ensure header shows ticker, but period here is derived from manual time controls
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false })
    }, [setConfig])

    const [ticker, setTicker] = useState<string>(ctxTicker || 'SOL-USD')
    const [startLocal, setStartLocal] = useState<string>(() => new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16))
    const [endLocal, setEndLocal] = useState<string>(() => new Date().toISOString().slice(0, 16))
    const [limit, setLimit] = useState<number>(DEFAULT_LIMIT_RAW)

    const [data, setData] = useState<ConcentrationPayload | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const doFetch = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const startMs = msFromLocal(startLocal)
            const endMs = msFromLocal(endLocal)
            if (startMs === null || endMs === null) {
                throw new Error('Invalid date range.')
            }
            const qs = new URLSearchParams({
                ticker,
                start_time: String(startMs),
                end_time: String(endMs),
                limit: String(limit),
            })
            const url = `${API_BASE}?${qs.toString()}`
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

    // initial fetch
    useEffect(() => {
        doFetch()
    }, [])

    const mm = data?.concentration?.mm || null
    const buy = mm?.buy || null
    const sell = mm?.sell || null

    const hhi = mm?.buy?.hhi ?? null // prioritize buy side HHI for headline; adjust as you prefer
    const lci = mm?.lci ?? null
    const fci = mm?.fci ?? null
    const imb = mm?.imbalance_frac ?? null
    const coverageBuy = mm?.coverage?.buy ?? null
    const coverageSell = mm?.coverage?.sell ?? null

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
                    <div className="flex items-center gap-3">
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
                            Marketflow Analytics — Concentration (Phase 1)
                        </motion.div>
                        {mm?.regime_tag && (
                            <span className={regimeBadgeClass(mm.regime_tag)}>{mm.regime_tag}</span>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {generatedAt ? `Generated: ${new Date(generatedAt).toLocaleString()}` : ''}
                    </div>
                </div>

                <Card className="shadow-sm">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="ticker">Ticker</Label>
                                <select
                                    id="ticker"
                                    className="border border-neutral-300 dark:border-neutral-700 rounded-md bg-background p-2"
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
                                <Input id="start" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="end">End (local)</Label>
                                <Input id="end" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
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
                      <Loader2 className="h-4 w-4 animate-spin" /> Fetching
                    </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" /> Fetch
                    </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-3 text-sm text-rose-500 flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" /> {error}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* KPI Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile title="HHI (buy focus)" value={fmt(hhi, 3)} sub="Herfindahl–Hirschman Index" icon={<BarChart2 className="h-4 w-4" />} />
                <StatTile title="LCI" value={fmt(lci, 3)} sub="Liquidity Concentration Index" icon={<Gauge className="h-4 w-4" />} />
                <StatTile title="FCI" value={fmt(fci, 3)} sub="Flow Concentration Index" icon={<Gauge className="h-4 w-4" />} />
                <StatTile title="Imbalance" value={pct(imb, 0)} sub="Buy vs Sell participation" icon={<AlertTriangle className="h-4 w-4" />} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="shadow-sm lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PieIcon className="h-4 w-4" /> Coverage (k-used: {mm?.k_used ?? '—'})
                        </CardTitle>
                        <CardDescription>Share of volume covered by top-k participants</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CoveragePie buy={coverageBuy} sell={coverageSell} />
                        <div className="grid grid-cols-2 text-sm text-muted-foreground">
                            <div>Buy: {pct(coverageBuy, 0)}</div>
                            <div>Sell: {pct(coverageSell, 0)}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Top-k Cumulative Shares (Buy)</CardTitle>
                        <CardDescription>How quickly the top ranks accumulate share</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopSharesLine ts={buy?.top_shares || null} />
                    </CardContent>
                </Card>
            </div>

            {/* Buy/Sell Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Buy Side</CardTitle>
                        <CardDescription>Participants: {fmt(buy?.n_participants, 0)} • Volume: {fmt(buy?.volume_sum)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatTile title="HHI" value={fmt(buy?.hhi, 3)} />
                            <StatTile title="Top 1" value={pct(buy?.top_shares?.['1'], 0)} />
                            <StatTile title="Top 3" value={pct(buy?.top_shares?.['3'], 0)} />
                            <StatTile title="Top 5" value={pct(buy?.top_shares?.['5'], 0)} />
                            <StatTile title="Top 10" value={pct(buy?.top_shares?.['10'], 0)} />
                            <StatTile title="Top 20" value={pct(buy?.top_shares?.['20'], 0)} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Sell Side</CardTitle>
                        <CardDescription>Participants: {fmt(sell?.n_participants, 0)} • Volume: {fmt(sell?.volume_sum)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StatTile title="HHI" value={fmt(sell?.hhi, 3)} />
                            <StatTile title="Top 1" value={pct(sell?.top_shares?.['1'], 0)} />
                            <StatTile title="Top 3" value={pct(sell?.top_shares?.['3'], 0)} />
                            <StatTile title="Top 5" value={pct(sell?.top_shares?.['5'], 0)} />
                            <StatTile title="Top 10" value={pct(sell?.top_shares?.['10'], 0)} />
                            <StatTile title="Top 20" value={pct(sell?.top_shares?.['20'], 0)} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Regime & Reasons / Toasts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="shadow-sm lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Regime & Rationale</CardTitle>
                        <CardDescription>Flags and reasons for current tag</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                            {mm?.regime_flags && (
                                <>
                                    <span className={`px-2 py-0.5 rounded-full ${mm.regime_flags.is_fragmented ? 'bg-sky-200 text-sky-900 dark:bg-sky-300/20 dark:text-sky-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>fragmented</span>
                                    <span className={`px-2 py-0.5 rounded-full ${mm.regime_flags.is_concentrated ? 'bg-amber-200 text-amber-900 dark:bg-amber-300/20 dark:text-amber-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>concentrated</span>
                                    <span className={`px-2 py-0.5 rounded-full ${mm.regime_flags.is_dominated ? 'bg-rose-200 text-rose-900 dark:bg-rose-300/20 dark:text-rose-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>dominated</span>
                                    <span className={`px-2 py-0.5 rounded-full ${mm.regime_flags.trap_risk ? 'bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-300/20 dark:text-fuchsia-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>trap risk</span>
                                    <span className={`px-2 py-0.5 rounded-full ${mm.regime_flags.squeeze_risk ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-300/20 dark:text-emerald-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>squeeze risk</span>
                                </>
                            )}
                        </div>
                        <ul className="list-disc pl-6 text-sm space-y-1">
                            {(mm?.reasons || []).map((r, i) => (
                                <li key={i}>{r}</li>
                            ))}
                            {(!mm?.reasons || mm?.reasons.length === 0) && <li className="text-muted-foreground">No reasons provided.</li>}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Alerts / Toasts</CardTitle>
                        <CardDescription>Recent regime changes & signals</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {(mm?.toasts || []).length > 0 ? (
                            mm!.toasts!.map((t, i) => (
                                <div key={i} className="text-sm border rounded-md p-2 bg-muted/30">
                                    {t}
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground">None yet. (Appears once previous states are supplied.)</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Raw JSON Viewer */}
            <Card className="shadow-sm">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Raw JSON</CardTitle>
                        <CardDescription>Debug & manual copy</CardDescription>
                    </div>
                    <Button variant="secondary" size="sm" onClick={copyJSON} disabled={!data}>
                        <ClipboardCopy className="h-4 w-4 mr-1" /> Copy JSON
                    </Button>
                </CardHeader>
                <CardContent>
          <pre className="max-h-[400px] overflow-auto text-xs p-3 rounded-md bg-neutral-100 dark:bg-neutral-900">
            {data ? JSON.stringify(data, null, 2) : loading ? 'Loading…' : 'No data'}
          </pre>
                </CardContent>
            </Card>
        </div>
    )
}
