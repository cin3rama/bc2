'use client';

import React,
{
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    FormEvent,
    ChangeEvent,
} from 'react';

import { useHeaderConfig } from '@/contexts/HeaderConfigContext';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { useWebsocket } from '@/hooks/useWebsocket';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/Card';
import ToastShelf, { Toast } from '@/components/ToastShelf';
import LoadingIndicator from '@/components/LoadingIndicator';
import Tooltip from '@/components/Tooltip';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { API_BASE } from '@/lib/env';


const api_endpoint = `${API_BASE}/api/mfa`;
const LIMIT_TOPK = 20 as const;

type RegimeCode = 'N' | 'A' | 'MU' | 'D' | 'MD';

type OmegaAlignment = -1 | 0 | 1;

interface MfbFlows {
    omega_mm_net: number;
    rom_mm_net: number;
    omega_ad_net: number;
    rom_ad_net: number;
    omega_inventory_flow: number;
    rom_inventory_flow: number;
}

interface MfbHooks {
    omega_presence_rate: number | null;
    omega_cycle_participation_rate: number | null;
}

interface MfbRegime {
    regime_state: RegimeCode;
    fakeout_low: boolean;
    fakeout_high: boolean;
}

interface MfbNormalized {
    omega_inventory_flow_z: number;
    rom_inventory_flow_z: number;
    price_return_z: number;
    volume_z: number;
    fr_level: number;
    fr_delta: number;
    omega_vs_rom_alignment: OmegaAlignment;
}

interface MfbDominance {
    dominance_flag: boolean;
    dom_id: string | null;
    dom_mm_share: number;
    dom_ad_share: number;
    overlap_k: number;
}

interface MfbSection {
    version: string;
    flows: MfbFlows;
    hooks: MfbHooks;
    regime: MfbRegime;
    normalized: MfbNormalized;
    dominance: MfbDominance;
}

interface MfaWindowMeta {
    window: {
        start_time: number;
        end_time: number;
    };
    generated_at_ms: number;
    requested_period: string;
    [key: string]: any;
}

interface MfbWindow {
    id: string;
    ticker: string;
    period: string;
    meta: MfaWindowMeta;
    mfb: MfbSection;
    fullPayload?: any;
}

type WsStatus = 'closed' | 'open' | 'error';

// ---------- Helpers ----------

const regimeLabel = (code: RegimeCode): string => {
    switch (code) {
        case 'N':
            return 'Neutral';
        case 'A':
            return 'Accumulation';
        case 'MU':
            return 'Mark-Up';
        case 'D':
            return 'Distribution';
        case 'MD':
            return 'Mark-Down';
        default:
            return code;
    }
};

const regimeColorClass = (code: RegimeCode): string => {
    switch (code) {
        case 'N':
            return 'bg-slate-500';
        case 'A':
            return 'bg-emerald-700';
        case 'MU':
            return 'bg-emerald-500';
        case 'D':
            return 'bg-amber-600';
        case 'MD':
            return 'bg-red-600';
        default:
            return 'bg-slate-500';
    }
};

const wsStatusClasses = (status: WsStatus): string => {
    switch (status) {
        case 'open':
            return 'bg-emerald-600 text-white';
        case 'error':
            return 'bg-red-600 text-white';
        case 'closed':
        default:
            return 'bg-slate-600 text-white';
    }
};

const truncateAddress = (addr: string | null): string => {
    if (!addr) return '—';
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const formatNumber = (
    v: number | null | undefined,
    digits: number = 2,
): string => {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    const fixed = abs.toFixed(digits);
    const [intPart, decPart] = fixed.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== undefined
        ? `${sign}${withCommas}.${decPart}`
        : `${sign}${withCommas}`;
};

const formatPct = (
    v: number | null | undefined,
    digits: number = 1,
): string => {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    return `${formatNumber(v * 100, digits)}%`;
};

const buildWindowId = (ticker: string, ts: number): string =>
    `${ticker}-${ts}`;

// ---------- Component ----------

export default function MarketflowBehaviorPage() {
    const { setConfig: setHeaderConfig } = useHeaderConfig();
    const { ticker, period } = useTickerPeriod();

    const { marketflowAnalytics$, sendMessage } = useWebsocket();

    const [windows, setWindows] = useState<MfbWindow[]>([]);
    const [isSeedLoading, setIsSeedLoading] = useState(false);
    const [seedError, setSeedError] = useState<string | null>(null);

    const [liveEnabled, setLiveEnabled] = useState(true);
    const [wsStatus, setWsStatus] = useState<WsStatus>('closed');

    const [toasts, setToasts] = useState<Toast[]>([]);

    const [selectedWindowIds, setSelectedWindowIds] = useState<string[]>([]);

    // AI panel state
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiPastedMfaJson, setAiPastedMfaJson] = useState('');
    const [aiFiles, setAiFiles] = useState<File[]>([]);
    const [aiIsSubmitting, setAiIsSubmitting] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);

    const prevGroupRef = useRef<string | null>(null);

    // Ensure header shows controls
    useEffect(() => {
        setHeaderConfig({ showTicker: true, showPeriod: true });
    }, [setHeaderConfig]);

    // ---------- Toast helpers ----------

    const pushToast = useCallback((text: string, cls: string) => {
        setToasts(prev => {
            const t: Toast = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                text,
                cls,
                ts: Date.now(),
            };
            // Auto-dismiss after ~7s
            setTimeout(() => {
                setToasts(current =>
                    current.filter(existing => existing.id !== t.id),
                );
            }, 7000);
            return [...prev, t];
        });
    }, []);

    const handleDismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // ---------- Seed fetch (HTTP) ----------

    useEffect(() => {
        let cancelled = false;

        const fetchSeed = async () => {
            setIsSeedLoading(true);
            setSeedError(null);

            try {
                const url = `${api_endpoint}/?ticker=${encodeURIComponent(
                    ticker,
                )}&period=${encodeURIComponent(
                    period,
                )}&limit=${LIMIT_TOPK.toString()}`;

                const res = await fetch(url);
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(
                        `HTTP ${res.status}: ${text || 'Failed to fetch'}`,
                    );
                }
                const data = await res.json();

                const normalize = (raw: any): MfbWindow[] => {
                    const list: any[] = Array.isArray(raw)
                        ? raw
                        : Array.isArray(raw?.windows)
                            ? raw.windows
                            : [raw];

                    const mapped: MfbWindow[] = list
                        .filter(
                            (item: any) =>
                                item &&
                                item.mfb &&
                                item.meta?.window?.start_time != null &&
                                item.meta?.requested_period,
                        )
                        .map((full: any) => {
                            const meta: MfaWindowMeta = full.meta;
                            const start = Number(meta.window.start_time);
                            const id = buildWindowId(full.ticker, start);

                            return {
                                id,
                                ticker: full.ticker,
                                period: meta.requested_period,
                                meta,
                                mfb: full.mfb as MfbSection,
                                fullPayload: full,
                            };
                        });

                    return mapped.sort(
                        (a, b) =>
                            a.meta.window.start_time - b.meta.window.start_time,
                    );
                };

                const normalized = normalize(data);
                if (!cancelled) {
                    setWindows(normalized);
                    setSelectedWindowIds([]); // clear selection on seed
                }
            } catch (err: any) {
                if (!cancelled) {
                    setSeedError(
                        err?.message ||
                        'Failed to load seed Marketflow Behavioral data.',
                    );
                    setWindows([]);
                }
            } finally {
                if (!cancelled) {
                    setIsSeedLoading(false);
                }
            }
        };

        fetchSeed();

        return () => {
            cancelled = true;
        };
    }, [ticker, period]);

    // ---------- WebSocket subscription ----------

    const upsertWindowWithToasts = useCallback(
        (prev: MfbWindow[], nextWin: MfbWindow): MfbWindow[] => {
            const existingIndex = prev.findIndex(
                w => w.meta.window.start_time === nextWin.meta.window.start_time,
            );

            let next = [...prev];
            let prevLast: MfbWindow | undefined;

            if (existingIndex >= 0) {
                // Replace existing window; don't trigger regime toasts
                next[existingIndex] = nextWin;
            } else {
                // New window: we care about regime transitions
                prevLast = prev[prev.length - 1];
                next.push(nextWin);
                next.sort(
                    (a, b) =>
                        a.meta.window.start_time - b.meta.window.start_time,
                );
            }

            if (prevLast && nextWin) {
                const prevRegime = prevLast.mfb.regime;
                const nextRegime = nextWin.mfb.regime;

                // Regime transitions
                if (prevRegime.regime_state !== nextRegime.regime_state) {
                    const pair = `${prevRegime.regime_state}->${nextRegime.regime_state}`;
                    const isUp =
                        pair === 'N->A' || pair === 'A->MU' || pair === 'N->MU';
                    const isDown =
                        pair === 'N->D' ||
                        pair === 'D->MD' ||
                        pair === 'N->MD';
                    const fromLabel = regimeLabel(prevRegime.regime_state);
                    const toLabel = regimeLabel(nextRegime.regime_state);

                    if (isUp || isDown) {
                        const cls = isUp
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white';
                        pushToast(
                            `Regime shift: ${fromLabel} → ${toLabel} (${nextRegime.regime_state})`,
                            cls,
                        );
                    }
                }

                // Fakeout low
                if (
                    !prevRegime.fakeout_low &&
                    nextRegime.fakeout_low === true
                ) {
                    const label = regimeLabel(nextRegime.regime_state);
                    pushToast(
                        `Fakeout low detected in regime ${label}`,
                        'bg-amber-500 text-black',
                    );
                }

                // Fakeout high
                if (
                    !prevRegime.fakeout_high &&
                    nextRegime.fakeout_high === true
                ) {
                    const label = regimeLabel(nextRegime.regime_state);
                    pushToast(
                        `Fakeout high detected in regime ${label}`,
                        'bg-rose-500 text-white',
                    );
                }
            }

            return next;
        },
        [pushToast],
    );

    useEffect(() => {
        if (!marketflowAnalytics$) {
            setWsStatus('closed');
            return;
        }

        const group = `mfa_${ticker}`;

        // Handle unsubscribe of previous group
        if (prevGroupRef.current && prevGroupRef.current !== group) {
            sendMessage({ type: 'unsubscribe', group: prevGroupRef.current });
        }

        if (!liveEnabled) {
            prevGroupRef.current = group;
            setWsStatus('closed');
            return;
        }

        // Join current group
        sendMessage({ type: 'subscribe', group });
        prevGroupRef.current = group;
        setWsStatus('open');

        const sub = marketflowAnalytics$.subscribe({
            next: (msg: any) => {
                const full = msg.payload;
                if (!full) return;

                // Only enforce ticker here; period is handled upstream
                if (full.ticker !== ticker) {
                    return;
                }
                console.log('[MFB] ws object: ', full);

                const meta: MfaWindowMeta | undefined = full.meta;
                const mfb: MfbSection | undefined = full.mfb;

                if (
                    !meta ||
                    !mfb ||
                    meta.window?.start_time == null ||
                    meta.window?.end_time == null
                ) {
                    return;
                }

                const start = Number(meta.window.start_time);
                const id = buildWindowId(full.ticker, start);

                const win: MfbWindow = {
                    id,
                    ticker: full.ticker,
                    period: meta.requested_period,
                    meta,
                    mfb,
                    fullPayload: full,
                };

                setWindows(prev => upsertWindowWithToasts(prev, win));
            },
            error: () => {
                setWsStatus('error');
            },
            complete: () => {
                setWsStatus('closed');
            },
        });

        return () => {
            sub.unsubscribe();
            // Leave current group on unmount / dependency change
            if (prevGroupRef.current) {
                sendMessage({ type: 'unsubscribe', group: prevGroupRef.current });
            }
            setWsStatus('closed');
        };
    }, [
        marketflowAnalytics$,
        ticker,
        period,
        liveEnabled,
        upsertWindowWithToasts,
        sendMessage,
    ]);

    // ---------- Derived state ----------

    const latestWindow = windows[windows.length - 1] ?? null;

    const flowsChartOptions = useMemo(() => {
        const seriesOmega = windows.map(w => [
            w.meta.window.start_time,
            w.mfb.flows.omega_inventory_flow,
        ]);
        const seriesRom = windows.map(w => [
            w.meta.window.start_time,
            w.mfb.flows.rom_inventory_flow,
        ]);

        const options: Highcharts.Options = {
            chart: {
                type: 'line',
                height: 260,
            },
            title: {
                text: '',
            },
            xAxis: {
                type: 'datetime',
            },
            yAxis: {
                title: { text: 'Inventory Flow' },
                opposite: false,
            },
            legend: {
                enabled: true,
            },
            tooltip: {
                shared: true,
                xDateFormat: '%Y-%m-%d %H:%M:%S',
            },
            series: [
                {
                    type: 'line',
                    name: 'Ω inventory flow',
                    data: seriesOmega,
                },
                {
                    type: 'line',
                    name: 'ROM inventory flow',
                    data: seriesRom,
                },
            ],
            credits: {
                enabled: false,
            },
            accessibility: {
                enabled: false,
            },
        };

        return options;
    }, [windows]);

    const selectedWindows = useMemo(
        () => windows.filter(w => selectedWindowIds.includes(w.id)),
        [windows, selectedWindowIds],
    );

    const selectedSummary = useMemo(() => {
        if (!selectedWindows.length) return null;
        const starts = selectedWindows.map(w => w.meta.window.start_time);
        const ends = selectedWindows.map(w => w.meta.window.end_time);
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);
        const sequence = selectedWindows
            .map(w => w.mfb.regime.regime_state)
            .join(' → ');

        return {
            count: selectedWindows.length,
            minStart,
            maxEnd,
            sequence,
        };
    }, [selectedWindows]);

    // Fakeout pill summary (top bar) — based on selection if present, else latest window
    const fakeoutSummary = useMemo(() => {
        const focusWindows: MfbWindow[] =
            selectedWindows.length > 0
                ? selectedWindows
                : latestWindow
                    ? [latestWindow]
                    : [];

        if (!focusWindows.length) {
            return {
                label: 'No Fakeout',
                badgeClass: 'bg-slate-600 text-white',
                tooltip: 'No fakeouts detected yet in the current Ω regime view.',
                countLow: 0,
                countHigh: 0,
            };
        }

        let countLow = 0;
        let countHigh = 0;
        let latestFakeout: MfbWindow | null = null;

        for (const w of focusWindows) {
            const { fakeout_low, fakeout_high } = w.mfb.regime;
            if (fakeout_low) {
                countLow += 1;
                latestFakeout = w;
            }
            if (fakeout_high) {
                countHigh += 1;
                latestFakeout = w;
            }
        }

        if (!countLow && !countHigh) {
            const tooltipBase =
                selectedWindows.length > 0
                    ? 'No fakeout highs or lows in the selected windows.'
                    : 'No fakeout highs or lows in the latest window.';
            return {
                label: 'No Fakeout',
                badgeClass: 'bg-slate-600 text-white',
                tooltip: tooltipBase,
                countLow,
                countHigh,
            };
        }

        let label = '';
        let badgeClass = '';

        if (countLow && countHigh) {
            label = 'Fakeout High & Low';
            badgeClass = 'bg-fuchsia-600 text-white';
        } else if (countLow) {
            label = 'Fakeout Low';
            badgeClass = 'bg-sky-400 text-black';
        } else {
            label = 'Fakeout High';
            badgeClass = 'bg-amber-400 text-black';
        }

        let tooltip = `${label} detected. Lows: ${countLow}, highs: ${countHigh}.`;

        if (latestFakeout) {
            const { regime, normalized } = latestFakeout.mfb;
            const ts = new Date(
                latestFakeout.meta.window.end_time,
            ).toLocaleString();

            const fr = formatNumber(normalized.fr_level, 4);
            const frDelta = formatNumber(normalized.fr_delta, 4);
            const pz = formatNumber(normalized.price_return_z, 2);
            const vz = formatNumber(normalized.volume_z, 2);

            const full: any = latestFakeout.fullPayload ?? {};
            const vp = full?.struct?.value_profile;
            const valPrice = vp?.val_price;
            const vahPrice = vp?.vah_price;
            const troughPrice = vp?.trough_price;

            const parts: string[] = [
                `Last fakeout in ${regimeLabel(regime.regime_state)} regime`,
                `window ending ${ts}`,
                `FR ${fr} (Δ ${frDelta})`,
                `price_z ${pz}, vol_z ${vz}`,
            ];

            const vpBits: string[] = [];
            if (valPrice != null) vpBits.push(`VAL ${valPrice}`);
            if (vahPrice != null) vpBits.push(`VAH ${vahPrice}`);
            if (troughPrice != null) vpBits.push(`trough ${troughPrice}`);
            if (vpBits.length) {
                parts.push(vpBits.join(' · '));
            }

            tooltip = parts.join(' · ');
        }

        return {
            label,
            badgeClass,
            tooltip,
            countLow,
            countHigh,
        };
    }, [selectedWindows, latestWindow]);

    // ---------- Selection handlers (regime strip) ----------

    const toggleWindowSelection = (id: string) => {
        setSelectedWindowIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
        );
    };

    // ---------- AI Panel: file change & submit ----------

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const arr: File[] = [];
        for (let i = 0; i < files.length; i++) {
            arr.push(files[i]);
        }
        setAiFiles(arr);
    };

    const handleAiSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setAiIsSubmitting(true);
        setAiResponse(null);

        try {
            const formData = new FormData();
            formData.append('ticker', ticker);
            formData.append('period', period);
            formData.append('userPrompt', aiPrompt || '');

            const selectionPayload = selectedWindows.map(w => {
                const base = w.fullPayload ?? {
                    ticker: w.ticker,
                    meta: w.meta,
                    mfb: w.mfb,
                };
                return base;
            });

            formData.append(
                'selection',
                JSON.stringify(selectionPayload, null, 2),
            );

            if (aiPastedMfaJson.trim()) {
                formData.append('pastedMfaObj', aiPastedMfaJson.trim());
            }

            aiFiles.forEach(file => {
                formData.append('files', file);
            });

            const res = await fetch('/api/mfb-analyze', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const text = await res.text();
                setAiResponse(
                    `Error from AI endpoint: ${res.status} ${
                        text || '(no body)'
                    }`,
                );
            } else {
                // Try JSON first
                try {
                    const data = await res.json();
                    if (typeof data?.message === 'string') {
                        setAiResponse(data.message);
                    } else if (typeof data?.response === 'string') {
                        setAiResponse(data.response);
                    } else {
                        setAiResponse(JSON.stringify(data, null, 2));
                    }
                } catch {
                    const text = await res.text();
                    setAiResponse(text);
                }
            }
        } catch (err: any) {
            setAiResponse(
                `Request failed: ${err?.message || 'Unknown error'}`,
            );
        } finally {
            setAiIsSubmitting(false);
        }
    };

    // ---------- Dominance / Ω narrative ----------

    const dominanceNarrative = useMemo(() => {
        if (!latestWindow) return 'No data.';
        const {
            dominance_flag,
            dom_mm_share,
            dom_ad_share,
        } = latestWindow.mfb.dominance;
        const {
            omega_vs_rom_alignment,
            omega_inventory_flow_z,
            rom_inventory_flow_z,
        } = latestWindow.mfb.normalized;

        if (!dominance_flag) {
            return 'Fragmented / no clear dominance.';
        }

        if (omega_vs_rom_alignment === -1) {
            if (omega_inventory_flow_z > 0 && rom_inventory_flow_z < 0) {
                return 'Ω buying vs ROM selling.';
            }
            if (omega_inventory_flow_z < 0 && rom_inventory_flow_z > 0) {
                return 'Ω selling into ROM demand.';
            }
            return 'Ω inventory diverging from ROM.';
        }

        if (omega_vs_rom_alignment === 1) {
            return 'Ω and ROM flows aligned.';
        }

        if (
            Math.abs(omega_inventory_flow_z) < 0.5 &&
            Math.abs(rom_inventory_flow_z) < 0.5
        ) {
            return 'Ω and ROM neutral / low conviction flows.';
        }

        return 'Ω and ROM correlation unclear.';
    }, [latestWindow]);

    // ---------- Render ----------

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Toasts */}
            <ToastShelf toasts={toasts} onDismiss={handleDismissToast} />

            {/* Top header row */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-text dark:text-text-inverted">
                        Marketflow Behavioral — Ω Regime v1
                    </h1>
                    <p className="mt-1 text-sm text-text dark:text-text-inverted">
                        Ticker: <span className="font-mono">{ticker}</span> ·
                        Period:{' '}
                        <span className="font-mono">{period}</span> · Top-K:{' '}
                        <span className="font-mono">{LIMIT_TOPK}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Regime pill */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-text dark:text-text-inverted">
                            Regime
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white ${
                                latestWindow
                                    ? regimeColorClass(
                                        latestWindow.mfb.regime
                                            .regime_state,
                                    )
                                    : 'bg-slate-600'
                            }`}
                        >
                            {latestWindow
                                ? `${regimeLabel(
                                    latestWindow.mfb.regime.regime_state,
                                )} (${latestWindow.mfb.regime.regime_state})`
                                : '—'}
                        </span>
                    </div>

                    {/* Fakeout / Liquidity Trap pill */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-text dark:text-text-inverted">
                            Fakeout
                        </span>
                        <Tooltip content={fakeoutSummary.tooltip}>
                            <span
                                className={`inline-flex cursor-help items-center rounded-full px-3 py-1 text-xs font-semibold ${fakeoutSummary.badgeClass}`}
                            >
                                {fakeoutSummary.label}
                            </span>
                        </Tooltip>
                    </div>

                    {/* Live status */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-text dark:text-text-inverted">
                            Live
                        </span>
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${wsStatusClasses(
                                wsStatus,
                            )}`}
                        >
                            {liveEnabled ? wsStatus : 'paused'}
                        </span>
                        <label className="flex items-center gap-1 text-xs text-text dark:text-text-inverted">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-emerald-500"
                                checked={liveEnabled}
                                onChange={e =>
                                    setLiveEnabled(e.target.checked)
                                }
                            />
                            Live updates
                        </label>
                    </div>

                    {/* Generated time */}
                    <div className="text-xs text-text dark:text-text-inverted">
                        Generated:{' '}
                        {latestWindow ? (
                            <span className="font-mono">
                                {new Date(
                                    latestWindow.meta.generated_at_ms,
                                ).toLocaleString()}
                            </span>
                        ) : (
                            '—'
                        )}
                    </div>
                </div>
            </div>

            {/* Error / loading */}
            {seedError && (
                <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {seedError}
                </div>
            )}

            {isSeedLoading && !windows.length && (
                <LoadingIndicator message="Loading Ω regime seed data…" />
            )}

            {/* Main layout */}
            {windows.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left: flows + regime strip */}
                    <div className="space-y-4 lg:col-span-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-2">
                                <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                                    Ω vs ROM Inventory Flows
                                </CardTitle>
                                <span className="text-xs text-text dark:text-text-inverted">
                                    Each point = one {period} window
                                </span>
                            </CardHeader>
                            <CardContent>
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={flowsChartOptions}
                                />
                            </CardContent>
                        </Card>

                        {/* Regime strip */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-2">
                                <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                                    Regime Strip
                                </CardTitle>
                                <Tooltip content="Click segments to select windows for AI analysis.">
                                    <span className="cursor-help text-xs text-text dark:text-text-inverted">
                                        Click to select windows
                                    </span>
                                </Tooltip>
                            </CardHeader>
                            <CardContent>
                                <div className="flex h-16 w-full overflow-hidden rounded-lg border border-surface/40 bg-surface/60 dark:border-surface/60 dark:bg-surface/80">
                                    {windows.map(win => {
                                        const regime = win.mfb.regime;
                                        const isSelected =
                                            selectedWindowIds.includes(
                                                win.id,
                                            );
                                        return (
                                            <button
                                                key={win.id}
                                                type="button"
                                                className={`relative flex-1 border-r border-black/10 last:border-r-0 ${
                                                    regimeColorClass(
                                                        regime.regime_state,
                                                    )
                                                } ${
                                                    isSelected
                                                        ? 'ring-2 ring-offset-2 ring-offset-surface/80 ring-amber-300'
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    toggleWindowSelection(
                                                        win.id,
                                                    )
                                                }
                                            >
                                                {/* Center regime code */}
                                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/80">
                                                    {regime.regime_state}
                                                </span>

                                                {/* Fakeout markers */}
                                                {regime.fakeout_high && (
                                                    <div className="pointer-events-none absolute inset-x-0 top-[2px] flex items-center justify-center text-[10px] text-white/90">
                                                        ▲
                                                    </div>
                                                )}
                                                {regime.fakeout_low && (
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-[2px] flex items-center justify-center text-[10px] text-white/90">
                                                        ▼
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-text dark:text-text-inverted">
                                    Each segment corresponds to a{' '}
                                    <span className="font-mono">
                                        {period}
                                    </span>{' '}
                                    window in time-order. Arrows mark fakeout
                                    highs/lows.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Ω cards */}
                    <div className="space-y-4 lg:col-span-1">
                        {/* Omega / Dominance */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                                    Ω Dominance & Regime
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-text dark:text-text-inverted">
                                {latestWindow ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Regime
                                            </span>
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${regimeColorClass(
                                                    latestWindow.mfb.regime
                                                        .regime_state,
                                                )}`}
                                            >
                                                {regimeLabel(
                                                    latestWindow.mfb.regime
                                                        .regime_state,
                                                )}{' '}
                                                (
                                                {
                                                    latestWindow.mfb.regime
                                                        .regime_state
                                                }
                                                )
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Dominant Ω
                                            </span>
                                            <span className="font-mono">
                                                {latestWindow.mfb.dominance
                                                    .dominance_flag
                                                    ? 'ON'
                                                    : 'OFF'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Ω address
                                            </span>
                                            <span className="font-mono">
                                                {truncateAddress(
                                                    latestWindow.mfb.dominance
                                                        .dom_id,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                MM share
                                            </span>
                                            <span className="font-mono">
                                                {formatPct(
                                                    latestWindow.mfb.dominance
                                                        .dom_mm_share,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                AD share
                                            </span>
                                            <span className="font-mono">
                                                {formatPct(
                                                    latestWindow.mfb.dominance
                                                        .dom_ad_share,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Overlap k
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.dominance
                                                        .overlap_k,
                                                    3,
                                                )}
                                            </span>
                                        </div>
                                        <hr className="my-2 border-surface/50" />
                                        <p className="text-xs leading-snug text-text dark:text-text-inverted">
                                            {dominanceNarrative}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-text dark:text-text-inverted">
                                        No Ω regime data available yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Flows snapshot */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                                    Flows Snapshot
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm text-text dark:text-text-inverted">
                                {latestWindow ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Ω MM net
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .omega_mm_net,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                ROM MM net
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .rom_mm_net,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Ω AD net
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .omega_ad_net,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                ROM AD net
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .rom_ad_net,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Ω inventory flow
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .omega_inventory_flow,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                ROM inventory flow
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.flows
                                                        .rom_inventory_flow,
                                                )}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-text dark:text-text-inverted">
                                        No flow data available yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Normalized / FR context */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                                    Normalized Context & FR
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm text-text dark:text-text-inverted">
                                {latestWindow ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Ω inv. flow z
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .omega_inventory_flow_z,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                ROM inv. flow z
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .rom_inventory_flow_z,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Price return z
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .price_return_z,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-text dark:text-text-inverted">
                                                Volume z
                                            </span>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .volume_z,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Tooltip content="Funding rate level (normalized)">
                                                <span className="cursor-help text-text dark:text-text-inverted">
                                                    FR level
                                                </span>
                                            </Tooltip>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .fr_level,
                                                    4,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Tooltip content="Change in funding rate over the window (normalized)">
                                                <span className="cursor-help text-text dark:text-text-inverted">
                                                    FR delta
                                                </span>
                                            </Tooltip>
                                            <span className="font-mono">
                                                {formatNumber(
                                                    latestWindow.mfb.normalized
                                                        .fr_delta,
                                                    4,
                                                )}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-text dark:text-text-inverted">
                                        No normalized context available yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* AI ANALYSIS PANEL */}
            <section className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-text dark:text-text-inverted">
                            AI Behavioral Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-text dark:text-text-inverted">
                        {/* Selection summary */}
                        {selectedSummary ? (
                            <div className="rounded-md border border-surface/60 bg-surface/60 px-3 py-2 text-xs text-text dark:border-surface/70 dark:bg-surface/80 dark:text-text-inverted">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <span className="font-semibold">
                                            Selection:
                                        </span>{' '}
                                        {selectedSummary.count} window
                                        {selectedSummary.count === 1
                                            ? ''
                                            : 's'}
                                    </div>
                                    <div className="font-mono">
                                        {new Date(
                                            selectedSummary.minStart,
                                        ).toLocaleString()}{' '}
                                        →{' '}
                                        {new Date(
                                            selectedSummary.maxEnd,
                                        ).toLocaleString()}
                                    </div>
                                </div>
                                <div className="mt-1 font-mono text-[11px]">
                                    Regimes: {selectedSummary.sequence}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-surface/60 bg-surface/40 px-3 py-2 text-xs text-text dark:border-surface/60 dark:bg-surface/70 dark:text-text-inverted">
                                No windows selected. Click on the regime strip
                                above to select one or more windows for AI
                                analysis.
                            </div>
                        )}

                        {/* Form */}
                        <form className="space-y-4" onSubmit={handleAiSubmit}>
                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-text dark:text-text-inverted">
                                    Prompt
                                </label>
                                <textarea
                                    className="min-h-[80px] w-full rounded-md border border-surface/60 bg-surface/80 p-2 text-sm text-text dark:border-surface/70 dark:bg-surface dark:text-text-inverted"
                                    placeholder="Describe what Ω is doing over the selected windows and how it relates to MM/AD flows, funding, and regime transitions..."
                                    value={aiPrompt}
                                    onChange={e =>
                                        setAiPrompt(e.target.value)
                                    }
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-text dark:text-text-inverted">
                                    Chart images (optional)
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/png,image/jpeg,image/gif"
                                    onChange={handleFileChange}
                                    className="block w-full text-xs text-text dark:text-text-inverted file:mr-3 file:rounded-md file:border-0 file:bg-primary/80 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-primary"
                                />
                                {aiFiles.length > 0 && (
                                    <p className="mt-1 text-[11px] text-text dark:text-text-inverted">
                                        {aiFiles.length} file
                                        {aiFiles.length === 1 ? '' : 's'} ready
                                        to send.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-medium text-text dark:text-text-inverted">
                                    Paste full mfa_obj JSON (optional)
                                </label>
                                <textarea
                                    className="min-h-[80px] w-full rounded-md border border-surface/60 bg-surface/80 p-2 font-mono text-xs text-text dark:border-surface/70 dark:bg-surface dark:text-text-inverted"
                                    placeholder="Paste a full mfa_obj JSON here if you want the AI to see the raw payload beyond MFB."
                                    value={aiPastedMfaJson}
                                    onChange={e =>
                                        setAiPastedMfaJson(e.target.value)
                                    }
                                />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button
                                    type="submit"
                                    disabled={aiIsSubmitting}
                                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {aiIsSubmitting
                                        ? 'Analyzing…'
                                        : 'Analyze Selection'}
                                </button>
                                <div className="text-[11px] text-text dark:text-text-inverted">
                                    POST /api/mfb-analyze · backend will call
                                    OpenAI with MFA/MFB payloads.
                                </div>
                            </div>
                        </form>

                        {/* AI response */}
                        {aiResponse && (
                            <div className="mt-2 max-h-64 overflow-auto rounded-md border border-surface/60 bg-surface/80 p-2 text-xs text-text dark:border-surface/70 dark:bg-surface dark:text-text-inverted">
                                <pre className="whitespace-pre-wrap">
                                    {aiResponse}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
