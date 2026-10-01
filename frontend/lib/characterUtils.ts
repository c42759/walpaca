/* eslint-disable @typescript-eslint/no-explicit-any */
export const getCharacterName = (char?: any): string | undefined => {
    if (!char) return undefined;
    if (char.data && char.data.name && String(char.data.name).trim()) {
        return String(char.data.name).trim();
    }
    if (char.name && String(char.name).trim()) {
        return String(char.name).trim();
    }
    return undefined;
};

export const isCharEnabled = (char?: any): boolean => {
    if (!char) return false;
    if (typeof char.enabled === "boolean") return char.enabled;
    if (typeof char.enable === "boolean") return char.enable;
    if (typeof char.data?.enabled === "boolean") return char.data.enabled;
    if (typeof char.data?.enable === "boolean") return char.data.enable;
    return Boolean(getCharacterName(char));
};

export const formatAvatarPicture = (picture?: string | null): string | undefined => {
    if (!picture) return undefined;
    if (picture.startsWith("data:") || picture.startsWith("http://") || picture.startsWith("https://") || picture.startsWith("/")) {
        return picture;
    }
    return `data:image/png;base64,${picture}`;
};

export const DEFAULT_MODEL_AVATAR = "/icon-app.svg";

export const getModelAvatarPicture = (pref?: any | null, mod?: any): string => {
    const rawPic = pref?.picture || pref?.character?.data?.avatar || pref?.character?.avatar || mod?.picture || mod?.avatar || mod?.senderAvatar;
    return formatAvatarPicture(rawPic) || DEFAULT_MODEL_AVATAR;
};
