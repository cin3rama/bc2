// src/lib/marketflow/constants.ts
export const PERIOD_MAP = {
    "1 minute": "1min",
    "5 minutes": "5min",
    "15 minutes": "15min",
    "1 hour": "1h",
    "4 hours": "4h",
    "1 day": "1d",
    "1 week": "1w",
} as const;

export type PeriodCode = typeof PERIOD_MAP[keyof typeof PERIOD_MAP];

// UTC millis everywhere
export const nowUtcMs = (): number => Date.now();
