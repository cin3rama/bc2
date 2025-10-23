import { useState, useEffect, useRef } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, EMPTY, timer, Subject, shareReplay } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';

// Define the type for our hook's return value.
interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    marketflow$: Observable<any>;
    marketflowWidget$: Observable<any>;
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
    const [marketflowWidget$, setMarketflowWidget$] = useState<Observable<any>>(EMPTY);
    // const [vwap$, setVwap$] = useState<Observable<any>>(EMPTY);

    // WebSocketSubject refs (persist across renders)
    const orderflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const trendSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowWidgetSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const vwapSocketRef = useRef<WebSocketSubject<any>>();

    // Initial message for orderflow
    const retrieve = { type: 'get_data', sym: 'SOL-USD', user: '8888' };

    // Factory for WebSocketSubjects with observers
    const getWS = (url: string): WebSocketSubject<any> =>
        webSocket({
            url: `https://botpilot--8080.ngrok.io${url}`,
            openObserver: {
                next: () => {
                    console.log(`[WebSocket] Connected to ${url}`);
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
        // Per-effect stop notifier (prevents reuse-of-completed Subject issues)
        const stop$ = new Subject<void>();

        // Simple reconnect wrapper bound to this effect's lifecycle
        const reconnect = <T>(obs: Observable<T>): Observable<T> =>
            obs.pipe(
                retry({ delay: () => timer(4000) }),
                takeUntil(stop$)
            );

        // Close existing sockets when ticker changes (marketflow handled specially below)
        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowWidgetSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();

        // Recreate per-ticker sockets
        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowWidgetSocketRef.current = getWS('/cvd/');
        // vwapSocketRef.current = getWS('/vwap/');

        // ---- Marketflow: ensure/create the subject BEFORE piping it (Fix A) ----
        const mfSocket =
            marketflowSocketRef.current && !marketflowSocketRef.current.closed
                ? marketflowSocketRef.current
                : (marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`));

        // Wrap all streams with reconnect + shareReplay for late subscribers
        setOrderflow$(
            reconnect(orderflowSocketRef.current!).pipe(
                shareReplay({ bufferSize: 1, refCount: true })
            )
        );

        setTrend$(
            reconnect(trendSocketRef.current!).pipe(
                shareReplay({ bufferSize: 1, refCount: true })
            )
        );

        setMarketflowWidget$(
            reconnect(marketflowWidgetSocketRef.current!).pipe(
                shareReplay({ bufferSize: 1, refCount: true })
            )
        );

        setMarketflow$(
            reconnect(mfSocket).pipe(
                // keep the latest message; auto-disconnect upstream when no subscribers
                shareReplay({ bufferSize: 1, refCount: true })
            )
        );

        // Cleanup: stop pipelines and close per-effect sockets
        return () => {
            console.log('[WebSocket] Cleanup: halting reconnections and closing sockets');
            stop$.next();
            stop$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            // IMPORTANT: don't complete marketflow here to avoid killing it for other subscribers/routes
            // marketflowSocketRef.current?.complete();
            marketflowWidgetSocketRef.current?.complete();
            // vwapSocketRef.current?.complete();
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

        marketflowWidgetSocketRef.current &&
        !marketflowWidgetSocketRef.current.closed &&
        marketflowWidgetSocketRef.current.next(msg);

        // vwapSocketRef.current && !vwapSocketRef.current.closed && vwapSocketRef.current.next(msg);
    };

    // Manual shutdown (explicit global close)
    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowWidgetSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();
    };

    return { orderflow$, trend$, marketflow$, marketflowWidget$, sendMessage, close };
}
