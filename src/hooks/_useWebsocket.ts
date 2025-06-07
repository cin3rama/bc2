import { useState, useEffect, useRef } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, EMPTY, timer, Subject, ReplaySubject } from 'rxjs';
import { retryWhen, delayWhen, tap, takeUntil } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';

interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    marketflow$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(): WebsocketStreams {
    const { ticker } = useTickerPeriod();
    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    console.log('Setting marketflow$ observable');


    const orderflowSocketRef = useRef<WebSocketSubject<any> | null>(null);
    const trendSocketRef = useRef<WebSocketSubject<any> | null>(null);

    const destroy$ = useRef(new Subject<void>()).current;

    const sharedSubject = useRef(new ReplaySubject<any>(100)).current;

    const retrieve = { type: 'get_data', sym: 'BTC-USD', user: '8888' };

    const reconnect = <T>(obs: Observable<T>): Observable<T> =>
        obs.pipe(
            retryWhen(errors =>
                errors.pipe(
                    tap(err => console.log('[WebSocket] Error encountered, reconnecting:', err)),
                    delayWhen(() => timer(4000))
                )
            ),
            takeUntil(destroy$)
        );

    const getWS = (url: string): WebSocketSubject<any> => {
        return webSocket({
            url: `https://botpilot--8080.ngrok.io${url}`,
            openObserver: {
                next: () => {
                    console.log(`[WebSocket] Connected to ${url}`);
                    if (url === '/orderflow/' || url === '/workflow/') {
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
        if (orderflowSocketRef.current) orderflowSocketRef.current.complete();
        if (trendSocketRef.current) trendSocketRef.current.complete();

        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);

        const orderflow$WithTap = reconnect(orderflowSocketRef.current.asObservable()).pipe(
            tap(data => sharedSubject.next(data)) // push data to shared subject
        );

        setOrderflow$(orderflow$WithTap);
        setTrend$(reconnect(trendSocketRef.current.asObservable()));
        setMarketflow$(sharedSubject.asObservable()); // ✅ share orderflow$ with marketflow$
        marketflow$.subscribe(data => console.log('useWebsocket subscribe marketflow$',  data));

        return () => {
            console.log('[WebSocket] Cleanup: Closing all sockets and halting reconnections');
            destroy$.next();
            destroy$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
        };
    }, [ticker, destroy$]);

    const sendMessage = (msg: any) => {
        if (orderflowSocketRef.current && !orderflowSocketRef.current.closed) {
            orderflowSocketRef.current.next(msg);
        }
        if (trendSocketRef.current && !trendSocketRef.current.closed) {
            trendSocketRef.current.next(msg);
            console.log('[WebSocket] Sending msg to trend:', msg);
        }
    };

    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');
        destroy$.next();
        destroy$.complete();

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
    };
    console.log('Returning marketflow$: ', marketflow$);
    return { orderflow$, trend$, marketflow$, sendMessage, close };

}
