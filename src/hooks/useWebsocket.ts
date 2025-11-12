import { useState, useEffect, useRef } from 'react';
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
    // vwap$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(): WebsocketStreams {
    const { ticker } = useTickerPeriod();

    // Streams exposed to consumers
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    const [marketflowAnalytics$, setMarketflowAnalytics$] = useState<Observable<any>>(EMPTY);
    // const [vwap$, setVwap$] = useState<Observable<any>>(EMPTY);

    // WebSocketSubject refs (persist across renders)
    const orderflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const trendSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowAnalyticsSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const vwapSocketRef = useRef<WebSocketSubject<any>>();

    // Initial message for orderflow
    const retrieve = { type: 'get_data', ticker: 'SOL-USD', user: '8888' };

    // Factory for WebSocketSubjects with observers
    const getWS = (url: string): WebSocketSubject<any> =>
        webSocket({
            url: `https://botpilot--8080.ngrok.io${url}`,
            openObserver: {
                next: () => {
                    if (url === '/orderflow/') {
                        orderflowSocketRef.current?.next(retrieve);
                    }
                },
            },
            closeObserver: {
                next: (event) => {
                    console.log(`[WebSocket] Connection closed on ${url}`, event);
                },
            },
        });

    useEffect(() => {
        // Per-effect stop notifier
        const stop$ = new Subject<void>();

        // Simple reconnect wrapper
        const reconnect = <T>(obs: Observable<T>): Observable<T> =>
            obs.pipe(
                retry({ delay: () => timer(4000) }),
                takeUntil(stop$)
            );

        // --- FORCE CLOSE sockets bound to the previous ticker (including marketflow) ---
        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();            // ← important
        marketflowAnalyticsSocketRef.current?.complete();   // ← you already had this

        // Clear refs so "ensure" logic can't reuse old connections
        orderflowSocketRef.current = undefined;
        trendSocketRef.current = undefined;
        marketflowSocketRef.current = undefined;
        marketflowAnalyticsSocketRef.current = undefined;

        // --- Create fresh sockets for the new ticker ---
        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`);
        marketflowAnalyticsSocketRef.current = getWS(
            `/ws/mfa/?ticker=${encodeURIComponent(ticker)}&period=1h&limit=20`
        );

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
            reconnect(orderflowSocketRef.current!).pipe(
                shareReplay(replayCfg)
            )
        );

        setTrend$(
            reconnect(trendSocketRef.current!).pipe(
                shareReplay(replayCfg)
            )
        );

        setMarketflow$(
            reconnect(marketflowSocketRef.current!).pipe(
                filter((msg: any) => msg?.ticker === ticker),
                shareReplay(replayCfg)
            )
        );

        setMarketflowAnalytics$(
            reconnect(marketflowAnalyticsSocketRef.current!).pipe(
                // belt-and-suspenders: drop any stray first emission from previous ticker
                filter((msg: any) => msg?.ticker === ticker),
                shareReplay(replayCfg)
            )
        );

        // Cleanup: cancel pipelines and close sockets created by this effect
        return () => {
            stop$.next();
            stop$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            marketflowSocketRef.current?.complete();
            marketflowAnalyticsSocketRef.current?.complete();
        };
    }, [ticker]);

    // Send to all open sockets
    const sendMessage = (msg: any) => {
        orderflowSocketRef.current && !orderflowSocketRef.current.closed && orderflowSocketRef.current.next(msg);
        trendSocketRef.current && !trendSocketRef.current.closed && trendSocketRef.current.next(msg);

        // Ensure marketflow socket exists before sending (Fix A pattern)
        if (!marketflowSocketRef.current || marketflowSocketRef.current.closed) {
            marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`);
        }
        if (!marketflowSocketRef.current.closed) {
            marketflowSocketRef.current.next(msg);
        }
        // Ensure marketflow socket exists before sending (Fix A pattern)
        if (!marketflowAnalyticsSocketRef.current || marketflowAnalyticsSocketRef.current.closed) {
            marketflowAnalyticsSocketRef.current = getWS(`/ws/mfa/?ticker=${encodeURIComponent(ticker)}&period=1h&limit=20`);
        }
        if (!marketflowAnalyticsSocketRef.current.closed) {
            marketflowAnalyticsSocketRef.current.next(msg);
        }

        // vwapSocketRef.current && !vwapSocketRef.current.closed && vwapSocketRef.current.next(msg);
    };

    // Manual shutdown (explicit global close)
    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowAnalyticsSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();
    };

    return { orderflow$, trend$, marketflow$, marketflowAnalytics$, sendMessage, close };
}
