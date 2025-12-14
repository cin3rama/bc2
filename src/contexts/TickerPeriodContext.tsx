'use client';
// contexts/TickerPeriodContext.tsx

import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useCallback,
} from 'react';

interface TickerPeriodContextProps {
    ticker: string;
    period: string;
    setTicker: (ticker: string) => void;
    setPeriod: (period: string) => void;
}

const TickerPeriodContext = createContext<TickerPeriodContextProps>({
    ticker: '',
    period: '',
    setTicker: () => {},
    setPeriod: () => {},
});

// Storage keys (aligned with how darkMode is stored in Header)
const STORAGE_KEY_TICKER = 'mf_ticker';
const STORAGE_KEY_PERIOD = 'mf_period';

// Optional: default values if nothing is stored
const DEFAULT_TICKER = 'SOL-USD';
const DEFAULT_PERIOD = '1h';

export const TickerPeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ticker, setTickerState] = useState<string>(DEFAULT_TICKER);
    const [period, setPeriodState] = useState<string>(DEFAULT_PERIOD);

    // Hydrate from localStorage on first mount (client-side only)
    useEffect(() => {
        try {
            const storedTicker = typeof window !== 'undefined'
                ? window.localStorage.getItem(STORAGE_KEY_TICKER)
                : null;
            const storedPeriod = typeof window !== 'undefined'
                ? window.localStorage.getItem(STORAGE_KEY_PERIOD)
                : null;

            if (storedTicker) {
                setTickerState(storedTicker);
            }
            if (storedPeriod) {
                setPeriodState(storedPeriod);
            }
        } catch (err) {
            console.warn('[TickerPeriodContext] Failed to read from localStorage', err);
        }
    }, []);

    const setTicker = useCallback((nextTicker: string) => {
        setTickerState(nextTicker);
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(STORAGE_KEY_TICKER, nextTicker);
            }
        } catch (err) {
            console.warn('[TickerPeriodContext] Failed to write ticker to localStorage', err);
        }
    }, []);

    const setPeriod = useCallback((nextPeriod: string) => {
        setPeriodState(nextPeriod);
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(STORAGE_KEY_PERIOD, nextPeriod);
            }
        } catch (err) {
            console.warn('[TickerPeriodContext] Failed to write period to localStorage', err);
        }
    }, []);

    return (
        <TickerPeriodContext.Provider
            value={{ ticker, period, setTicker, setPeriod }}
        >
            {children}
        </TickerPeriodContext.Provider>
    );
};

export const useTickerPeriod = () => useContext(TickerPeriodContext);
