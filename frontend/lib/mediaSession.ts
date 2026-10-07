/**
 * Helper utilities for browser Media Session API (navigator.mediaSession)
 * Supports hardware media keys and OS/system tray playback widgets (MPRIS, macOS Control Center, Windows Flyout).
 */

export interface MediaSessionConfig {
    title?: string;
    artist?: string;
    album?: string;
    artworkSrc?: string;
}

export interface MediaSessionHandlers {
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onSeekBackward?: (offsetSeconds?: number) => void;
    onSeekForward?: (offsetSeconds?: number) => void;
    onPreviousTrack?: () => void;
    onNextTrack?: () => void;
}

export function isMediaSessionSupported(): boolean {
    return typeof window !== "undefined" && "mediaSession" in navigator;
}

/**
 * Updates OS/system tray metadata (Track title, artist/speaker name, album/chat title, avatar artwork).
 */
export function updateMediaSessionMetadata(config: MediaSessionConfig): void {
    if (!isMediaSessionSupported()) return;

    try {
        const artwork: MediaImage[] = [];
        if (config.artworkSrc) {
            artwork.push({
                src: config.artworkSrc,
                sizes: "512x512",
                type: config.artworkSrc.endsWith(".png")
                    ? "image/png"
                    : config.artworkSrc.endsWith(".webp")
                    ? "image/webp"
                    : "image/jpeg",
            });
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            title: config.title || "Voice Message",
            artist: config.artist || "Walpaca",
            album: config.album || "Walpaca Chat",
            artwork: artwork.length > 0 ? artwork : undefined,
        });
    } catch (err) {
        console.warn("Error updating media session metadata:", err);
    }
}

/**
 * Updates the playback state visible to OS system tray / notification widgets ("playing" | "paused" | "none").
 */
export function setMediaSessionPlaybackState(state: "playing" | "paused" | "none"): void {
    if (!isMediaSessionSupported()) return;

    try {
        navigator.mediaSession.playbackState = state;
    } catch (err) {
        console.warn("Error updating media session playback state:", err);
    }
}

/**
 * Registers OS media action handlers (Media keys, tray buttons).
 */
export function registerMediaSessionHandlers(handlers: MediaSessionHandlers): () => void {
    if (!isMediaSessionSupported()) return () => {};

    const actionMap: [MediaSessionAction, ((details: MediaSessionActionDetails) => void) | null][] = [
        ["play", handlers.onPlay ? () => handlers.onPlay?.() : null],
        ["pause", handlers.onPause ? () => handlers.onPause?.() : null],
        ["stop", handlers.onStop ? () => handlers.onStop?.() : null],
        [
            "seekbackward",
            handlers.onSeekBackward
                ? (details) => handlers.onSeekBackward?.(details.seekOffset || 5)
                : null,
        ],
        [
            "seekforward",
            handlers.onSeekForward
                ? (details) => handlers.onSeekForward?.(details.seekOffset || 5)
                : null,
        ],
        ["previoustrack", handlers.onPreviousTrack ? () => handlers.onPreviousTrack?.() : null],
        ["nexttrack", handlers.onNextTrack ? () => handlers.onNextTrack?.() : null],
    ];

    actionMap.forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch {
            // Some browsers may not support all actions
        }
    });

    return () => {
        actionMap.forEach(([action]) => {
            try {
                navigator.mediaSession.setActionHandler(action, null);
            } catch {
                // ignore
            }
        });
    };
}

/**
 * Clears media session metadata and resets playback state.
 */
export function clearMediaSession(): void {
    if (!isMediaSessionSupported()) return;

    try {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
    } catch {
        // ignore
    }
}
