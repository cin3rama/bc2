// /src/lib/admin-web/api.ts
import { ADMIN_WEB_API_ROOT } from "@/lib/admin-web/env";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const API_ROOT = trimTrailingSlash(ADMIN_WEB_API_ROOT);

export const MF_ADMIN_PATHS = {
    authChallenge: `${API_ROOT}/auth/challenge/`,
    authVerify: `${API_ROOT}/auth/verify/`,
    authMe: `${API_ROOT}/auth/me/`,
    authLogout: `${API_ROOT}/auth/logout/`,
    aoiList: `${API_ROOT}/aoi/`,
    aoiDetail: (aoiId: number | string) => `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/`,
    aoiMarketList: (aoiId: number | string) =>
        `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/markets/`,
    aoiMarketDetail: (aoiId: number | string, ticker: string) =>
        `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/markets/${encodeURIComponent(ticker)}/`,
};

async function requestJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
        ...init,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
    }

    return (await res.json()) as T;
}

/**
 * Task 9A note:
 * These methods are defined now so Task 9B can wire the real admin flow
 * without redesigning the admin-web structure. Response shapes remain
 * intentionally generic/unknown until real contract payload snapshots are
 * bound in Task 9B.
 */
export const adminWebApi = {
    authChallenge: async (payload: Record<string, unknown>) =>
        requestJson(MF_ADMIN_PATHS.authChallenge, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    authVerify: async (payload: Record<string, unknown>) =>
        requestJson(MF_ADMIN_PATHS.authVerify, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    authMe: async () =>
        requestJson(MF_ADMIN_PATHS.authMe, {
            method: "GET",
        }),

    authLogout: async () =>
        requestJson(MF_ADMIN_PATHS.authLogout, {
            method: "POST",
            body: JSON.stringify({}),
        }),

    listAoiPolicies: async () =>
        requestJson(MF_ADMIN_PATHS.aoiList, {
            method: "GET",
        }),

    readAoiPolicy: async (aoiId: number | string) =>
        requestJson(MF_ADMIN_PATHS.aoiDetail(aoiId), {
            method: "GET",
        }),

    patchAoiPolicy: async (aoiId: number | string, payload: Record<string, unknown>) =>
        requestJson(MF_ADMIN_PATHS.aoiDetail(aoiId), {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),

    listAoiMarketPolicies: async (aoiId: number | string) =>
        requestJson(MF_ADMIN_PATHS.aoiMarketList(aoiId), {
            method: "GET",
        }),

    readAoiMarketPolicy: async (aoiId: number | string, ticker: string) =>
        requestJson(MF_ADMIN_PATHS.aoiMarketDetail(aoiId, ticker), {
            method: "GET",
        }),

    patchAoiMarketPolicy: async (
        aoiId: number | string,
        ticker: string,
        payload: Record<string, unknown>
    ) =>
        requestJson(MF_ADMIN_PATHS.aoiMarketDetail(aoiId, ticker), {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),
};
