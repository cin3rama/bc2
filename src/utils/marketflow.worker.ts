// src/utils/marketflow.worker.ts
export type Regime = "Balance" | "Accumulation" | "Expansion" | "Distribution" | "Markdown";

export type Tick = {
    event: "snapshot" | "tick";
    ts: string;               // ISO UTC millis → string
    price: number;
    mm_net: number;
    ad_net: number;
    dd: number;
    spread: number;
};

type WorkerStateMsg = {
    type: "state";
    state: Regime;
    baseSpread: number;
    tick: Tick;
};

type WorkerAlertMsg = {
    type: "alerts";
    state: Regime;
    alerts: string[];
    tick: Tick;
};

let history: Tick[] = [];
let state: Regime = "Balance";
let held = 0;

// === helpers
function baseSpread(): number {
    const n = Math.min(history.length, 60);
    if (!n) return 1;
    let sum = 0;
    for (let i = history.length - n; i < history.length; i++) sum += history[i].spread || 0;
    return sum / n;
}

function classify(t: Tick): Regime {
    const b = baseSpread();
    const HS = 1.35 * b;
    const LS = 0.80 * b;
    const prev = state;

    // DD hysteresis
    const up = prev !== "Expansion" ? 1.5e6 : 1.2e6;
    const dn = prev !== "Markdown" ? -0.8e6 : -0.6e6;
    const bal = 0.3e6;

    let s: Regime = prev;
    if (t.dd <= dn) s = "Markdown";
    else if (t.dd >= up && t.spread >= HS) s = "Expansion";
    else if (Math.abs(t.dd) < bal && t.spread >= LS && t.spread <= HS) s = "Balance";
    else if ((t.dd >= 0.35e6 && t.spread <= b) || (t.mm_net > 0 && t.ad_net < 0 && t.spread <= b)) s = "Accumulation";
    else if (t.mm_net < 0 && t.ad_net > 0 && t.dd <= 0.6e6) s = "Distribution";

    // 4-tick dwell to prevent flip-flop
    const next = s === prev ? s : (held >= 3 ? s : prev);
    held = next === prev ? held + 1 : 0;
    state = next;
    return state;
}

function ddSlope10(): number {
    const n = history.length;
    if (n < 11) return 0;
    return (history[n - 1].dd || 0) - (history[n - 11].dd || 0);
}

function maybeAlerts(t: Tick, st: Regime, b: number): void {
    const alerts: string[] = [];
    if (t.dd >= 2.0e6 && t.spread < 1.2 * b) alerts.push("IGNITION_UP");
    if (t.dd <= -0.8e6 && t.spread >= 1.35 * b) alerts.push("IGNITION_DOWN");
    if (st === "Expansion" && t.dd <= 0.6e6) alerts.push("EXHAUSTION_UP");
    if (st === "Markdown" && t.dd >= -0.3e6 && t.spread <= b) alerts.push("EXHAUSTION_DOWN");

    const slope = ddSlope10();
    if (slope >= 0.8e6) alerts.push("DD_SLOPE_UP");
    if (slope <= -0.8e6) alerts.push("DD_SLOPE_DOWN");

    if (alerts.length) {
        const msg: WorkerAlertMsg = { type: "alerts", state: st, alerts, tick: t };
        postMessage(msg);
    }
}

onmessage = (e: MessageEvent<Tick>) => {
    const t = e.data;
    history.push(t);
    const st = classify(t);
    const b = baseSpread();

    const msg: WorkerStateMsg = { type: "state", state: st, baseSpread: b, tick: t };
    postMessage(msg);
    maybeAlerts(t, st, b);
};
