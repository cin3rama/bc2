// contexts/HeaderConfigContext.tsx
"use client";

import React, { createContext, useContext, useState } from "react";

interface HeaderConfig {
    showTicker: boolean;
    showPeriod: boolean;
    setConfig: (config: Partial<HeaderConfig>) => void;
}

const HeaderConfigContext = createContext<HeaderConfig>({
    showTicker: true,
    showPeriod: true,
    setConfig: () => {},
});

export const useHeaderConfig = () => useContext(HeaderConfigContext);

export const HeaderConfigProvider = ({ children }: { children: React.ReactNode }) => {
    const [showTicker, setShowTicker] = useState(true);
    const [showPeriod, setShowPeriod] = useState(true);

    const setConfig = (config: Partial<HeaderConfig>) => {
        if (config.showTicker !== undefined) setShowTicker(config.showTicker);
        if (config.showPeriod !== undefined) setShowPeriod(config.showPeriod);
    };

    return (
        <HeaderConfigContext.Provider value={{ showTicker, showPeriod, setConfig }}>
            {children}
        </HeaderConfigContext.Provider>
    );
};
