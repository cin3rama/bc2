// /src/components/admin-web/AdminSessionProvider.tsx
"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { adminWebApi, AdminWebApiError } from "@/lib/admin-web/api";
import {
    requestAdminWalletAddress,
    signAdminChallengeMessage,
} from "@/lib/admin-web/wallet";

type AdminSessionMode = "wallet";

type AdminSessionContextValue = {
    isReady: boolean;
    isRestoring: boolean;
    isAuthenticating: boolean;
    isAuthenticated: boolean;
    walletAddress: string | null;
    walletAddressChecksum: string | null;
    label: string | null;
    loginTsMs: number | null;
    mode: AdminSessionMode | null;
    error: string | null;
    loginWithWallet: () => Promise<void>;
    refreshSession: () => Promise<void>;
    clearError: () => void;
    logout: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

function getErrorMessage(error: unknown): string {
    if (error instanceof AdminWebApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "admin_session_error";
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [walletAddressChecksum, setWalletAddressChecksum] = useState<string | null>(null);
    const [label, setLabel] = useState<string | null>(null);
    const [loginTsMs, setLoginTsMs] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const setUnauthenticated = useCallback(() => {
        setIsAuthenticated(false);
        setWalletAddress(null);
        setWalletAddressChecksum(null);
        setLabel(null);
        setLoginTsMs(null);
    }, []);

    const applyAuthenticatedSession = useCallback((payload: {
        wallet_address: string;
        wallet_address_checksum?: string;
        label?: string | null;
        login_ts_ms?: number;
    }) => {
        setIsAuthenticated(true);
        setWalletAddress(payload.wallet_address);
        setWalletAddressChecksum(payload.wallet_address_checksum ?? payload.wallet_address);
        setLabel(payload.label ?? null);
        setLoginTsMs(typeof payload.login_ts_ms === "number" ? payload.login_ts_ms : null);
    }, []);

    const refreshSession = useCallback(async () => {
        setIsRestoring(true);

        try {
            const me = await adminWebApi.authMe();

            if (me.authenticated) {
                applyAuthenticatedSession(me);
            } else {
                setUnauthenticated();
            }
        } catch {
            setUnauthenticated();
        } finally {
            setIsRestoring(false);
            setIsReady(true);
        }
    }, [applyAuthenticatedSession, setUnauthenticated]);

    useEffect(() => {
        void refreshSession();
    }, [refreshSession]);

    const loginWithWallet = useCallback(async () => {
        setError(null);
        setIsAuthenticating(true);

        try {
            const wallet = await requestAdminWalletAddress();

            const challenge = await adminWebApi.authChallenge({
                wallet_address: wallet,
            });

            const signature = await signAdminChallengeMessage({
                walletAddress: wallet,
                challenge: challenge.challenge,
            });

            const verified = await adminWebApi.authVerify({
                wallet_address: wallet,
                nonce: challenge.nonce,
                signature,
            });

            applyAuthenticatedSession(verified);

            await refreshSession();
        } catch (err) {
            setUnauthenticated();
            setError(getErrorMessage(err));
        } finally {
            setIsAuthenticating(false);
            setIsReady(true);
        }
    }, [applyAuthenticatedSession, refreshSession, setUnauthenticated]);

    const logout = useCallback(async () => {
        setError(null);

        try {
            await adminWebApi.authLogout();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setUnauthenticated();
        }
    }, [setUnauthenticated]);

    const value = useMemo<AdminSessionContextValue>(() => {
        return {
            isReady,
            isRestoring,
            isAuthenticating,
            isAuthenticated,
            walletAddress,
            walletAddressChecksum,
            label,
            loginTsMs,
            mode: isAuthenticated ? "wallet" : null,
            error,
            loginWithWallet,
            refreshSession,
            clearError: () => setError(null),
            logout,
        };
    }, [
        isReady,
        isRestoring,
        isAuthenticating,
        isAuthenticated,
        walletAddress,
        walletAddressChecksum,
        label,
        loginTsMs,
        error,
        loginWithWallet,
        refreshSession,
        logout,
    ]);

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
