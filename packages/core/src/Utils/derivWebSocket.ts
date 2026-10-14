// src/Utils/derivWebSocket.ts
/**
 * Helper utilities for the Deriv Options OTP flow.
 *
 * - `getAuthenticatedWsUrl` fetches a one‑time‑use WebSocket URL for a given
 *   account using the existing `fetchOTP` service (which already adds the
 *   required Authorization and optional Deriv‑App‑ID headers).
 * - `connectAuthenticatedWs` opens a WebSocket to that URL and provides a
 *   basic event wiring example.
 *
 * The functions are generic – they do **not** contain any private tokens.
 * Choose the credential type in your app configuration:
 *   * OAuth 2.0 – token obtained via the OAuth flow.
 *   * Personal Access Token (PAT) – static token; `fetchOTP` will automatically
 *     add the `Deriv‑App‑ID` header when it detects a PAT.
 */
import { fetchOTP } from '../Services/accounts-api';

/**
 * Retrieve the authenticated WebSocket URL for a Deriv account.
 *
 * @param accountId - The Deriv account identifier.
 * @returns The `wss://…` endpoint that already embeds the OTP token.
 */
export async function getAuthenticatedWsUrl(accountId: string): Promise<string> {
    const wsUrl = await fetchOTP(accountId);
    return wsUrl;
}

/**
 * Open a WebSocket to the provided OTP URL.
 *
 * The caller receives the raw `WebSocket` instance so they can attach their own
 * listeners or send/receive messages according to the Deriv protocol.
 *
 * @param wsUrl - Authenticated WebSocket URL from `getAuthenticatedWsUrl`.
 * @returns The live WebSocket connection.
 */
export function connectAuthenticatedWs(wsUrl: string): WebSocket {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        // WebSocket opened; you may send initial messages here.
        const balanceReq = { balance: 1 };
        ws.send(JSON.stringify(balanceReq));
    };

    ws.onmessage = event => {
        const data = JSON.parse(event.data);
        // Handle incoming data
        // (Implement handling as needed in your app)
    };

    ws.onerror = ev => {
        // Handle errors
    };

    ws.onclose = ev => {
        // Cleanup after close
    };

    return ws;
}

/**
 * Convenience wrapper that fetches the OTP URL and immediately connects.
 *
 * @param accountId - Deriv account ID.
 * @returns The active WebSocket connection.
 */
export async function initDerivWebSocket(accountId: string): Promise<WebSocket> {
    const url = await getAuthenticatedWsUrl(accountId);
    // Caller can log the URL if desired.
    return connectAuthenticatedWs(url);
}
