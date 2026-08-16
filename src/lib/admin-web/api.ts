// /src/lib/admin-web/api.ts
import {ADMIN_WEB_API_ROOT} from "@/lib/admin-web/env";
import type {CanonicalAoiType} from "@/lib/aoi-types";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const API_ROOT = trimTrailingSlash(ADMIN_WEB_API_ROOT);

export type AdminAuthChallengeResponse = {
    ok: true;
    wallet_address: string;
    wallet_address_checksum: string;
    nonce: string;
    challenge: string;
    issued_ts_ms: number;
    expires_ts_ms: number;
};

export type AdminAuthVerifyResponse = {
    ok: true;
    authenticated: true;
    wallet_address: string;
    wallet_address_checksum: string;
    login_ts_ms?: number;
    label?: string | null;
};

export type AdminAuthMeResponse =
    | {
    ok: true;
    authenticated: true;
    wallet_address: string;
    wallet_address_checksum: string;
    login_ts_ms?: number;
    label?: string | null;
}
    | {
    ok: false;
    authenticated: false;
};

export type AdminAuthLogoutResponse = {
    ok: true;
    authenticated: false;
};

export type AdminAoiType = CanonicalAoiType;
export type AdminAoiLifecycleState = "active" | "archived";
export type AdminCheckpointTier = 1 | 2 | 3;
export type AdminCheckpointMode = "pinned" | "rotating" | "disabled";

export type AdminAoiPolicy = {
    id: number;
    account_id: string;
    aoi_type: AdminAoiType | string | null;
    lifecycle_state: AdminAoiLifecycleState | string | null;
    checkpoint_tier: AdminCheckpointTier | number | null;
    checkpoint_mode: AdminCheckpointMode | string | null;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
    notes: string | null;
    first_seen_ts_ms: number | null;
    last_authoritative_ts_ms: number | null;
    last_replay_ts_ms: number | null;
};

export type AdminAoiCreatePayload = {
    account_id: string;
    lifecycle_state: AdminAoiLifecycleState;
    aoi_type: AdminAoiType;
};

export type AdminAoiCreateResponse = AdminAoiPolicy;

export type AdminAoiCreateDuplicateErrorPayload = {
    error: "duplicate_aoi_account";
    account_id: string;
    existing_aoi_id: number;
    existing_lifecycle_state: AdminAoiLifecycleState | string | null;
    existing_aoi_type: AdminAoiType | string | null;
};

export type AdminAoiBulkPatchPayload = Partial<{
    lifecycle_state: AdminAoiLifecycleState;
    aoi_type: AdminAoiType;
    checkpoint_mode: AdminCheckpointMode;
}>;

export type AdminAoiBulkPatchRequest = {
    aoi_ids: number[];
    patch: AdminAoiBulkPatchPayload;
};

export type AdminAoiBulkPatchResponse = {
    ok: true;
    updated_count: number;
    aoi_ids: number[];
    patch: AdminAoiBulkPatchPayload;
};

export type AdminAoiPolicyPatchPayload = Partial<{
    aoi_type: AdminAoiType;
    lifecycle_state: AdminAoiLifecycleState;
    checkpoint_tier: AdminCheckpointTier;
    checkpoint_mode: AdminCheckpointMode;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
    notes: string | null;
}>;

export type AdminAoiListResponse = {
    ok: true;
    count: number;
    results: AdminAoiPolicy[];
};

export type AdminAoiDetailResponse = {
    ok: true;
    aoi: AdminAoiPolicy;
};

export type AdminMarketLifecycleState =
    | "active"
    | "dormant"
    | "inactive"
    | "unknown";

export type AdminMarketPriority = 1 | 2 | 3;

export type AdminAoiMarketPolicy = {
    aoi_id: number;
    ticker: string;
    coin: string;
    market_lifecycle_state: AdminMarketLifecycleState | string;
    market_priority: AdminMarketPriority | number;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
    first_seen_ts_ms: number | null;
    first_seen_source: string | null;
    last_trade_ts_ms: number | null;
    last_authoritative_ts_ms: number | null;
    last_replay_ts_ms: number | null;
    last_nonzero_position_ts_ms: number | null;
    last_position_size: string | null;
};

export type AdminAoiMarketPolicyPatchPayload = Partial<{
    market_priority: AdminMarketPriority;
    market_lifecycle_state: AdminMarketLifecycleState;
    replay_enabled: boolean;
    reconcile_enabled: boolean;
}>;

export type AdminAoiMarketListResponse = {
    ok: true;
    aoi_id: number;
    count: number;
    results: AdminAoiMarketPolicy[];
};

export type AdminAoiMarketDetailResponse = {
    ok: true;
    market: AdminAoiMarketPolicy;
};

/* ============================================================
 * AV2 STATUS / MONITORING
 * ============================================================ */

export type AdminAv2WorkerStatus = {
    worker_id: string;
    status: string;
    last_seen_ts_ms: number | null;
    detail: string | null;
};

export type AdminAv2AgentStatus = {
    agent_id: string;
    agent_name: string | null;
    ticker: string;
    market_ticker: string | null;
    strategy_family: string;
    strategy_version: string | null;
    enabled: boolean;
    account_type: string;
    account_reference: string | null;
    latest_evaluation_ts_ms: number | null;
    latest_signal_status: string | null;
};

export type AdminAv2ActiveTrade = {
    trade_id: string;
    agent_id: string;
    ticker: string;
    market_ticker: string | null;
    strategy_family?: string | null;
    exchange: string;
    account_type: string;
    account_reference: string | null;
    lifecycle_state: string;
    entry_state: string | null;
    protection_state: string | null;
    exit_state: string | null;
    outcome_status: string | null;
    failure_or_suppression_reason: string | null;
    opened_ts_ms: number | null;
    max_hold_deadline_ts_ms: number | null;
    latest_lifecycle_event_ts_ms: number | null;
};

export type AdminAv2OperationalEvent = {
    event_ts_ms: number;
    severity: string;
    event_type: string;
    agent_id: string | null;
    trade_id: string | null;
    ticker: string | null;
    market_ticker: string | null;
    status: string | null;
    reason: string | null;
    message: string | null;
};

export type AdminAv2StatusResponse = {
    ok: true;
    observed_ts_ms: number;
    workers: AdminAv2WorkerStatus[];
    agents: AdminAv2AgentStatus[];
    active_trades: AdminAv2ActiveTrade[];
    recent_events: AdminAv2OperationalEvent[];
};

/* ============================================================
 * AV2 PERFORMANCE REPORTING
 * ============================================================ */

export type AdminAv2PerformanceSummary = {
    gross_pnl: string;
    net_pnl: string;
    fees: string;
    trade_count: number;
    wins: number;
    losses: number;
    win_rate: string;
    avg_net_pnl_per_trade: string;
    drawdown: string | null;
    expectancy: string | null;
    average_win: string | null;
    average_loss: string | null;
    payoff_ratio: string | null;
};

export type AdminAv2PerformanceComparison = {
    start_ts_ms: number;
    end_ts_ms: number;
    net_pnl: string;
    trade_count: number;
    win_rate: string;
    avg_net_pnl_per_trade: string;
    fees: string;
    drawdown: string | null;
};

export type AdminAv2PerformanceOpportunity = {
    qualified_signals: number;
    executed_trades: number;
    suppressed: number;
    failed: number;
};

export type AdminAv2PerformanceSeriesPoint = {
    ts_ms: number;
    net_pnl: string;
};

export type AdminAv2PerformanceRow = {
    agent_id: string;
    ticker: string;
    market_ticker: string;
    strategy_family: string;
    enabled: boolean;
    account_type: string;
    account_reference: string | null;
    gross_pnl: string;
    net_pnl: string;
    fees: string;
    trade_count: number;
    wins: number;
    losses: number;
    win_rate: string;
    avg_net_pnl_per_trade: string;
    recent_period_pnl: string;
    prior_period_pnl: string;
    change_vs_prior_period: string;
    latest_trade_ts_ms: number | null;
    qualified_signals: number;
    executed_trades: number;
    suppression_count: number;
    failure_count: number;
};

export type AdminAv2PerformanceResponse = {
    ok: true;
    start_ts_ms: number;
    end_ts_ms: number;
    summary: AdminAv2PerformanceSummary;
    comparison: AdminAv2PerformanceComparison;
    opportunity: AdminAv2PerformanceOpportunity;
    cumulative_pnl_series: AdminAv2PerformanceSeriesPoint[];
    pnl_series: AdminAv2PerformanceSeriesPoint[];
    rows: AdminAv2PerformanceRow[];
};

export type AdminAv2PerformanceParams = {
    start_ts_ms?: number;
    end_ts_ms?: number;
    agent_id?: string;
    ticker?: string;
    strategy_family?: string;
    account_reference?: string;
};

/* ============================================================
 * AV2 CONTROLS / ADMINISTRATION
 * ============================================================ */

export type AdminAv2GlobalEntryGateState = "enabled" | "paused";

export type AdminAv2ControlAgent = {
    agent_id: string;
    agent_name: string | null;
    ticker: string;
    market_ticker: string;
    strategy_family: string;
    enabled: boolean;
    account_type: string;
    account_reference: string | null;
    strategy_config: Record<string, unknown>;
    risk_config: Record<string, unknown>;
};

export type AdminAv2ControlsResponse = {
    ok: true;
    global_entry_gate: {
        state: AdminAv2GlobalEntryGateState;
    };
    agents: AdminAv2ControlAgent[];
};

export type AdminAv2GlobalEntryGateResponse = {
    ok: true;
    global_entry_gate: {
        state: AdminAv2GlobalEntryGateState;
    };
};

export type AdminAv2AgentControlResponse = {
    ok: true;
    agent: AdminAv2ControlAgent;
};

type NormalizedErrorDetail = {
    code?: string;
    message?: string;
};

type ErrorPayload = {
    error?: string | NormalizedErrorDetail;
    detail?: string;
};

export class AdminWebApiError extends Error {
    status: number;
    payload: unknown;

    constructor(message: string, status: number, payload: unknown) {
        super(message);
        this.name = "AdminWebApiError";
        this.status = status;
        this.payload = payload;
    }
}

export function isAdminAoiCreateDuplicateErrorPayload(
    payload: unknown
): payload is AdminAoiCreateDuplicateErrorPayload {
    if (!payload || typeof payload !== "object") return false;

    const typed = payload as Partial<AdminAoiCreateDuplicateErrorPayload>;

    return (
        typed.error === "duplicate_aoi_account" &&
        typeof typed.account_id === "string" &&
        typeof typed.existing_aoi_id === "number"
    );
}

export const MF_ADMIN_PATHS = {
    authChallenge: `${API_ROOT}/auth/challenge/`,
    authVerify: `${API_ROOT}/auth/verify/`,
    authMe: `${API_ROOT}/auth/me/`,
    authLogout: `${API_ROOT}/auth/logout/`,

    aoiList: `${API_ROOT}/aoi/`,
    aoiBulk: `${API_ROOT}/aoi/bulk/`,
    aoiDetail: (aoiId: number | string) =>
        `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/`,
    aoiMarketList: (aoiId: number | string) =>
        `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/markets/`,
    aoiMarketDetail: (aoiId: number | string, ticker: string) =>
        `${API_ROOT}/aoi/${encodeURIComponent(String(aoiId))}/markets/${encodeURIComponent(ticker)}/`,

    av2Status: `${API_ROOT}/av2/status/`,
    av2Performance: `${API_ROOT}/av2/performance/`,
    av2Controls: `${API_ROOT}/av2/controls/`,
    av2GlobalEntryGate: `${API_ROOT}/av2/controls/global-entry-gate/`,
    av2AgentControl: (agentId: string) =>
        `${API_ROOT}/av2/controls/agents/${encodeURIComponent(agentId)}/`,
};

function buildUrlWithParams(
    url: string,
    params?: Record<string, string | number | undefined>
): string {
    if (!params) return url;

    const sp = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            sp.set(key, String(value));
        }
    });

    const query = sp.toString();
    return query ? `${url}?${query}` : url;
}

async function parseResponsePayload(res: Response): Promise<unknown> {
    const text = await res.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function errorMessageFromPayload(
    payload: unknown,
    fallback: string
): string {
    if (typeof payload === "string" && payload.trim().length > 0) {
        return payload;
    }

    if (payload && typeof payload === "object") {
        const typed = payload as ErrorPayload;

        if (typeof typed.error === "string" && typed.error.trim().length > 0) {
            return typed.error;
        }

        if (
            typed.error &&
            typeof typed.error === "object" &&
            typeof typed.error.message === "string" &&
            typed.error.message.trim().length > 0
        ) {
            return typed.error.message;
        }

        if (typeof typed.detail === "string" && typed.detail.trim().length > 0) {
            return typed.detail;
        }
    }

    return fallback;
}

async function requestJson<T = unknown>(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<T> {
    const hasBody = init?.body !== undefined && init.body !== null;

    const res = await fetch(input, {
        ...init,
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(hasBody ? {"Content-Type": "application/json"} : {}),
            ...(init?.headers ?? {}),
        },
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
        throw new AdminWebApiError(
            errorMessageFromPayload(payload, `HTTP ${res.status}`),
            res.status,
            payload
        );
    }

    return payload as T;
}

export const adminWebApi = {
    authChallenge: async (payload: { wallet_address: string }) =>
        requestJson<AdminAuthChallengeResponse>(MF_ADMIN_PATHS.authChallenge, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    authVerify: async (payload: {
        wallet_address: string;
        nonce: string;
        signature: string;
    }) =>
        requestJson<AdminAuthVerifyResponse>(MF_ADMIN_PATHS.authVerify, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    authMe: async () =>
        requestJson<AdminAuthMeResponse>(MF_ADMIN_PATHS.authMe, {
            method: "GET",
        }),

    authLogout: async () =>
        requestJson<AdminAuthLogoutResponse>(MF_ADMIN_PATHS.authLogout, {
            method: "POST",
            body: JSON.stringify({}),
        }),

    listAoiPolicies: async (limit = 100) =>
        requestJson<AdminAoiListResponse>(
            buildUrlWithParams(MF_ADMIN_PATHS.aoiList, {limit}),
            {
                method: "GET",
            }
        ),

    createAoiPolicy: async (payload: AdminAoiCreatePayload) =>
        requestJson<AdminAoiCreateResponse>(MF_ADMIN_PATHS.aoiList, {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    bulkPatchAoiPolicies: async (payload: AdminAoiBulkPatchRequest) =>
        requestJson<AdminAoiBulkPatchResponse>(MF_ADMIN_PATHS.aoiBulk, {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),

    readAoiPolicy: async (aoiId: number | string) =>
        requestJson<AdminAoiDetailResponse>(
            MF_ADMIN_PATHS.aoiDetail(aoiId),
            {
                method: "GET",
            }
        ),

    patchAoiPolicy: async (
        aoiId: number | string,
        payload: AdminAoiPolicyPatchPayload
    ) =>
        requestJson<AdminAoiDetailResponse>(
            MF_ADMIN_PATHS.aoiDetail(aoiId),
            {
                method: "PATCH",
                body: JSON.stringify(payload),
            }
        ),

    listAoiMarketPolicies: async (aoiId: number | string) =>
        requestJson<AdminAoiMarketListResponse>(
            MF_ADMIN_PATHS.aoiMarketList(aoiId),
            {
                method: "GET",
            }
        ),

    readAoiMarketPolicy: async (
        aoiId: number | string,
        ticker: string
    ) =>
        requestJson<AdminAoiMarketDetailResponse>(
            MF_ADMIN_PATHS.aoiMarketDetail(aoiId, ticker),
            {
                method: "GET",
            }
        ),

    patchAoiMarketPolicy: async (
        aoiId: number | string,
        ticker: string,
        payload: AdminAoiMarketPolicyPatchPayload
    ) =>
        requestJson<AdminAoiMarketDetailResponse>(
            MF_ADMIN_PATHS.aoiMarketDetail(aoiId, ticker),
            {
                method: "PATCH",
                body: JSON.stringify(payload),
            }
        ),

    av2Status: async () =>
        requestJson<AdminAv2StatusResponse>(MF_ADMIN_PATHS.av2Status, {
            method: "GET",
        }),

    av2Performance: async (params?: AdminAv2PerformanceParams) =>
        requestJson<AdminAv2PerformanceResponse>(
            buildUrlWithParams(MF_ADMIN_PATHS.av2Performance, {
                start_ts_ms: params?.start_ts_ms,
                end_ts_ms: params?.end_ts_ms,
                agent_id: params?.agent_id,
                ticker: params?.ticker,
                strategy_family: params?.strategy_family,
                account_reference: params?.account_reference,
            }),
            {
                method: "GET",
            }
        ),

    av2Controls: async () =>
        requestJson<AdminAv2ControlsResponse>(MF_ADMIN_PATHS.av2Controls, {
            method: "GET",
        }),

    patchAv2GlobalEntryGate: async (
        state: AdminAv2GlobalEntryGateState
    ) =>
        requestJson<AdminAv2GlobalEntryGateResponse>(
            MF_ADMIN_PATHS.av2GlobalEntryGate,
            {
                method: "PATCH",
                body: JSON.stringify({state}),
            }
        ),

    patchAv2AgentEnabled: async (
        agentId: string,
        enabled: boolean
    ) =>
        requestJson<AdminAv2AgentControlResponse>(
            MF_ADMIN_PATHS.av2AgentControl(agentId),
            {
                method: "PATCH",
                body: JSON.stringify({enabled}),
            }
        ),
};
