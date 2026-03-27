// /hooks/useWebsocket.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, EMPTY, timer, Subject, shareReplay } from 'rxjs';
import { retry, takeUntil } from 'rxjs/operators';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { WS_BASE } from '@/lib/env';

// /hooks/useWebsocket.tsx
interface WebsocketStreams {
    orderflow$: Observable<any>;
    trend$: Observable<any>;
    marketflow$: Observable<any>;
    marketflowAnalytics$: Observable<any>;
    mfbParticipant$: Observable<any>;
    actionMonitor$: Observable<any>;
    sendMessage: (msg: any) => void;
    close: () => void;
}

export function useWebsocket(aoiId?: number): WebsocketStreams {
    const { ticker, period } = useTickerPeriod();

    const [orderflow$, setOrderflow$] = useState<Observable<any>>(EMPTY);
    const [trend$, setTrend$] = useState<Observable<any>>(EMPTY);
    const [marketflow$, setMarketflow$] = useState<Observable<any>>(EMPTY);
    const [marketflowAnalytics$, setMarketflowAnalytics$] =
        useState<Observable<any>>(EMPTY);
    const [mfbParticipant$, setmfbParticipant$] = useState<Observable<any>>(EMPTY);
    const [actionMonitor$, setActionMonitor$] = useState<Observable<any>>(EMPTY);

    // @ts-ignore
    const orderflowSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const trendSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const marketflowSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const marketflowAnalyticsSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const mfbParticipantSocketRef = useRef<WebSocketSubject<any>>();
    // @ts-ignore
    const actionMonitorSocketRef = useRef<WebSocketSubject<any>>();

    const getWS = (url: string): WebSocketSubject<any> =>
        webSocket({
            url: `${WS_BASE}${url}`,
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
        const stop$ = new Subject<void>();

        const reconnect = <T,>(obs: Observable<T>): Observable<T> =>
            obs.pipe(
                retry({ delay: () => timer(4000) }),
                takeUntil(stop$),
            );

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowAnalyticsSocketRef.current?.complete();
        mfbParticipantSocketRef.current?.complete();
        actionMonitorSocketRef.current?.complete();

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
        // @ts-ignore
        actionMonitorSocketRef.current = undefined;

        orderflowSocketRef.current = getWS(`/orderflow/?sym=${ticker}`);
        trendSocketRef.current = getWS(`/trends/?sym=${ticker}`);
        marketflowSocketRef.current = getWS(`/ws/marketflow/${encodeURIComponent(ticker)}/`);
        marketflowAnalyticsSocketRef.current = getWS(
            `/ws/mfa/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}&limit=20`
        );

        const aoiQuery =
            typeof aoiId === 'number'
                ? `&aoi_id=${encodeURIComponent(String(aoiId))}`
                : '';

        mfbParticipantSocketRef.current = getWS(
            `/ws/mfb-p/?ticker=${encodeURIComponent(ticker)}&period=${encodeURIComponent(period)}${aoiQuery}`
        );

        actionMonitorSocketRef.current = getWS(
            `/ws/action_monitor/${encodeURIComponent(ticker)}/${encodeURIComponent(period)}/`
        );

        const replayCfg = {
            bufferSize: 1,
            refCount: true,
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
            reconnect(marketflowSocketRef.current!).pipe(shareReplay(replayCfg)),
        );

        setMarketflowAnalytics$(
            reconnect(marketflowAnalyticsSocketRef.current!).pipe(
                shareReplay(replayCfg),
            ),
        );

        setmfbParticipant$(
            reconnect(mfbParticipantSocketRef.current!).pipe(
                shareReplay(replayCfg),
            ),
        );

        setActionMonitor$(
            reconnect(actionMonitorSocketRef.current!).pipe(
                shareReplay(replayCfg),
            ),
        );

        return () => {
            stop$.next();
            stop$.complete();

            orderflowSocketRef.current?.complete();
            trendSocketRef.current?.complete();
            marketflowSocketRef.current?.complete();
            marketflowAnalyticsSocketRef.current?.complete();
            mfbParticipantSocketRef.current?.complete();
            actionMonitorSocketRef.current?.complete();
        };
    }, [ticker, period, aoiId]);

    const sendMessage = useCallback(
        (msg: any) => {
            orderflowSocketRef.current &&
            !orderflowSocketRef.current.closed &&
            orderflowSocketRef.current.next(msg);

            trendSocketRef.current &&
            !trendSocketRef.current.closed &&
            trendSocketRef.current.next(msg);

            marketflowSocketRef.current &&
            !marketflowSocketRef.current.closed &&
            marketflowSocketRef.current.next(msg);

            marketflowAnalyticsSocketRef.current &&
            !marketflowAnalyticsSocketRef.current.closed &&
            marketflowAnalyticsSocketRef.current.next(msg);

            mfbParticipantSocketRef.current &&
            !mfbParticipantSocketRef.current.closed &&
            mfbParticipantSocketRef.current.next(msg);

            actionMonitorSocketRef.current &&
            !actionMonitorSocketRef.current.closed &&
            actionMonitorSocketRef.current.next(msg);
        },
        [ticker, period],
    );

    const close = () => {
        console.log('[WebSocket] Manually closing all sockets');

        orderflowSocketRef.current?.complete();
        trendSocketRef.current?.complete();
        marketflowSocketRef.current?.complete();
        marketflowAnalyticsSocketRef.current?.complete();
        mfbParticipantSocketRef.current?.complete();
        actionMonitorSocketRef.current?.complete();
    };

    return {
        orderflow$,
        trend$,
        marketflow$,
        marketflowAnalytics$,
        mfbParticipant$,
        actionMonitor$,
        sendMessage,
        close,
    };
}
