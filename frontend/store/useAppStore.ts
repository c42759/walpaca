import { create } from "zustand";
import { getApiUrl, apiFetch, setOnAuthRequired, setSessionToken } from "../lib/api";

export interface ModelPreference {
    id: string;
    instance_id?: string | null;
    model_id?: string | null;
    model_name?: string | null;
    name?: string;
    description?: string;
    first_message?: string;
    alternate_greetings?: string[];
    picture?: string | null;
    voice?: string | null;
    num_ctx?: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    character?: Record<string, any>;
}

export interface AppPreferences {
    auto_play_voice: boolean;
    desktop_notifications: boolean;
    play_sound_notification?: boolean;
    auto_scroll: boolean;
    default_audio_output: string;
    pin_security_enabled?: boolean;
    pin_auto_lock_timeout?: string;
    processing_poll_interval?: number;
}


export interface InstanceProperties {
    name: string;
    url: string;
    api?: string;
    default_model?: string | null;
    keep_alive?: number;
    num_ctx?: number;
    override_parameters?: boolean;
    seed?: number;
    share_name?: number;
    show_response_metadata?: boolean;
    temperature?: number;
    think?: boolean;
    title_model?: string | null;
    allow_self_signed_ssl?: boolean;
}

export interface InstanceItem {
    id: string;
    pinned?: boolean;
    is_enabled?: boolean;
    enabled?: boolean;
    type: string;
    properties: InstanceProperties;
}

export interface InstanceModel {
    id: string;
    name?: string;
    uuid?: string;
    instance_model_id?: string;
    provider?: string;
    voice?: string;
    context?: string;
    tag?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
    size?: number;
    modified_at?: string;
    capabilities?: Record<string, unknown>;
}

export interface NavigationFolder {
    id: string;
    name: string;
    color?: string;
    parent?: string | null;
}

export interface FolderContextMenuState {
    x: number;
    y: number;
    folderId: string;
    folderName: string;
}

interface AppStoreState {
    // Navigation & Shell States
    currentView: "chat" | "settings";
    setCurrentView: (view: "chat" | "settings") => void;

    activeTab: string;
    setActiveTab: (tab: string) => void;

    folders: NavigationFolder[];
    foldersLoaded: boolean;
    foldersLoading: boolean;
    setFolders: (folders: NavigationFolder[] | ((prev: NavigationFolder[]) => NavigationFolder[])) => void;

    draggedChatId: string | null;
    setDraggedChatId: (id: string | null) => void;

    folderContextMenu: FolderContextMenuState | null;
    setFolderContextMenu: (menu: FolderContextMenuState | null) => void;

    isCreatingFolder: boolean;
    setIsCreatingFolder: (isCreating: boolean) => void;

    // Responsive Mobile/Tablet Shell States
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
    isRightDrawerOpen: boolean;
    setIsRightDrawerOpen: (open: boolean) => void;

    // Long-lived Data States
    instances: InstanceItem[];
    instancesLoaded: boolean;
    instancesLoading: boolean;

    modelPreferences: Record<string, ModelPreference>;
    modelPreferencesList: ModelPreference[];
    modelPreferencesLoaded: boolean;
    modelPreferencesLoading: boolean;

    instanceModelsMap: Record<string, InstanceModel[]>;
    instanceModelsLoading: Record<string, boolean>;

    // Global Application Preferences
    appPreferences: AppPreferences;
    appPreferencesLoaded: boolean;
    appPreferencesLoading: boolean;

    // PIN Security & Authentication States
    pinSecurityEnabled: boolean;
    isAuthenticated: boolean;
    isAuthChecking: boolean;
    authLockoutSeconds: number;

    // PIN Security Actions
    checkAuthStatus: () => Promise<{ pin_enabled: boolean; authenticated: boolean }>;
    verifyPin: (pin: string) => Promise<{ success: boolean; error?: string; lockout?: boolean; remaining_seconds?: number }>;
    setupPin: (pin: string, currentPin?: string) => Promise<{ success: boolean; error?: string }>;
    disablePin: (currentPin: string) => Promise<{ success: boolean; error?: string }>;
    logoutPin: () => Promise<void>;
    setAuthenticated: (authenticated: boolean) => void;

    // Actions & Cache Fetchers
    fetchFolders: (force?: boolean) => Promise<NavigationFolder[]>;
    fetchInstances: (force?: boolean) => Promise<InstanceItem[]>;
    fetchModelPreferences: (force?: boolean) => Promise<Record<string, ModelPreference>>;
    fetchInstanceModels: (instanceId: string, force?: boolean) => Promise<InstanceModel[]>;
    fetchAppPreferences: (force?: boolean) => Promise<AppPreferences>;

    // Direct Mutators for Instant UI Sync & Invalidation
    setInstances: (instances: InstanceItem[]) => void;
    setModelPreferences: (prefs: Record<string, ModelPreference>) => void;
    setModelPreference: (id: string, pref: ModelPreference) => void;
    removeModelPreference: (id: string) => void;
    setInstanceModels: (instanceId: string, models: InstanceModel[]) => void;
    setAppPreferences: (prefs: Partial<AppPreferences>) => void;

    invalidateInstances: () => void;
    invalidateModelPreferences: () => void;
    invalidateInstanceModels: (instanceId?: string) => void;
    invalidateFolders: () => void;
}

// Static non-reactive registry for shell navigation handlers
const shellHandlers: {
    goToRoot?: () => void;
    dropChat?: (chatId: string, folderId: string) => void;
} = {};

export const registerGoToRootHandler = (fn: (() => void) | null) => {
    if (fn) shellHandlers.goToRoot = fn;
    else delete shellHandlers.goToRoot;
};

export const triggerGoToRoot = () => {
    if (shellHandlers.goToRoot) {
        shellHandlers.goToRoot();
    } else {
        useAppStore.getState().setCurrentView("chat");
        useAppStore.getState().setActiveTab("all");
        if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/");
        }
    }
};

export const registerDropChatToFolderHandler = (fn: ((chatId: string, folderId: string) => void) | null) => {
    if (fn) shellHandlers.dropChat = fn;
    else delete shellHandlers.dropChat;
};

export const triggerDropChatToFolder = (chatId: string, folderId: string) => {
    shellHandlers.dropChat?.(chatId, folderId);
};

export const useAppStore = create<AppStoreState>((set, get) => ({
    currentView: "chat",
    setCurrentView: (view) => set({ currentView: view }),

    activeTab: "none",
    setActiveTab: (tab) => set({ activeTab: tab }),

    folders: [],
    foldersLoaded: false,
    foldersLoading: false,
    setFolders: (folders) =>
        set((state) => ({
            folders: typeof folders === "function" ? folders(state.folders) : folders,
            foldersLoaded: true,
        })),

    draggedChatId: null,
    setDraggedChatId: (id) => set({ draggedChatId: id }),

    folderContextMenu: null,
    setFolderContextMenu: (menu) => set({ folderContextMenu: menu }),

    isCreatingFolder: false,
    setIsCreatingFolder: (isCreating) => set({ isCreatingFolder: isCreating }),

    isMobileNavOpen: false,
    setIsMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
    isRightDrawerOpen: false,
    setIsRightDrawerOpen: (open) => set({ isRightDrawerOpen: open }),

    instances: [],
    instancesLoaded: false,
    instancesLoading: false,

    modelPreferences: {},
    modelPreferencesList: [],
    modelPreferencesLoaded: false,
    modelPreferencesLoading: false,

    instanceModelsMap: {},
    instanceModelsLoading: {},

    appPreferences: {
        auto_play_voice: false,
        desktop_notifications: true,
        play_sound_notification: true,
        auto_scroll: true,
        default_audio_output: "default",
        pin_auto_lock_timeout: "15m",
        processing_poll_interval: 2,
    },

    appPreferencesLoaded: false,
    appPreferencesLoading: false,

    // PIN Security & Auth Initial States
    pinSecurityEnabled: false,
    isAuthenticated: true,
    isAuthChecking: true,
    authLockoutSeconds: 0,

    setAuthenticated: (authenticated: boolean) => set({ isAuthenticated: authenticated }),

    checkAuthStatus: async () => {
        set({ isAuthChecking: true });
        try {
            const res = await apiFetch(`${getApiUrl()}/auth/status`);
            if (res.ok) {
                const data = await res.json();
                const pinEnabled = Boolean(data.pin_enabled);
                const isAuthed = Boolean(data.authenticated);
                set({
                    pinSecurityEnabled: pinEnabled,
                    isAuthenticated: isAuthed,
                    isAuthChecking: false,
                });
                return { pin_enabled: pinEnabled, authenticated: isAuthed };
            }
        } catch (err) {
            console.warn("Zustand: Could not check auth status:", err);
        }
        set({ isAuthChecking: false });
        return { pin_enabled: false, authenticated: true };
    },

    verifyPin: async (pin: string) => {
        try {
            const res = await apiFetch(`${getApiUrl()}/auth/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.token) {
                    setSessionToken(data.token);
                }
                set({ isAuthenticated: true, authLockoutSeconds: 0 });
                return { success: true };
            } else {
                if (data.lockout && data.remaining_seconds) {
                    set({ authLockoutSeconds: data.remaining_seconds });
                }
                return {
                    success: false,
                    error: data.error || "Incorrect PIN",
                    lockout: data.lockout,
                    remaining_seconds: data.remaining_seconds,
                };
            }
        } catch (err) {
            return { success: false, error: "Network error connecting to backend" };
        }
    },

    setupPin: async (pin: string, currentPin?: string) => {
        try {
            const res = await apiFetch(`${getApiUrl()}/auth/setup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin, current_pin: currentPin }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.token) {
                    setSessionToken(data.token);
                }
                set({ pinSecurityEnabled: true, isAuthenticated: true });
                return { success: true };
            } else {
                return { success: false, error: data.error || "Failed to configure PIN" };
            }
        } catch (err) {
            return { success: false, error: "Network error connecting to backend" };
        }
    },

    disablePin: async (currentPin: string) => {
        try {
            const res = await apiFetch(`${getApiUrl()}/auth/disable`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ current_pin: currentPin }),
            });
            const data = await res.json();
            if (res.ok) {
                setSessionToken(null);
                set({ pinSecurityEnabled: false, isAuthenticated: true });
                return { success: true };
            } else {
                return { success: false, error: data.error || "Failed to disable PIN" };
            }
        } catch (err) {
            return { success: false, error: "Network error connecting to backend" };
        }
    },

    logoutPin: async () => {
        try {
            await apiFetch(`${getApiUrl()}/auth/logout`, {
                method: "POST",
            });
        } catch (err) {
            console.warn("Zustand: Logout call failed:", err);
        }
        setSessionToken(null);
        set({ isAuthenticated: false });
    },

    fetchFolders: async (force = false) => {
        const { folders, foldersLoaded, foldersLoading } = get();
        if (foldersLoaded && !force) {
            return folders;
        }
        if (foldersLoading) {
            return folders;
        }

        set({ foldersLoading: true });
        try {
            const res = await apiFetch(`${getApiUrl()}/folders`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    set({ folders: data, foldersLoaded: true, foldersLoading: false });
                    return data;
                }
            }
        } catch (err) {
            console.warn("Zustand: Could not fetch folders from backend, fallback to initial default folders:", err);
        }
        const defaultFolders = [
            { id: "work", name: "Work" },
            { id: "friends", name: "Friends" },
            { id: "news", name: "News" },
            { id: "archive", name: "Archive" },
        ];
        set({ folders: defaultFolders, foldersLoaded: true, foldersLoading: false });
        return defaultFolders;
    },

    fetchInstances: async (force = false) => {
        const { instances, instancesLoaded, instancesLoading } = get();
        if (instancesLoaded && !force) {
            return instances;
        }
        if (instancesLoading) {
            return instances;
        }

        set({ instancesLoading: true });
        try {
            const res = await apiFetch(`${getApiUrl()}/instances`);
            if (res.ok) {
                const data: InstanceItem[] = await res.json();
                set({ instances: data, instancesLoaded: true, instancesLoading: false });
                return data;
            }
        } catch (err) {
            console.warn("Zustand: Could not fetch instances:", err);
        }
        set({ instancesLoading: false });
        return get().instances;
    },

    fetchModelPreferences: async (force = false) => {
        const { modelPreferences, modelPreferencesLoaded, modelPreferencesLoading } = get();
        if (modelPreferencesLoaded && !force) {
            return modelPreferences;
        }
        if (modelPreferencesLoading) {
            return modelPreferences;
        }

        set({ modelPreferencesLoading: true });
        try {
            const res = await apiFetch(`${getApiUrl()}/model-preferences`);
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, ModelPreference> = {};
                const list: ModelPreference[] = [];

                if (Array.isArray(data)) {
                    data.forEach((pref: ModelPreference) => {
                        if (pref) {
                            list.push(pref);
                            if (pref.id) {
                                map[pref.id] = pref;
                                map[pref.id.toLowerCase()] = pref;
                            }
                            if (pref.model_id) {
                                map[pref.model_id] = pref;
                                map[pref.model_id.toLowerCase()] = pref;
                            }
                            if (pref.model_name) {
                                map[pref.model_name] = pref;
                                map[pref.model_name.toLowerCase()] = pref;
                            }
                        }
                    });
                } else if (data && typeof data === "object") {
                    Object.values(data).forEach((val) => {
                        const p = val as ModelPreference;
                        if (p) {
                            list.push(p);
                            if (p.id) {
                                map[p.id] = p;
                                map[p.id.toLowerCase()] = p;
                            }
                            if (p.model_id) {
                                map[p.model_id] = p;
                                map[p.model_id.toLowerCase()] = p;
                            }
                            if (p.model_name) {
                                map[p.model_name] = p;
                                map[p.model_name.toLowerCase()] = p;
                            }
                        }
                    });
                }

                set({
                    modelPreferences: map,
                    modelPreferencesList: list,
                    modelPreferencesLoaded: true,
                    modelPreferencesLoading: false,
                });
                return map;
            }
        } catch (err) {
            console.warn("Zustand: Could not fetch model preferences:", err);
        }
        set({ modelPreferencesLoading: false });
        return get().modelPreferences;
    },

    fetchInstanceModels: async (instanceId: string, force = false) => {
        if (!instanceId) return [];

        const { instanceModelsMap, instanceModelsLoading } = get();
        if (instanceModelsMap[instanceId] && !force) {
            return instanceModelsMap[instanceId];
        }
        if (instanceModelsLoading[instanceId]) {
            return instanceModelsMap[instanceId] || [];
        }

        set((state) => ({
            instanceModelsLoading: { ...state.instanceModelsLoading, [instanceId]: true },
        }));

        try {
            const res = await apiFetch(`${getApiUrl()}/instances/${instanceId}/models`);
            if (res.ok) {
                const data: InstanceModel[] = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    set((state) => ({
                        instanceModelsMap: { ...state.instanceModelsMap, [instanceId]: data },
                        instanceModelsLoading: { ...state.instanceModelsLoading, [instanceId]: false },
                    }));
                    return data;
                }
            }
        } catch (err) {
            console.warn(`Zustand: Could not fetch models for instance ${instanceId}:`, err);
        }

        set((state) => ({
            instanceModelsLoading: { ...state.instanceModelsLoading, [instanceId]: false },
        }));
        return get().instanceModelsMap[instanceId] || [];
    },

    setInstances: (instances) => set({ instances, instancesLoaded: true }),

    setModelPreferences: (map) => set({ modelPreferences: map, modelPreferencesLoaded: true }),

    setModelPreference: (id, pref) =>
        set((state) => {
            const updated = { ...state.modelPreferences };
            if (id) {
                updated[id] = pref;
                updated[id.toLowerCase()] = pref;
            }
            if (pref.id) {
                updated[pref.id] = pref;
                updated[pref.id.toLowerCase()] = pref;
            }
            if (pref.model_id) {
                updated[pref.model_id] = pref;
                updated[pref.model_id.toLowerCase()] = pref;
            }
            if (pref.model_name) {
                updated[pref.model_name] = pref;
                updated[pref.model_name.toLowerCase()] = pref;
            }
            return { modelPreferences: updated };
        }),

    removeModelPreference: (id) =>
        set((state) => {
            if (!id) return state;
            const updated = { ...state.modelPreferences };
            const lowerId = id.toLowerCase();
            const target =
                updated[id] ||
                updated[lowerId] ||
                Object.values(updated).find(
                    (p) =>
                        p?.id?.toLowerCase() === lowerId ||
                        p?.model_id?.toLowerCase() === lowerId ||
                        p?.model_name?.toLowerCase() === lowerId
                );

            const targetPrefId = target?.id?.toLowerCase() || lowerId;

            for (const key of Object.keys(updated)) {
                const item = updated[key];
                if (
                    key.toLowerCase() === targetPrefId ||
                    (item?.id && item.id.toLowerCase() === targetPrefId)
                ) {
                    delete updated[key];
                }
            }

            const targetModelName = target?.model_name;
            if (targetModelName) {
                const remainingSibling = Object.values(updated).find(
                    (p) => p?.model_name?.toLowerCase() === targetModelName.toLowerCase()
                );
                if (remainingSibling) {
                    updated[targetModelName] = remainingSibling;
                    updated[targetModelName.toLowerCase()] = remainingSibling;
                } else {
                    delete updated[targetModelName];
                    delete updated[targetModelName.toLowerCase()];
                }
            }

            return { modelPreferences: updated };
        }),

    setInstanceModels: (instanceId, models) =>
        set((state) => ({
            instanceModelsMap: { ...state.instanceModelsMap, [instanceId]: models },
        })),

    invalidateInstances: () => set({ instancesLoaded: false }),

    invalidateModelPreferences: () => set({ modelPreferencesLoaded: false }),

    invalidateInstanceModels: (instanceId) =>
        set((state) => {
            if (instanceId) {
                const nextMap = { ...state.instanceModelsMap };
                delete nextMap[instanceId];
                return { instanceModelsMap: nextMap };
            }
            return { instanceModelsMap: {} };
        }),

    invalidateFolders: () => set({ foldersLoaded: false }),

    fetchAppPreferences: async (force = false) => {
        const { appPreferences, appPreferencesLoaded, appPreferencesLoading } = get();
        if (appPreferencesLoaded && !force) {
            return appPreferences;
        }
        if (appPreferencesLoading) {
            return appPreferences;
        }

        set({ appPreferencesLoading: true });
        try {
            const res = await apiFetch(`${getApiUrl()}/preferences`);
            if (res.ok) {
                const data = await res.json();
                const merged = { ...get().appPreferences, ...data };
                set({ appPreferences: merged, appPreferencesLoaded: true, appPreferencesLoading: false });
                return merged;
            }
        } catch (err) {
            console.warn("Zustand: Could not fetch preferences from backend:", err);
        }
        set({ appPreferencesLoaded: true, appPreferencesLoading: false });
        return get().appPreferences;
    },

    setAppPreferences: (prefs) =>
        set((state) => ({
            appPreferences: { ...state.appPreferences, ...prefs },
        })),
}));

if (typeof window !== "undefined") {
    setOnAuthRequired(() => {
        useAppStore.getState().setAuthenticated(false);
    });
}
