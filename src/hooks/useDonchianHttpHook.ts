'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Period = '5min' | '15min' | '30min' | '1h' | '4h' | '1d';

type PointTuple = [number, number] | [number, number, number, number, number];

export type RawSeries = {
    id: string;
    name?: string;
    type: 'line' | 'candlestick';
    data: PointTuple[];
    yAxis?: number;
    linkedTo?: string;
    dashStyle?: string;
    step?: 'left' | 'center' | 'right';
    tooltip?: { valueDecimals?: number };
};

const API_BASE =
    process.env.NEXT_PUBLIC_DONCHIAN_API?.replace(/\/+$/, '') ||
    'https://botpilot--9000.ngrok.io';

/** Normalize common API shapes to the final array of series */
function normalizePayload(json: unknown): RawSeries[] {
    if (Array.isArray(json)) return json as RawSeries[];
    if (json && typeof json === 'object') {
        const o = json as Record<string, unknown>;
        if (Array.isArray(o.series)) return o.series as RawSeries[];
        if (Array.isArray(o.data)) return o.data as RawSeries[];
        if (Array.isArray(o.results)) return o.results as RawSeries[];
    }
    throw new Error('Unexpected payload shape (expected an array of series).');
}

/** Basic point scrubbing: ensures numbers/null in tuples */
function sanitizeSeries(input: RawSeries[]): RawSeries[] {
    return input.map((s) => {
        const cleaned = Array.isArray(s.data)
            ? s.data
                .filter((p) => Array.isArray(p) && typeof p[0] === 'number')
                .map((p) => {
                    // leave nulls as-is; Highcharts treats null as a gap
                    return p as PointTuple;
                })
            : [];

        return {
            ...s,
            data: cleaned,
        };
    });
}

export function useDonchianHttpHook(ticker: string, period: Period) {
    const [data, setData] = useState<RawSeries[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const runIdRef = useRef(0);

    const url = useMemo(() => {
        const u = new URL(`${API_BASE}/donchian`);
        if (ticker) u.searchParams.set('ticker', ticker);
        if (period) u.searchParams.set('period', period);
        return u.toString();
    }, [ticker, period]);

    useEffect(() => {
        if (!ticker || !period) return;

        // cancel any in-flight
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const myRun = ++runIdRef.current;
        let cancelled = false;

        async function fetchOnce(retry = false): Promise<Response> {
            const r = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
                cache: 'no-store',
            });
            if (!r.ok && !retry && (r.status === 429 || r.status === 503)) {
                // simple backoff retry
                await new Promise((res) => setTimeout(res, 600));
                return fetchOnce(true);
            }
            return r;
        }

        (async () => {
            setIsLoading(true);
            setError(null);
            setData(null);

            try {
                const r = await fetchOnce(false);
                if (!r.ok) {
                    const msg = await r.text().catch(() => '');
                    throw new Error(`HTTP ${r.status}${msg ? ` — ${msg}` : ''}`);
                }
                const json = (await r.json()) as unknown;
                const series = sanitizeSeries(normalizePayload(json));

                if (!cancelled && myRun === runIdRef.current) {
                    setData(series);
                }
            } catch (e) {
                if (!cancelled && myRun === runIdRef.current) {
                    setError(e as Error);
                }
            } finally {
                if (!cancelled && myRun === runIdRef.current) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [url, ticker, period]);

    return { data, isLoading, error };
}
