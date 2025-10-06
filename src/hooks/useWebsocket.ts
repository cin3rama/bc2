import { useState, useEffect, useRef, useContext } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, EMPTY, timer, Subject } from 'rxjs';
import { retryWhen, delayWhen, tap, takeUntil, retry } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';

// Define the type for our hook's return value.
interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    marketflow$: Observable<any>;
    // cvdPeriod$: Observable<any>;
    // vwap$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(): WebsocketStreams {
    const { ticker } = useTickerPeriod(); // ticker is defined here - delete this line if working in useEffect
    // const retrieve = { type: 'get_data', sym: ticker, user: '8888' };
    // States to hold each observable stream.
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    // const [cvdPeriod$, setCvdPeriod$] = useState<Observable<any>>(EMPTY);
    // const [vwap$, setVwap$] = useState<Observable<any>>(EMPTY);

    // Refs to hold the WebSocketSubject instances (persist across renders)
    const orderflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const trendSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const marketflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const cvdPeriodSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const vwapSocketRef = useRef<WebSocketSubject<any>>(undefined);

    // A "destroy" notifier for all reconnect pipelines.
    // When this subject emits, the reconnect (and other) streams will stop.
    const destroy$ = useRef(new Subject<void>()).current;

    // This is the message that is sent on open (adjust as needed)
    const retrieve = { type: 'get_data', sym: 'BTC-USD', user: '8888' };

    // Reconnect operator: if an error occurs, wait 2 seconds and retry.
    const reconnect = <T>(obs: Observable<T>): Observable<T> =>
        obs.pipe(
            retry({ delay: () => timer(4000)}),
            retryWhen(errors =>
                errors.pipe(
                    tap(err => console.log('[WebSocket] Error encountered, reconnecting:', err)),
                    delayWhen(() => timer(10))
                )
            ),
            // If the component unmounts, signal all pipelines to end.
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
        // If ticker changes, close any existing sockets.
        if (orderflowSocketRef.current) orderflowSocketRef.current.complete();
        if (trendSocketRef.current) trendSocketRef.current.complete();
        // Create the WebSocket connections.
        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowSocketRef.current = getWS('/large-trade/?sym=BTC-USD');
        // cvdPeriodSocketRef.current = getWS('/cvd_period/');
        // vwapSocketRef.current = getWS('/vwap/');

        // Wrap the observables with reconnect logic and store them in state.
        // setCvdPeriod$(reconnect(cvdPeriodSocketRef.current.asObservable()));
        // setVwap$(reconnect(vwapSocketRef.current.asObservable()));

        setOrderflow$(reconnect(orderflowSocketRef.current.asObservable()));
        setTrend$(reconnect(trendSocketRef.current.asObservable()));
        setMarketflow$(reconnect(marketflowSocketRef.current.asObservable()));

        // Cleanup: complete all sockets on unmounting.
        return () => {
            console.log('[WebSocket] Cleanup: Closing all sockets and halting reconnections');
            destroy$.next();
            destroy$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            marketflowSocketRef.current?.complete();
            // cvdPeriodSocketRef.current?.complete();
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
            console.log('[WebSocket] Sending msg to trend:', msg);
        }
        if (marketflowSocketRef.current && !marketflowSocketRef.current.closed) {
            marketflowSocketRef.current.next(msg);
        }
        // if (cvdPeriodSocketRef.current && !cvdPeriodSocketRef.current.closed) {
        //     cvdPeriodSocketRef.current.next(msg);
        // }
        // if (vwapSocketRef.current && !vwapSocketRef.current.closed) {
        //     vwapSocketRef.current.next(msg);
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
        // cvdPeriodSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();
    };

    // return { orderflow$, trend$, cvd$, cvdPeriod$, vwap$, sendMessage, close };
    return { orderflow$, trend$, marketflow$, sendMessage, close };
}
