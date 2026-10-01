/**
 * Applies the configured audio output device to an HTMLAudioElement.
 * If the selected device is not available or setSinkId fails, falls back to the system default.
 */
export async function applyAudioOutputDevice(audio: HTMLAudioElement, targetDeviceId?: string | null): Promise<void> {
    if (!targetDeviceId || targetDeviceId === "default") {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (audio as any).setSinkId !== "function") {
        // Browser does not support sink selection; system default is automatically used.
        return;
    }

    try {
        // Verify if target device currently exists among audio output devices if enumerateDevices is supported
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const isAvailable = devices.some((d) => d.kind === "audiooutput" && d.deviceId === targetDeviceId);
            if (!isAvailable) {
                console.warn(`Selected audio device (${targetDeviceId}) not found, using system default.`);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (audio as any).setSinkId("");
                return;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (audio as any).setSinkId(targetDeviceId);
    } catch (err) {
        console.warn("Failed to set audio sink ID, falling back to system default:", err);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (audio as any).setSinkId("");
        } catch {
            // ignore fallback error
        }
    }
}
