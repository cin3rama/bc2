// /src/components/admin-web/AdminSessionProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ADMIN_WEB_SESSION_STORAGE_KEY } from "@/lib/admin-web/env";

type AdminSessionRecord = {
    isAuthenticated: boolean;
    walletAddress: string | null;
    mode: "placeholder";
    updatedAtMs: number;
};

type AdminSessionContextValue = {
    isReady: boolean;
    isAuthenticated: boolean;
    walletAddress: string | null;
    mode: "placeholder";
    loginWithPlaceholder: (walletAddress?: string) => void;
    logout: () => void;
};

const DEFAULT_WALLET = "0xADMIN_PLACEHOLDER_000000000000000000000001";

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function buildUnauthenticatedRecord(): AdminSessionRecord {
    return {
        isAuthenticated: false,
        walletAddress: null,
        mode: "placeholder",
        updatedAtMs: Date.now(),
    };
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [session, setSession] = useState<AdminSessionRecord>(buildUnauthenticatedRecord());

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const raw = window.sessionStorage.getItem(ADMIN_WEB_SESSION_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<AdminSessionRecord>;
                setSession({
                    isAuthenticated: Boolean(parsed.isAuthenticated),
                    walletAddress:
                        typeof parsed.walletAddress === "string" && parsed.walletAddress.length > 0
                            ? parsed.walletAddress
                            : null,
                    mode: "placeholder",
                    updatedAtMs:
                        typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : Date.now(),
                });
            }
        } catch {
            setSession(buildUnauthenticatedRecord());
        } finally {
            setIsReady(true);
        }
    }, []);

    useEffect(() => {
        if (!isReady || typeof window === "undefined") return;

        window.sessionStorage.setItem(
            ADMIN_WEB_SESSION_STORAGE_KEY,
            JSON.stringify(session)
        );
    }, [isReady, session]);

    const value = useMemo<AdminSessionContextValue>(() => {
        return {
            isReady,
            isAuthenticated: session.isAuthenticated,
            walletAddress: session.walletAddress,
            mode: "placeholder",
            loginWithPlaceholder: (walletAddress?: string) => {
                setSession({
                    isAuthenticated: true,
                    walletAddress: walletAddress?.trim() || DEFAULT_WALLET,
                    mode: "placeholder",
                    updatedAtMs: Date.now(),
                });
            },
            logout: () => {
                setSession(buildUnauthenticatedRecord());
            },
        };
    }, [isReady, session.isAuthenticated, session.walletAddress]);

    return (
        <AdminSessionContext.Provider value={value}>
            {children}
        </AdminSessionContext.Provider>
    );
}

export function useAdminSession(): AdminSessionContextValue {
    const ctx = useContext(AdminSessionContext);
    if (!ctx) {
        throw new Error("useAdminSession must be used inside AdminSessionProvider");
    }
    return ctx;
}
