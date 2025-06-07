// utils/useMarketflowData.ts
import { MarketflowDataType } from '@/types/marketflowDataType';

export async function useMarketflowData(
    ticker: string,
    period: string,
    startTime: number,
    endTime: number
): Promise<MarketflowDataType> {
    const url = `https://botpilot--8000.ngrok.io/orderflow_activity/?sym=${ticker}&start_time=${startTime}&end_time=${endTime}`;

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
