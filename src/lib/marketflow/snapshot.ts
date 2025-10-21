// src/lib/marketflow/snapshot.ts
import type { Tick } from "@/utils/marketflow.worker";

export type BackendSnapshot = {
    ticker: string;
    period: string; // '1h' etc.
    mm_net_data: [number, number][];
    acc_dis_net_data: [number, number][];
    spread_data: [number, number][];
    directional_diff_data: [number, number][];
    candles: { ohlc: [number, number, number, number, number][] };
};

export function buildSnapshotURL(
    base: string,
    ticker = "SOL-USD",
    period = "1h",
    start_ms?: number,
    end_ms?: number
): string {
    const u = new URL("/marketflow/", base);
    u.searchParams.set("ticker", ticker);
    u.searchParams.set("period", period);
    if (typeof start_ms === "number") u.searchParams.set("start_ms", String(start_ms));
    if (typeof end_ms === "number") u.searchParams.set("end_ms", String(end_ms));
    return u.toString();
}

export async function fetchSnapshot(url: string): Promise<BackendSnapshot> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status} ${res.statusText}`);
    return res.json();
}

export function adaptSnapshot(obj: BackendSnapshot): Tick[] {
    const map = new Map<number, Partial<Tick>>();
    const put = (ts: number, k: keyof Tick, v: number) => {
        const row = map.get(ts) ?? {};
        // @ts-expect-error index ok
        row[k] = v;
        map.set(ts, row);
    };

    for (const [ts, v] of obj.mm_net_data) put(ts, "mm_net", Number(v));
    for (const [ts, v] of obj.acc_dis_net_data) put(ts, "ad_net", Number(v));
    for (const [ts, v] of obj.spread_data) put(ts, "spread", Number(v));
    for (const [ts, v] of obj.directional_diff_data) put(ts, "dd", Number(v));
    for (const [ts, _o, _h, _l, c] of obj.candles.ohlc) put(ts, "price", Number(c));

    return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([ts, r]) => ({
            event: "snapshot" as const,
            ts: new Date(ts).toISOString(),
            price: Number(r.price ?? 0),
            mm_net: Number(r.mm_net ?? 0),
            ad_net: Number(r.ad_net ?? 0),
            dd: Number(r.dd ?? 0),
            spread: Number(r.spread ?? 0),
        }));
}
