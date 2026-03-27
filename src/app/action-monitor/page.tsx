// /app/action-monitor/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import type {
    ActionMonitorEnvelope,
    ActionMonitorSnapshot,
} from '@/types/actionMonitorTypes';

export default function ActionMonitorPage() {
    const { actionMonitor$ } = useWebsocket();

    const [snapshot, setSnapshot] = useState<ActionMonitorSnapshot | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const sub = actionMonitor$.subscribe({
            next: (msg: ActionMonitorEnvelope) => {
                if (msg?.type === 'update_data' && msg.payload) {
                    setSnapshot(msg.payload);
                    setIsConnected(true);
                }
            },
            error: err => {
                console.error('[ActionMonitor] WS error', err);
                setIsConnected(false);
            },
            complete: () => {
                console.warn('[ActionMonitor] WS completed');
                setIsConnected(false);
            },
        });

        return () => sub.unsubscribe();
    }, [actionMonitor$]);

    // --- Loading state
    if (!snapshot) {
        return (
            <div className="p-4">
                <div className="text-sm opacity-70">
                    Waiting for Action Monitor snapshot...
                </div>
            </div>
        );
    }

    // --- Basic debug render (temporary)
    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">
                    Action Monitor
                </h1>

                <div
                    className={`text-xs px-2 py-1 rounded ${
                        isConnected
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                    }`}
                >
                    {isConnected ? 'Live' : 'Disconnected'}
                </div>
            </div>

            {/* Meta */}
            <div className="text-xs opacity-70">
                {snapshot.meta.ticker} · {snapshot.meta.period} ·{' '}
                {new Date(snapshot.meta.asof_ms).toLocaleTimeString()}
            </div>

            {/* Debug JSON (will be removed next step) */}
            <pre className="text-xs overflow-auto bg-black/20 p-3 rounded">
                {JSON.stringify(snapshot, null, 2)}
            </pre>
        </div>
    );
}
