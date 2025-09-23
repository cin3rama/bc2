'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';

const ENDPOINT = 'https://botpilot--8080.ngrok.io/large-trades-backtest/';
// If your backend requires a trailing slash, switch to:
// const ENDPOINT = 'https://botpilot--8080.ngrok.io/large-trades-backtest/';

export default function LargeTradesBacktestPage() {
    const { setConfig } = useHeaderConfig();

    // Show ticker, hide global period dropdown for this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Default POST body converted from your curl
    const [bodyText, setBodyText] = useState<string>(() =>
        JSON.stringify(
            {
                ticker: 'SOL-USD',
                period: '15min',
                start: 1757476800000,
                end:   1757736000000,
                side: 'BUY',
                n_prev: 10,
                pct: 0.03,
                require_full_10: true,
                limit: 5000,
            },
            null,
            2
        )
    );

    const fetchNow = async () => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError(null);
        try {
            let parsed: any = {};
            try {
                parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
            } catch (e: any) {
                throw new Error(`Invalid JSON body: ${e?.message ?? e}`);
            }

            const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
                cache: 'no-store',
                signal: ctrl.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

            const json = await res.json();
            setData(json);
            setFetchedAt(new Date());
        } catch (e: any) {
            if (e?.name !== 'AbortError') setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNow();
        return () => abortRef.current?.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className="max-w-6xl mx-auto py-4 space-y-4">
            <section className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Large Trades — Backtest</h1>
                <div className="flex items-center gap-2">
          <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
                  loading ? 'bg-gray-400 text-gray-900' : 'bg-green-600 text-white'
              }`}
              title={loading ? 'Fetching…' : 'Idle'}
          >
            {loading ? 'Fetching…' : 'Ready'}
          </span>
                    <button
                        onClick={fetchNow}
                        disabled={loading}
                        className="rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                        Refetch (POST)
                    </button>
                    <button
                        onClick={() => setData(null)}
                        className="rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        Clear
                    </button>
                </div>
            </section>

            <section className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-2">Endpoint</h2>
                <div className="text-xs break-all rounded bg-gray-50 dark:bg-gray-800 p-2">
                    {ENDPOINT}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    Last fetched: <strong>{fetchedAt ? fetchedAt.toLocaleString() : '—'}</strong>
                </div>
            </section>

            {/* Request body (JSON) */}
            <section className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-2">Request Body (JSON)</h2>
                <textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    spellCheck={false}
                    className="w-full h-40 text-xs rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 font-mono"
                />
            </section>

            {/* Raw JSON response */}
            <section className="rounded-lg border border-gray-300 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-2">Raw JSON Response</h2>
                {error && (
                    <div className="mb-2 rounded bg-red-600 text-white px-2 py-1 text-sm">
                        {error}
                    </div>
                )}
                <pre className="text-xs overflow-auto max-h-[65vh] p-2 rounded bg-gray-50 dark:bg-gray-800">
{JSON.stringify(data, null, 2)}
        </pre>
            </section>
        </main>
    );
}
