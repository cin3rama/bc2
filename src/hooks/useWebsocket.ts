// hooks/useWebsocket.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, EMPTY, timer, Subject, shareReplay, filter } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';

// Define the type for our hook's return value.
interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    marketflow$: Observable<any>;
    marketflowAnalytics$: Observable<any>;
    mfbParticipant$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(aoiId?: number): WebsocketStreams {
    // ⬅️ Now consuming both ticker and period from the global context
    const { ticker, period } = useTickerPeriod();

    // Streams exposed to consumers
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    const [marketflowAnalytics$, setMarketflowAnalytics$] =
        useState<Observable<any>>(EMPTY);
    const [mfbParticipant$, setmfbParticipant$] = useState<Observable<any>>(EMPTY);

    // WebSocketSubject refs (persist across renders)
    // @ts-ignore
    const orderflowSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const trendSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const marketflowSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const marketflowAnalyticsSocketRef = useRef<WebSocketSubject<any>>();
    //@ts-ignore
    const mfbParticipantSocketRef = useRef<WebSocketSubject<any>>();

    // Factory for WebSocketSubjects with observers
    const getWS = (url: string): WebSocketSubject<any> =>
        webSocket({
            url: `https://botpilot--8080.ngrok.io${url}`,
            openObserver: {
                next: event => {
                    console.log(`[Websocket] Connection open on ${url}`, event);
                },
            },
            closeObserver: {
                next: event => {
                    console.log(`[WebSocket] Connection closed on ${url}`, event);
                },
            },
        });

    useEffect(() => {
        // Per-effect stop notifier
        const stop$ = new Subject<void>();

        // Simple reconnect wrapper
        const reconnect = <T,>(obs: Observable<T>): Observable<T> =>
            obs.pipe(
                retry({ delay: () => timer(4000) }),
                takeUntil(stop$),
            );

        // --- FORCE CLOSE sockets bound to the previous ticker/period/AOI ---
        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowAnalyticsSocketRef.current?.complete();
        mfbParticipantSocketRef.current?.complete();

        // Clear refs so we always create fresh connections for this ticker/period/AOI
        // @ts-ignore
        orderflowSocketRef.current = undefined;
        // @ts-ignore
        trendSocketRef.current = undefined;
        // @ts-ignore
        marketflowSocketRef.current = undefined;
        // @ts-ignore
        marketflowAnalyticsSocketRef.current = undefined;
        // @ts-ignore
        mfbParticipantSocketRef.current = undefined;

        // --- Create fresh sockets for the new ticker/period combo ---
        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`);

        // ⬅️ MFA socket now uses the selected period from context
        marketflowAnalyticsSocketRef.current = getWS( `/ws/mfa/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&limit=20`);

        // ⬅️ MFB_P socket now uses the selected period AND optional AOI from context/call site
        const aoiQuery = typeof aoiId === 'number' ? `&aoi_id=${encodeURIComponent(String(aoiId))}` : '';

        mfbParticipantSocketRef.current = getWS(`/ws/mfb-p/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}${aoiQuery}`);

        // --- Wrap with reconnect + shareReplay (with reset flags) ---
        const replayCfg = {
            bufferSize: 1,
            refCount: true,
            // ensure cache is dropped when all subscribers leave / on complete/error
            resetOnRefCountZero: true,
            resetOnComplete: true,
            resetOnError: true,
        } as const;

        setOrderflow$(
            reconnect(orderflowSocketRef.current!).pipe(shareReplay(replayCfg)),
        );

        setTrend$(
            reconnect(trendSocketRef.current!).pipe(shareReplay(replayCfg)),
        );

        setMarketflow$(
            reconnect(marketflowSocketRef.current!).pipe(
                // filter((msg: any) => msg?.ticker === ticker),
                shareReplay(replayCfg),
            ),
        );

        setMarketflowAnalytics$(
            reconnect(marketflowAnalyticsSocketRef.current!).pipe(
                // belt-and-suspenders: drop any stray first emission from previous ticker
                // filter((msg: any) => msg?.ticker === ticker),
                shareReplay(replayCfg),
            ),
        );

        setmfbParticipant$(
            reconnect(mfbParticipantSocketRef.current!).pipe(
                // belt-and-suspenders: drop any stray first emission from previous ticker
                // filter((msg: any) => msg?.ticker === ticker),
                shareReplay(replayCfg),
            ),
        );

        // Cleanup: cancel pipelines and close sockets created by this effect
        return () => {
            stop$.next();
            stop$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            marketflowSocketRef.current?.complete();
            marketflowAnalyticsSocketRef.current?.complete();
            mfbParticipantSocketRef.current?.complete();
        };
        // ⬅️ This is the key: reconnect on ticker OR period OR AOI change
    }, [ticker, period, aoiId]);

    // Send to all open sockets (no new sockets created here)
    const sendMessage = useCallback(
        (msg: any) => {
            orderflowSocketRef.current &&
            !orderflowSocketRef.current.closed &&
            orderflowSocketRef.current.next(msg);

            trendSocketRef.current &&
            !trendSocketRef.current.closed &&
            trendSocketRef.current.next(msg);

            // Use the SAME sockets that feed the observables
            marketflowSocketRef.current &&
            !marketflowSocketRef.current.closed &&
            marketflowSocketRef.current.next(msg);

            marketflowAnalyticsSocketRef.current &&
            !marketflowAnalyticsSocketRef.current.closed &&
            marketflowAnalyticsSocketRef.current.next(msg);

            mfbParticipantSocketRef.current &&
            !mfbParticipantSocketRef.current.closed &&
            mfbParticipantSocketRef.current.next(msg);
        },
        [ticker, period], // aoiId not needed here, messages are logical-level
    );

    // Manual shutdown (explicit global close)
    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowAnalyticsSocketRef.current?.complete();
        mfbParticipantSocketRef.current?.complete();
    };

    return {
        orderflow$,
        trend$,
        marketflow$,
        marketflowAnalytics$,
        mfbParticipant$,
        sendMessage,
        close,
    };
}
