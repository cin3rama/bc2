// src/lib/marketflow/tick.ts
import type { Tick } from "@/utils/marketflow.worker";

// Your minute_update schema
export type LiveMinute = {
    type: "minute_update";
    v: number;
    ticker: string;
    ts_ms: number; // UTC ms
    nets: {
        mm_net_value: number;
        acc_dis_net_value: number;
        spread: number;
        directional_diff: number;
        // bias fields omitted on purpose
    };
    candle: { o: number; h: number; l: number; c: number; vol: number };
};

export function adaptTick(raw: LiveMinute): Tick {
    return {
        event: "tick",
        ts: new Date(raw.ts_ms).toISOString(),
        price: Number(raw.candle.c),
        mm_net: Number(raw.nets.mm_net_value),
        ad_net: Number(raw.nets.acc_dis_net_value),
        dd: Number(raw.nets.directional_diff),
        spread: Number(raw.nets.spread),
    };
}
