import { create } from "zustand";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface ModelPreference {
  id: string;
  name?: string;
  description?: string;
  first_message?: string;
  alternate_greetings?: string[];
  picture?: string | null;
  voice?: string | null;
  num_ctx?: number | null;
  character?: any;
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
  type: string;
  properties: InstanceProperties;
}

export interface InstanceModel {
  id: string;
  name?: string;
  provider?: string;
  voice?: string;
  context?: string;
  tag?: string;
  family?: string;
  parameter_size?: string;
  quantization_level?: string;
  size?: number;
  modified_at?: string;
  capabilities?: any;
}

interface AppStoreState {
  // Long-lived Data States
  instances: InstanceItem[];
  instancesLoaded: boolean;
  instancesLoading: boolean;

  modelPreferences: Record<string, ModelPreference>;
  modelPreferencesLoaded: boolean;
  modelPreferencesLoading: boolean;

  instanceModelsMap: Record<string, InstanceModel[]>;
  instanceModelsLoading: Record<string, boolean>;

  // Actions & Cache Fetchers
  fetchInstances: (force?: boolean) => Promise<InstanceItem[]>;
  fetchModelPreferences: (force?: boolean) => Promise<Record<string, ModelPreference>>;
  fetchInstanceModels: (instanceId: string, force?: boolean) => Promise<InstanceModel[]>;

  // Direct Mutators for Instant UI Sync & Invalidation
  setInstances: (instances: InstanceItem[]) => void;
  setModelPreferences: (prefs: Record<string, ModelPreference>) => void;
  setModelPreference: (id: string, pref: ModelPreference) => void;
  removeModelPreference: (id: string) => void;
  setInstanceModels: (instanceId: string, models: InstanceModel[]) => void;

  invalidateInstances: () => void;
  invalidateModelPreferences: () => void;
  invalidateInstanceModels: (instanceId?: string) => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  instances: [],
  instancesLoaded: false,
  instancesLoading: false,

  modelPreferences: {},
  modelPreferencesLoaded: false,
  modelPreferencesLoading: false,

  instanceModelsMap: {},
  instanceModelsLoading: {},

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
      const res = await fetch(`${API_URL}/instances`);
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
      const res = await fetch(`${API_URL}/model-preferences`);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, ModelPreference> = {};

        if (Array.isArray(data)) {
          data.forEach((pref: ModelPreference) => {
            if (pref && pref.id) {
              map[pref.id] = pref;
              map[pref.id.toLowerCase()] = pref;
            }
          });
        } else if (data && typeof data === "object") {
          Object.entries(data).forEach(([key, val]) => {
            const p = val as ModelPreference;
            if (p && p.id) {
              map[p.id] = p;
              map[p.id.toLowerCase()] = p;
            }
          });
        }

        set({ modelPreferences: map, modelPreferencesLoaded: true, modelPreferencesLoading: false });
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
      const res = await fetch(`${API_URL}/instances/${instanceId}/models`);
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
      return { modelPreferences: updated };
    }),

  removeModelPreference: (id) =>
    set((state) => {
      const updated = { ...state.modelPreferences };
      delete updated[id];
      delete updated[id.toLowerCase()];
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
}));
