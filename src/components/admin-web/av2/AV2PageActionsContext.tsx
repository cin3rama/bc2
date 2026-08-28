// /src/components/admin-web/av2/Av2PageActionsContext.tsx
"use client";

import React, {
    createContext,
    useContext,
    useMemo,
    useState,
} from "react";

type Av2ReloadAction = {
    onReload: () => void | Promise<void>;
    loading: boolean;
} | null;

type Av2PageActionsContextValue = {
    reloadAction: Av2ReloadAction;
    setReloadAction: React.Dispatch<
        React.SetStateAction<Av2ReloadAction>
    >;
};

const Av2PageActionsContext =
    createContext<Av2PageActionsContextValue | null>(null);

export function Av2PageActionsProvider({
                                           children,
                                       }: {
    children: React.ReactNode;
}) {
    const [reloadAction, setReloadAction] =
        useState<Av2ReloadAction>(null);

    const value = useMemo(
        () => ({
            reloadAction,
            setReloadAction,
        }),
        [reloadAction]
    );

    return (
        <Av2PageActionsContext.Provider value={value}>
            {children}
        </Av2PageActionsContext.Provider>
    );
}

export function useAv2PageActions() {
    const context = useContext(Av2PageActionsContext);

    if (!context) {
        throw new Error(
            "useAv2PageActions must be used within Av2PageActionsProvider"
        );
    }

    return context;
}
