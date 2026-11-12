import { resolveApiAssetUrl } from "@/lib/api";

export interface MessageAttachmentLike {
    id?: string;
    type?: string;
    name?: string;
    content?: string;
    url?: string;
    is_file?: boolean;
    size?: number;
}

const attachmentTextCache = new Map<string, string>();

export const isFileBackedAttachment = (att?: MessageAttachmentLike | null): boolean => {
    if (!att) return false;
    return (
        Boolean(att.is_file) ||
        Boolean(att.url) ||
        (typeof att.content === "string" && att.content.trim().startsWith("/api/attachments/"))
    );
};

export const getAttachmentUrl = (att?: MessageAttachmentLike | null): string | undefined => {
    if (!att) return undefined;
    const candidate =
        att.url ||
        (typeof att.content === "string" && att.content.trim().startsWith("/api/")
            ? att.content.trim()
            : undefined);
    if (candidate) {
        return resolveApiAssetUrl(candidate);
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (
        contentStr &&
        (contentStr.startsWith("data:") ||
            contentStr.startsWith("http://") ||
            contentStr.startsWith("https://") ||
            contentStr.startsWith("blob:"))
    ) {
        return contentStr;
    }
    return undefined;
};

export const isImageAttachment = (att?: MessageAttachmentLike | null): boolean => {
    if (!att) return false;
    const typeStr = (att.type || "").toLowerCase();
    if (
        typeStr.includes("image") ||
        typeStr.includes("photo") ||
        typeStr.includes("png") ||
        typeStr.includes("jpg") ||
        typeStr.includes("jpeg") ||
        typeStr.includes("webp") ||
        typeStr.includes("gif")
    ) {
        return true;
    }
    const nameStr = (att.name || "").toLowerCase();
    if (
        nameStr.endsWith(".png") ||
        nameStr.endsWith(".jpg") ||
        nameStr.endsWith(".jpeg") ||
        nameStr.endsWith(".webp") ||
        nameStr.endsWith(".gif")
    ) {
        return true;
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (
        contentStr.startsWith("data:image/") ||
        contentStr.startsWith("iVBOR") ||
        contentStr.startsWith("/9j/") ||
        contentStr.startsWith("R0lGOD") ||
        contentStr.startsWith("UklGR")
    ) {
        return true;
    }
    return false;
};

export const isAudioAttachment = (att?: MessageAttachmentLike | null): boolean => {
    if (!att) return false;
    const typeStr = (att.type || "").toLowerCase();
    if (typeStr.includes("audio") || typeStr.includes("mp3") || typeStr.includes("wav")) {
        return true;
    }
    const nameStr = (att.name || "").toLowerCase();
    if (
        nameStr.endsWith(".mp3") ||
        nameStr.endsWith(".wav") ||
        nameStr.endsWith(".ogg") ||
        nameStr.endsWith(".m4a") ||
        nameStr.endsWith(".flac") ||
        nameStr.endsWith(".aac")
    ) {
        return true;
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (contentStr.startsWith("data:audio/")) {
        return true;
    }
    return false;
};

export const getImageSrc = (att?: MessageAttachmentLike | null): string => {
    if (!att) return "";
    const urlStr = typeof att.url === "string" ? att.url.trim() : "";
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (isFileBackedAttachment(att) || urlStr.startsWith("/api/") || contentStr.startsWith("/api/")) {
        return resolveApiAssetUrl(urlStr || contentStr) || "";
    }
    if (
        contentStr.startsWith("data:") ||
        contentStr.startsWith("http://") ||
        contentStr.startsWith("https://") ||
        contentStr.startsWith("/") ||
        contentStr.startsWith("blob:")
    ) {
        return contentStr;
    }
    return contentStr ? `data:image/png;base64,${contentStr}` : "";
};

export const fetchAttachmentText = async (att?: MessageAttachmentLike | null): Promise<string> => {
    if (!att) return "";
    if (!isFileBackedAttachment(att)) {
        return att.content || "";
    }
    const url = getAttachmentUrl(att);
    if (!url) {
        return att.content || "";
    }
    const cached = attachmentTextCache.get(url);
    if (cached !== undefined) {
        return cached;
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch attachment (${res.status})`);
    }
    const text = await res.text();
    attachmentTextCache.set(url, text);
    return text;
};

export const fetchAttachmentDataUrl = async (att?: MessageAttachmentLike | null): Promise<string> => {
    if (!att) return "";
    if (!isFileBackedAttachment(att)) {
        return att.content || "";
    }
    const url = getAttachmentUrl(att);
    if (!url) {
        return att.content || "";
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch attachment (${res.status})`);
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error || new Error("Failed to read attachment blob"));
        reader.readAsDataURL(blob);
    });
};
