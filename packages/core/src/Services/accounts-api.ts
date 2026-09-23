import { getApiV4BaseUrl, getAppId } from '@deriv/shared';

import { getStoredToken, refreshAccessToken } from './oauth';

export type TAccount = {
    account_id: string;
    balance: number;
    currency: string;
    group: string;
    status: string;
    account_type: 'demo' | 'real';
    created_at: string;
    email: string;
    last_access_at: string;
    name: string;
    server_id: string;
    rights: Record<string, unknown>;
};

const getHeaders = (includeContentType = true): HeadersInit => {
    const token = getStoredToken();
    if (!token) throw new Error('No access token — user must log in');
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const headers: Record<string, string> = {
        Authorization: `Bearer ${cleanToken}`,
        ...(includeContentType && { 'Content-Type': 'application/json' }),
    };

    // Per Deriv specification: OAuth tokens use Authorization: Bearer only.
    // Personal Access Tokens (PAT) also require Deriv-App-ID.
    const isPat = cleanToken.startsWith('pat_') || cleanToken.startsWith('PAT_');
    if (isPat) {
        headers['Deriv-App-ID'] = String(getAppId());
    }

    return headers;
};

const resolveEndpointUrl = (url: string): string => {
    if (
        typeof window !== 'undefined' &&
        window.location.hostname.includes('vercel.app') &&
        url.startsWith('https://api.derivws.com')
    ) {
        return url.replace('https://api.derivws.com', `${window.location.origin}/api/derivws`);
    }
    return url;
};

/** Fetch wrapper: retries once with a refreshed token on 401. */
const apiFetch = async (url: string, options: RequestInit = {}, includeContentType = true): Promise<Response> => {
    const finalUrl = resolveEndpointUrl(url);
    try {
        const res = await fetch(finalUrl, { ...options, headers: getHeaders(includeContentType) });
        if (res.status === 401) {
            const info = JSON.parse(sessionStorage.getItem('auth_info') ?? 'null');
            if (info?.refresh_token) {
                await refreshAccessToken();
                return fetch(finalUrl, { ...options, headers: getHeaders(includeContentType) });
            }
            throw new Error('Unauthorized — no refresh token stored');
        }
        return res;
    } catch (err) {
        // If relative proxy failed or was not reachable, try direct endpoint as fallback
        if (finalUrl !== url) {
            return fetch(url, { ...options, headers: getHeaders(includeContentType) });
        }
        throw err;
    }
};

/** GET /trading/v1/options/accounts */
export const fetchAccounts = async (): Promise<TAccount[]> => {
    const res = await apiFetch(`${getApiV4BaseUrl()}/trading/v1/options/accounts`);
    if (!res.ok) throw new Error(`fetchAccounts failed: ${res.status}`);
    return (await res.json()).data;
};

/** POST /trading/v1/options/accounts */
export const createAccount = async (params: {
    currency: 'USD';
    group: 'row';
    account_type: 'demo' | 'real';
}): Promise<TAccount> => {
    const res = await apiFetch(`${getApiV4BaseUrl()}/trading/v1/options/accounts`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`createAccount failed: ${res.status}`);
    return (await res.json()).data;
};

/**
 * POST /trading/v1/options/accounts/{id}/otp
 * Returns the ready-to-use authenticated WebSocket URL.
 * Fetch this immediately before opening the socket — do not cache.
 */
export const fetchOTP = async (account_id: string): Promise<string> => {
    const res = await apiFetch(
        `${getApiV4BaseUrl()}/trading/v1/options/accounts/${account_id}/otp`,
        { method: 'POST' },
        false // no Content-Type — endpoint accepts no body
    );
    if (!res.ok) throw new Error(`fetchOTP failed: ${res.status}`);
    // Response shape: { data: { url: "wss://..." } }
    const json = await res.json();
    const url = json?.data?.url;
    if (!url) throw new Error(`fetchOTP: no url in response: ${JSON.stringify(json)}`);
    return url;
};

/** POST /trading/v1/options/accounts/{id}/reset-demo-balance */
export const resetDemoBalance = async (account_id: string): Promise<TAccount> => {
    const res = await apiFetch(
        `${getApiV4BaseUrl()}/trading/v1/options/accounts/${account_id}/reset-demo-balance`,
        { method: 'POST' },
        false // no Content-Type — endpoint accepts no body
    );
    if (!res.ok) throw new Error(`resetDemoBalance failed: ${res.status}`);
    return (await res.json()).data;
};
