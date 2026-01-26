// utils/useMarketflowData.ts
import { MarketflowDataType } from '@/types/marketflowDataType';
import { API_BASE } from "@/lib/env";


export async function useMarketflowData(
    ticker: string,
    period: string,
    startTime: number,
    endTime: number
): Promise<MarketflowDataType> {
    const url = `${API_BASE}/orderflow_activity/?sym=${ticker}&start_time=${startTime}&end_time=${endTime}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const json = await res.json();
        return json as MarketflowDataType;
    } catch (err) {
        console.error('Failed to fetch marketflow data:', err);
        throw err;
    }
}
