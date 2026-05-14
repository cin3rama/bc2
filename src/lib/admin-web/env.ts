// /src/lib/admin-web/env.ts
const readEnvString = (value: string | undefined, fallback: string): string => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const ADMIN_WEB_APP_TITLE = "A3therflow Admin";
export const ADMIN_WEB_APP_SUBTITLE = "Operator session shell and AOI policy admin scaffold";

export const ADMIN_WEB_API_ROOT = readEnvString(
    process.env.NEXT_PUBLIC_MF_ADMIN_API_ROOT,
    "/api/mf-admin"
);

export const ADMIN_WEB_SESSION_STORAGE_KEY = "admin_web_session_shell_v1";
