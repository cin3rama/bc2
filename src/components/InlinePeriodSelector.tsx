'use client';

import React, { useEffect, useState } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { applyLiveMarketflowUpdate } from '@/utils/applyLiveMarketflowUpdate';
import LoadingIndicator from '@/components/LoadingIndicator';
import SegmentTable from '@/components/SegmentTable';
import MarketflowSummary from '@/components/MarketflowSummary';

export default function MarketflowPage() {
    const { ticker } = useTickerPeriod();
    const { setConfig } = useHeaderConfig();
    const { orderflow$ } = useWebsocket();

    const [marketData, setMarketData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resetTime, setResetTime] = useState(Date.now());

    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
    }, [setConfig]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`https://botpilot8000.ngrok.io/marketflow_activity/?sym=${ticker}`);
                const data = await res.json();
                setMarketData(data);
                setResetTime(Date.now());
            } catch (err) {
                console.error('Failed to fetch initial marketflow data', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [ticker]);

    useEffect(() => {
        const subscription = orderflow$.subscribe((liveTrade) => {
            if (!marketData) return;
            const updated = handleRealtimeMarketData(liveTrade, marketData);
            setMarketData(updated);
        });

        return () => subscription.unsubscribe();
    }, [orderflow$, marketData]);

    if (loading || !marketData) return <LoadingIndicator />;

    return (
        <div className="space-y-4">
            <MarketflowSummary data={marketData} resetTime={resetTime} />
            <div className="grid md:grid-cols-2 gap-4">
                <SegmentTable segmentKey="marketMakers" data={marketData} />
                <SegmentTable segmentKey="accDistributors" data={marketData} />
                <SegmentTable segmentKey="dust" data={marketData} />
                <SegmentTable segmentKey="retail" data={marketData} />
            </div>
        </div>
    );
}

// @ts-ignore
function handleRealtimeMarketData(liveData, currentData) {
    return applyLiveMarketflowUpdate(liveData, currentData);
}
