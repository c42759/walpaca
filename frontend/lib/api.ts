export const getApiUrl = (): string => {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:5100/api`;
    }
    return "http://localhost:5100/api";
};

const TOKEN_STORAGE_KEY = "walpaca_session_token";
let currentSessionToken: string | null = null;
let onAuthRequiredCallback: (() => void) | null = null;

export const getSessionToken = (): string | null => {
    if (currentSessionToken) {
        return currentSessionToken;
    }
    if (typeof window !== "undefined") {
        try {
            const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (stored) {
                currentSessionToken = stored;
                return stored;
            }
        } catch {
            // localStorage might be unavailable in restricted sandbox
        }
    }
    return null;
};

export const setSessionToken = (token: string | null) => {
    currentSessionToken = token;
    if (typeof window !== "undefined") {
        try {
            if (token) {
                localStorage.setItem(TOKEN_STORAGE_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
            }
        } catch {
            // ignore storage errors
        }
    }
};

export const setOnAuthRequired = (callback: (() => void) | null) => {
    onAuthRequiredCallback = callback;
};

// Intercept and augment fetch request options with auth token and credentials
const prepareRequestConfig = (init?: RequestInit): RequestInit => {
    const token = getSessionToken();
    const headers = new Headers(init?.headers || {});

    if (token && !headers.has("Authorization") && !headers.has("X-Walpaca-Session")) {
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("X-Walpaca-Session", token);
    }

    return {
        ...init,
        credentials: "include",
        headers,
    };
};

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const config = prepareRequestConfig(init);
    const res = await fetch(input, config);

    if (res.status === 401) {
        try {
            const clone = res.clone();
            const data = await clone.json();
            if (data && data.auth_required) {
                if (onAuthRequiredCallback) {
                    onAuthRequiredCallback();
                }
            }
        } catch {
            // ignore non-json error responses
        }
    }

    return res;
};

// Global browser fetch patch so ALL direct fetch calls across legacy components
// automatically forward auth tokens, credentials, and handle 401 lockouts
if (typeof window !== "undefined" && !(window as unknown as { __walpaca_fetch_patched?: boolean }).__walpaca_fetch_patched) {
    (window as unknown as { __walpaca_fetch_patched?: boolean }).__walpaca_fetch_patched = true;
    const originalFetch = window.fetch;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
        const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url || "";
        const apiUrl = getApiUrl();

        // If request is directed to backend API
        if (urlStr.includes("/api/") || urlStr.startsWith(apiUrl) || (apiUrl && urlStr.includes(":5100")) || (apiUrl && urlStr.includes(":5000"))) {
            const config = prepareRequestConfig(init);
            const res = await originalFetch(input, config);

            if (res.status === 401) {
                try {
                    const clone = res.clone();
                    const data = await clone.json();
                    if (data && data.auth_required) {
                        if (onAuthRequiredCallback) {
                            onAuthRequiredCallback();
                        }
                    }
                } catch {
                    // ignore non-json
                }
            }
            return res;
        }

        return originalFetch(input, init);
    };
}
