// hooks/useMarketflowWebsocket.ts
import React, {useEffect, useMemo, useState} from 'react';
import { useWebsocket } from './useWebsocket';
import { getSharedOrderflowStreams } from '@/hooks/getSharedOrderflowStreams';
import { MarketflowDataType } from '@/types/marketflowDataType';
import { handleRealtimeMarketData } from '@/utils/handleRealtimeMarketData';

type Props = {
    updateMarketDataRef: React.MutableRefObject<MarketflowDataType | null>;
    setMarketData: React.Dispatch<React.SetStateAction<MarketflowDataType | null>>;
};

export default function useMarketflowWebsocket({
                                                   updateMarketDataRef,
                                                   setMarketData,
                                               }: Props) {
    const { orderflow$ } = useWebsocket();

    const sharedStreams = useMemo(() => getSharedOrderflowStreams(orderflow$), [orderflow$]);
    const { marketflow$ } = sharedStreams;

    const [resetTime, setResetTime] = useState(Date.now());

    useEffect(() => {
        console.log('useMarketflowWebsocket useEffect fires');
        if (!updateMarketDataRef.current) return;

        // @ts-ignore
        const subscription = marketflow$.subscribe((trade) => {
            // if (!trade || typeof trade !== 'object') return;

            const updated = handleRealtimeMarketData(trade, updateMarketDataRef.current!);
            updateMarketDataRef.current = updated;
            setMarketData(updated);
        });
        console.log('[Marketflow WS Hook] Subscribing to marketflow$', marketflow$);

        return () => {
            subscription.unsubscribe();
            console.log('[Marketflow Websocket] Unsubscribed.');
        };
    }, [marketflow$]);

    return {
        resetTime,
    };
}
