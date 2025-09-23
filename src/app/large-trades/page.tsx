'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subject, Subscription, timer } from 'rxjs';
import { retry, retryWhen, delayWhen, tap, takeUntil, shareReplay } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';

type PeriodKey = '5min' | '15min' | '1h' | '4h';
type LargeTradeMsg = Record<string, any>;
const VALID_PERIODS: PeriodKey[] = ['5min', '15min', '1h', '4h'];

const coercePeriod = (p: string): PeriodKey =>
    (VALID_PERIODS as readonly string[]).includes(p) ? (p as PeriodKey) : '15min';

const buildQuery = (params: Record<string, string | number | undefined | null>) => {
    const pairs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
};

export default function LargeTradesPage() {
    const { ticker, period } = useTickerPeriod();
    const { setConfig } = useHeaderConfig();

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Epoch-ms defaults (from your test)
    const [startMs, setStartMs] = useState<number>(1757606400000);
    const [endMs, setEndMs] = useState<number>(1758038400000);
    const [localPeriod, setLocalPeriod] = useState<PeriodKey>(() => coercePeriod(period));

    const wsUrl = useMemo(() => {
        const qs = buildQuery({
            ticker: ticker,
            period: localPeriod,
            start_ts: startMs,  // epoch ms
            end_ts: endMs,      // epoch ms
        });
        return `https://botpilot--8080.ngrok.io/large-trades/${qs}`; // change to /large-trades/ if needed
    }, [ticker, localPeriod, startMs, endMs]);

    // --- FIX: initialize refs/states with null
    const socketRef = useRef<WebSocketSubject<any> | null>(null);
    const subRef = useRef<Subscription | null>(null);
    const [stream$, setStream$] = useState<Observable<any> | null>(null);
    const destroy$ = useRef(new Subject<void>()).current;

    const [connected, setConnected] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [lastEvent, setLastEvent] = useState<LargeTradeMsg | null>(null);
    const [log, setLog] = useState<LargeTradeMsg[]>([]);

    // (Re)open socket when wsUrl changes
    useEffect(() => {
        subRef.current?.unsubscribe();
        socketRef.current?.complete?.();
        setErrorMsg(null);
        setConnected(false);

        const subject = webSocket({
            url: wsUrl,
            openObserver: { next: () => setConnected(true) },
            closeObserver: { next: () => setConnected(false) },
        });

        socketRef.current = subject;

        const shared$ = subject.pipe(
            retry({ delay: () => timer(4000) }),
            retryWhen(errors =>
                errors.pipe(
                    tap(err => console.log('[LargeTrades] error, reconnecting:', err)),
                    delayWhen(() => timer(10))
                )
            ),
            takeUntil(destroy$),
            shareReplay({ bufferSize: 1, refCount: true })
        );

        setStream$(shared$);

        return () => {
            subRef.current?.unsubscribe();
            subject.complete();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wsUrl]);

    // Subscribe to stream
    useEffect(() => {
        if (!stream$) return;
        subRef.current?.unsubscribe();

        const sub = stream$.subscribe({
            next: (msg) => {
                setLastEvent(msg);
                setLog(prev => [msg, ...prev].slice(0, 50));
            },
            error: (err) => setErrorMsg(String(err?.message ?? err)),
            complete: () => setConnected(false),
        });

        subRef.current = sub;
        return () => sub.unsubscribe();
    }, [stream$]);

    const requestNow = () => {
        socketRef.current?.next?.({ type: 'get_large_trades', sym: ticker, user: '8888' });
    };

    // Force a new URL (and socket) by tweaking endMs
    const reconnectNow = () => setEndMs(ms => ms + 1);

    const tsOf = (item: any) =>
        (item?.created_at as number) ?? (item?.timestamp as number) ?? Date.now();

    return (
        <main className="max-w-6xl mx-auto py-4 space-y-4">
            <section className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Large Trades — Stream Debug</h1>
                <div className="flex items-center gap-2">
          <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
                  connected ? 'bg-green-600 text-white' : 'bg-gray-400 text-gray-900'
              }`}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </span>
                    <button
                        onClick={requestNow}
                        className="rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Request Data
                    </button>
                    <button
                        onClick={() => setLog([])}
                        className="rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Clear Log
                    </button>
                </div>
            </section>

            <section className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-2">Query Params</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                        <label className="block mb-1">Ticker</label>
                        <input
                            value={ticker}
                            readOnly
                            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Period</label>
                        <select
                            value={localPeriod}
                            onChange={(e) => setLocalPeriod(coercePeriod(e.target.value))}
                            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                        >
                            {VALID_PERIODS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-xs break-all">
                        <span className="font-medium">Socket URL</span>
                        <div className="mt-1 rounded bg-gray-50 dark:bg-gray-800 p-2">
                            {wsUrl}
                        </div>
                    </div>
                </div>

                {/* Epoch-ms fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                        <label className="block mb-1">start_ts (epoch ms)</label>
                        <input
                            type="number"
                            value={startMs}
                            onChange={(e) => setStartMs(Number(e.target.value))}
                            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">end_ts (epoch ms)</label>
                        <input
                            type="number"
                            value={endMs}
                            onChange={(e) => setEndMs(Number(e.target.value))}
                            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
                        />
                    </div>
                </div>

                <div className="mt-3">
                    <button
                        onClick={reconnectNow}
                        className="rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Apply & Reconnect
                    </button>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                    <h2 className="text-lg font-semibold mb-2">Latest payload</h2>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        <div>Ticker: <strong>{ticker}</strong></div>
                        <div>Period: <strong>{localPeriod}</strong></div>
                        <div>Last update: <strong>{lastEvent ? new Date(tsOf(lastEvent)).toLocaleString() : '—'}</strong></div>
                    </div>
                    <pre className="text-xs overflow-auto max-h-[50vh] p-2 rounded bg-gray-50 dark:bg-gray-800">
{JSON.stringify(lastEvent, null, 2)}
          </pre>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                    <h2 className="text-lg font-semibold mb-2">Recent messages (max 50)</h2>
                    {errorMsg && (
                        <div className="mb-2 rounded bg-red-600 text-white px-2 py-1 text-sm">
                            {errorMsg}
                        </div>
                    )}
                    <div className="space-y-3 overflow-auto max-h-[50vh] pr-1">
                        {log.length === 0 ? (
                            <div className="text-sm text-gray-500">No messages yet…</div>
                        ) : (
                            log.map((item, idx) => (
                                <details key={idx} className="rounded border border-gray-200 dark:border-gray-700">
                                    <summary className="cursor-pointer px-2 py-1 text-sm">
                                        #{log.length - idx} —{' '}
                                        <span className="text-gray-500">
                      {new Date(tsOf(item)).toLocaleString()}
                    </span>
                                    </summary>
                                    <pre className="text-xs overflow-auto p-2 bg-gray-50 dark:bg-gray-800">
{JSON.stringify(item, null, 2)}
                  </pre>
                                </details>
                            ))
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
