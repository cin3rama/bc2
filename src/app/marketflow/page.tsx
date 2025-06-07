'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import { useHeaderConfig } from '@/contexts/HeaderConfigContext';
import { useMarketflowData } from '@/utils/useMarketflowData';
import useMarketflowWebsocket from '@/hooks/useMarketflowWebsocket';
import { handleRealtimeMarketData } from '@/utils/handleRealtimeMarketData';
import LoadingIndicator from '@/components/LoadingIndicator';
import MarketflowSummary from '@/components/MarketflowSummary';
import SegmentTable from '@/components/SegmentTable';
import SegmentDiffCharts from '@/components/SegmentDiffCharts';
import { MarketflowDataType } from '@/types/marketflowDataType';

export default function MarketflowPage() {
    const { ticker, period } = useTickerPeriod();
    const { setConfig } = useHeaderConfig();

    const [marketData, setMarketData] = useState<MarketflowDataType | null>(null);
    const [loading, setLoading] = useState(true);
    const updateMarketDataRef = useRef<MarketflowDataType | null>(null);

    // Update header config for this page
    useEffect(() => {
        setConfig({ showTicker: true, showPeriod: false });
    }, [setConfig]);

    // Fetch initial snapshot
    const [resetTime, setResetTime] = useState(Date.now());
    useEffect(() => {
        const now = Math.floor(Date.now() / 1000);
        const periodMap: Record<string, number> = {
            '1 hour': 3600,
            '4 hours': 14400,
            '1 day': 86400,
            '1 week': 604800,
        };
        const duration = periodMap[period] || 86400;
        const startTime = now - duration;
        const endTime = now;

        (async () => {
            setLoading(true);
            try {
                const data = await useMarketflowData(ticker, period, startTime, endTime);
                setMarketData(data);
                updateMarketDataRef.current = data;
                setResetTime(Date.now());

                const queue = (window as any).__MARKETFLOW_QUEUE__ || [];
                if (queue.length > 0) {
                    const updated = queue.reduce(
                        (acc: MarketflowDataType, trade: any) => handleRealtimeMarketData(trade, acc),
                        structuredClone(data)
                    );
                    setMarketData(updated);
                    updateMarketDataRef.current = updated;
                    (window as any).__MARKETFLOW_QUEUE__ = [];
                }
            } catch (err) {
                console.error('Error loading marketflow data:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [ticker, period]);

    // Start WebSocket updates
    useMarketflowWebsocket({
        updateMarketDataRef,
        setMarketData,
    });

    if (loading || !marketData) {
        return <LoadingIndicator message="Loading marketflow data..." />;
    }

    return (
        <div className="p-4 text-text dark:text-text-inverted">
            <h2 className="text-2xl font-bold">Marketflow Analysis</h2>
            <h3 className="text-sm font-light mb-4">
                Segmented Market Insight: Market Makers, Accumulators, Dust, and Retail
            </h3>

            <MarketflowSummary data={marketData} resetTime={resetTime} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <SegmentTable segmentKey="marketMakers" data={marketData} />
                <SegmentTable segmentKey="accDistributors" data={marketData} />
                <SegmentTable segmentKey="dust" data={marketData} />
                <SegmentTable segmentKey="retail" data={marketData} />
            </div>

            <div className="mt-6">
                <SegmentDiffCharts data={marketData} period={period} resetTime={resetTime} />
            </div>
        </div>
    );
}
