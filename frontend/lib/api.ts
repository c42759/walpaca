export const getApiUrl = (): string => {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:5000/api`;
    }
    return "http://localhost:5000/api";
};
