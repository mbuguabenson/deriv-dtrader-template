/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from 'App/app.jsx';
import initStore from 'App/initStore';
import { storeTokens, setEmbeddedMode } from 'Services/oauth';
// eslint-disable-next-line
import registerServiceWorker from 'Utils/PWA';

import AppNotificationMessages from './App/Containers/app-notification-messages.jsx';

if (
    !!window?.localStorage.getItem?.('debug_service_worker') || // To enable local service worker related development
    !window.location.hostname.startsWith('localhost')
) {
    registerServiceWorker();
}

const initApp = async () => {
    // Read ?token= and ?account= from URL before store init so client-store finds it on boot
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token') || searchParams.get('token1') || searchParams.get('access_token');
    const account = searchParams.get('account') || searchParams.get('loginid') || searchParams.get('acct1');
    const ws_url = searchParams.get('ws_url') || searchParams.get('otp_url') || searchParams.get('otpUrl');
    if (token) {
        storeTokens(token);
        setEmbeddedMode();
    }
    if (account) {
        sessionStorage.setItem('active_loginid', account);
        localStorage.setItem('active_loginid', account);
    }
    if (ws_url) {
        sessionStorage.setItem('dtrader_ws_url', ws_url);
    }

    // For simplified authentication, we don't need to pass accounts to initStore
    // The authentication will be handled by temp-auth.js and client-store.js
    // initStore is now async to perform whoami check before WebSocket connection
    const root_store = await initStore(AppNotificationMessages);

    const wrapper = document.getElementById('derivatives_trader');
    if (wrapper) {
        const root = createRoot(wrapper);
        root.render(<App root_store={root_store} />);
    }
};

initApp();
