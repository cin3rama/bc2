import { useState, useEffect, useRef } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import {Observable, EMPTY, timer, Subject, Subscription, retry} from 'rxjs';
import { retryWhen, delayWhen, tap, takeUntil, finalize } from 'rxjs/operators';

// Define the type for our hook's return value.
interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    // trendData$: Observable<any>;
    // cvdPeriod$: Observable<any>;
    // vwap$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(): WebsocketStreams {
    // States to hold each observable stream.
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    // const [trendData$, setTrendData$] = useState<Observable<any>>(EMPTY);
    // const [cvdPeriod$, setCvdPeriod$] = useState<Observable<any>>(EMPTY);
    // const [vwap$, setVwap$] = useState<Observable<any>>(EMPTY);

    // Refs to hold the WebSocketSubject instances (persist across renders)
    const orderflowSocketRef = useRef<WebSocketSubject<any>>(undefined);
    const trendSocketRef = useRef<WebSocketSubject<any>>(undefined);
    // const trendDataSocketRef = useRef<WebSocketSubject<any>>(undefined);
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
                    // Send the initial "retrieve" message if this is the charts connection
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
        // Create the WebSocket connections.
        orderflowSocketRef.current = getWS('/orderflow/?sym=ETH-USD');
        trendSocketRef.current = getWS('/trends/?sym=ETH-USD');
        // trendDataSocketRef.current = getWS('/cvd/');
        // cvdPeriodSocketRef.current = getWS('/cvd_period/');
        // vwapSocketRef.current = getWS('/vwap/');

        // Wrap the observables with reconnect logic and store them in state.
        setOrderflow$(reconnect(orderflowSocketRef.current.asObservable()));
        setTrend$(reconnect(trendSocketRef.current.asObservable()));
        // setTrendData$(reconnect(trendDataSocketRef.current.asObservable()));
        // setCvdPeriod$(reconnect(cvdPeriodSocketRef.current.asObservable()));
        // setVwap$(reconnect(vwapSocketRef.current.asObservable()));

        // Cleanup: complete all sockets on unmount.
        return () => {
            console.log('[WebSocket] Cleanup: Closing all sockets and halting reconnections');
            destroy$.next();
            destroy$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            // trendDataSocketRef.current?.complete();
            // cvdPeriodSocketRef.current?.complete();
            // vwapSocketRef.current?.complete();
        };
        // Note: destroy$ is stable due to useRef.
    }, [destroy$]);

    // Helper to send a message to all open sockets.
    const sendMessage = (msg: any) => {
        if (orderflowSocketRef.current && !orderflowSocketRef.current.closed) {
            orderflowSocketRef.current.next(msg);
        }
        if (trendSocketRef.current && !trendSocketRef.current.closed) {
            trendSocketRef.current.next(msg);
            console.log('[WebSocket] Sending msg to trend:', msg);
        }
        // if (trendDataSocketRef.current && !trendDataSocketRef.current.closed) {
        //     trendDataSocketRef.current.next(msg);
        // }
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
        // trendDataSocketRef.current?.complete();
        // cvdPeriodSocketRef.current?.complete();
        // vwapSocketRef.current?.complete();
    };

    // return { orderflow$, trend$, cvd$, cvdPeriod$, vwap$, sendMessage, close };
    return { orderflow$, trend$, sendMessage, close };
}
