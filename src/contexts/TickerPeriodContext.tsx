'use client';
// contexts/TickerPeriodContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface TickerPeriodContextProps {
    ticker: string;
    period: string;
    setTicker: (ticker: string) => void;
    setPeriod: (period: string) => void;
}

const TickerPeriodContext = createContext<TickerPeriodContextProps>({
    ticker: 'SOL-USD',
    period: '15min',
    setTicker: () => {},
    setPeriod: () => {},
});

export const TickerPeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ticker, setTicker] = useState<string>('SOL-USD');
    const [period, setPeriod] = useState<string>('15min');

    return (
        <TickerPeriodContext.Provider value={{ ticker, period, setTicker, setPeriod }}>
            {children}
        </TickerPeriodContext.Provider>
    );
};

export const useTickerPeriod = () => useContext(TickerPeriodContext);
