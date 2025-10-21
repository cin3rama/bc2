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

    // States to hold each observable stream.
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    const [marketflowWidget$, setMarketflowWidget$] = useState<Observable<any>>(EMPTY);
    // const [vwap$, setVwap$] = useState<Observable<any>>(EMPTY);

    // Refs to hold the WebSocketSubject instances (persist across renders)
    const orderflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const trendSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowWidgetSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const vwapSocketRef = useRef<WebSocketSubject<any>>();

    // A "destroy" notifier for all reconnect pipelines.
    const destroy$ = useRef(new Subject<void>()).current;

    // Initial message sent on open for orderflow only
    const retrieve = { type: 'get_data', sym: 'SOL-USD', user: '8888' };

    // Simple reconnect wrapper: retry with delay; stop when destroy$ emits
    const reconnect = <T>(obs: Observable<T>): Observable<T> =>
        obs.pipe(
            retry({ delay: () => timer(4000) }),
            takeUntil(destroy$)
        );

    // Create a WebSocketSubject for a given URL with open and close observers.
    const getWS = (url: string): WebSocketSubject<any> => {
        return webSocket({
            url: `https://botpilot--8080.ngrok.io${url}`,
            openObserver: {
                next: () => {
                    console.log(`[WebSocket] Connected to ${url}`);
                    // Send the initial "retrieve" message if this is the chart's connection
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
    };

    useEffect(() => {
        // Close existing sockets when ticker changes (except marketflow; see below)
        if (orderflowSocketRef.current) orderflowSocketRef.current.complete();
        if (trendSocketRef.current) trendSocketRef.current.complete();
        if (marketflowWidgetSocketRef.current) marketflowWidgetSocketRef.current.complete();

        // Create/recreate sockets bound to this ticker
        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowWidgetSocketRef.current = getWS('/cvd/');

        // Ensure/create marketflow socket (Fix A: no .asObservable() on undefined)
        const mfSocket =
            marketflowSocketRef.current && !marketflowSocketRef.current.closed
                ? marketflowSocketRef.current
                : (marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`));

        // Wrap the observables with reconnect logic and store them in state.
        setOrderflow$(reconnect(orderflowSocketRef.current));
        setTrend$(reconnect(trendSocketRef.current));
        setMarketflowWidget$(reconnect(marketflowWidgetSocketRef.current));

        // Marketflow: reconnect + shareReplay for late subscribers (Fix A)
        setMarketflow$(
            reconnect(mfSocket).pipe(
                // keep the latest message; auto-disconnect upstream when no subscribers
                shareReplay({ bufferSize: 1, refCount: true })
            )
        );

        // Cleanup: signal pipelines to stop and close per-scope sockets.
        return () => {
            console.log('[WebSocket] Cleanup: Closing sockets and halting reconnections');
            destroy$.next();
            destroy$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            // Intentionally NOT completing marketflow here to avoid killing a shared stream
            // marketflowSocketRef.current?.complete();
            marketflowWidgetSocketRef.current?.complete();
            // vwapSocketRef.current?.complete();
        };
        // Note: destroy$ is stable due to useRef.
    }, [ticker, destroy$]);

    // Helper to send a message to all open sockets.
    const sendMessage = (msg: any) => {
        if (orderflowSocketRef.current && !orderflowSocketRef.current.closed) {
            orderflowSocketRef.current.next(msg);
        }
        if (trendSocketRef.current && !trendSocketRef.current.closed) {
            trendSocketRef.current.next(msg);
        }
        // Ensure/create marketflow socket on first send if needed (Fix A pattern)
        if (!marketflowSocketRef.current || marketflowSocketRef.current.closed) {
            marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`);
        }
        if (marketflowSocketRef.current && !marketflowSocketRef.current.closed) {
            marketflowSocketRef.current.next(msg);
        }
        if (marketflowWidgetSocketRef.current && !marketflowWidgetSocketRef.current.closed) {
            marketflowWidgetSocketRef.current.next(msg);
        }
        // if (vwapSocketRef.current && !vwapSocketRef.current.closed) {
        //   vwapSocketRef.current.next(msg);
        // }
    };

    // Helper to manually close all sockets.
    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');
        destroy$.next();
        destroy$.complete();

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowWidgetSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();
    };
    return { orderflow$, trend$, marketflow$, marketflowWidget$, sendMessage, close };
}
