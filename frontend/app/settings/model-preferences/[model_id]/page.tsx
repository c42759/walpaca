"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, ModelPreference } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { getCharacterName } from "@/lib/characterUtils";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { Badge } from "@/components/ui/Badge";
import { CloseIcon } from "@/components/icons/Icons";
import {
    PersonaEditorForm,
    PersonaFormData,
    PersonaTemplateItem,
    LorebookTemplateItem,
} from "@/components/settings/PersonaEditorForm";

export default function EditModelPreferencePage() {
    const params = useParams();
    const router = useRouter();
    const rawModelId = typeof params?.model_id === "string" ? params.model_id : "";
    const modelId = decodeURIComponent(rawModelId);

    const {
        setCurrentView,
        instances,
        fetchInstances,
        modelPreferences,
        fetchModelPreferences,
        setModelPreference: setStoreModelPreference,
        instanceModelsMap,
        fetchInstanceModels,
    } = useAppStore();

    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-model-preferences");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // External templates for copying
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplateItem[]>([]);
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplateItem[]>([]);

    // Fetched preference object
    const [fetchedPref, setFetchedPref] = useState<ModelPreference | null>(null);

    // Initial load: templates and instances
    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            try {
                const [prefRes, insts, lRes, pRes] = await Promise.all([
                    fetchModelPreferences(),
                    fetchInstances(),
                    fetch(`${getApiUrl()}/lorebook`),
                    fetch(`${getApiUrl()}/personas`),
                ]);

                if (isMounted) {
                    if (lRes.ok) {
                        const lData = await lRes.json();
                        setLorebookTemplates(Array.isArray(lData) ? lData : []);
                    }
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        setPersonaTemplates(Array.isArray(pData) ? pData : []);
                    }

                    if (insts && Array.isArray(insts)) {
                        for (const inst of insts) {
                            fetchInstanceModels(inst.id).catch(() => {});
                        }
                    }
                }
            } catch (err) {
                console.warn("Error loading settings templates:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadInitial();
        return () => {
            isMounted = false;
        };
    }, [fetchModelPreferences, fetchInstances, fetchInstanceModels]);

    // Resolve preference from store or fetch directly
    useEffect(() => {
        let isMounted = true;
        const loadPref = async () => {
            const existing = modelPreferences[modelId] || modelPreferences[modelId.toLowerCase()];
            if (existing) {
                if (isMounted) setFetchedPref(existing);
                return;
            }
            try {
                const res = await fetch(`${getApiUrl()}/model-preferences/${encodeURIComponent(modelId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data && (data.character || data.picture || data.voice || data.num_ctx)) {
                        setFetchedPref(data);
                    }
                }
            } catch {
                // Ignore fallback
            }
        };

        if (modelId) {
            loadPref();
        }

        return () => {
            isMounted = false;
        };
    }, [modelId, modelPreferences]);

    // Current preference object
    const currentPref: ModelPreference | null = useMemo(() => {
        return fetchedPref || modelPreferences[modelId] || modelPreferences[modelId.toLowerCase()] || null;
    }, [fetchedPref, modelPreferences, modelId]);

    // Resolve hosting instance
    const instanceInfo = useMemo(() => {
        const targetModelName = currentPref?.model_name || modelId;

        // 1. Direct match by pref.instance_id
        if (currentPref?.instance_id) {
            const match = instances.find((i) => i.id === currentPref.instance_id);
            if (match) {
                return {
                    name: match.properties?.name || match.type,
                    type: match.type,
                };
            }
        }

        // 2. Match in instanceModelsMap
        for (const inst of instances) {
            const models = instanceModelsMap[inst.id] || [];
            if (
                models.some(
                    (m) =>
                        m.id?.toLowerCase() === targetModelName.toLowerCase() ||
                        m.name?.toLowerCase() === targetModelName.toLowerCase()
                )
            ) {
                return {
                    name: inst.properties?.name || inst.type,
                    type: inst.type,
                };
            }
        }

        return null;
    }, [currentPref, modelId, instances, instanceModelsMap]);

    const initialFormData: Partial<PersonaFormData> | undefined = useMemo(() => {
        const char = currentPref?.character || {};
        const charData = (char as any).data || char;
        const charName = getCharacterName(char) || currentPref?.name || currentPref?.model_name || modelId;

        return {
            name: charName,
            description: charData.description || charData.personality || currentPref?.description || "",
            personality: charData.personality || charData.description || currentPref?.description || "",
            scenario: charData.scenario || "",
            system_prompt: charData.system_prompt || "",
            post_history_instructions: charData.post_history_instructions || "",
            first_mes: charData.first_mes || "",
            alternate_greetings: charData.alternate_greetings || [],
            voice: currentPref?.voice || "af_heart",
            picture: currentPref?.picture || "",
            num_ctx: currentPref?.num_ctx || 8192,
            generation_settings: charData.generation_settings || {
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
            },
            character_book: charData.character_book
                ? {
                      name: charData.character_book.name || `${charName} Lorebook`,
                      entries: (charData.character_book.entries || []).map((e: any) => ({
                          name: e.name || e.comment || "Entry",
                          keys: Array.isArray(e.keys)
                              ? e.keys
                              : String(e.keys || "")
                                    .split(",")
                                    .map((k) => k.trim())
                                    .filter(Boolean),
                          content: e.content || e.description || "",
                          enabled: e.enabled !== false,
                      })),
                  }
                : undefined,
        };
    }, [currentPref, modelId]);

    const handleSaveModelPreference = useCallback(
        async (payload: PersonaFormData) => {
            setIsSaving(true);
            setSaveFeedback(null);

            const characterPayload = {
                name: payload.name,
                description: payload.description,
                personality: payload.personality,
                scenario: payload.scenario,
                system_prompt: payload.system_prompt,
                post_history_instructions: payload.post_history_instructions,
                first_mes: payload.first_mes,
                alternate_greetings: payload.alternate_greetings,
                voice: payload.voice,
                picture: payload.picture,
                num_ctx: payload.num_ctx,
                generation_settings: payload.generation_settings,
                character_book: payload.character_book,
            };

            const bodyPayload: any = {
                id: currentPref?.id || modelId,
                instance_id: currentPref?.instance_id,
                model_id: currentPref?.model_id,
                picture: payload.picture || null,
                voice: payload.voice,
                num_ctx: payload.num_ctx,
                character: characterPayload,
            };

            try {
                const res = await fetch(`${getApiUrl()}/model-preferences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bodyPayload),
                });

                if (res.ok) {
                    const saved = await res.json();
                    if (saved?.id) {
                        setStoreModelPreference(saved.id, saved);
                    }
                    await fetchModelPreferences(true);
                    setSaveFeedback({ type: "success", message: "Model preference saved successfully." });
                    setTimeout(() => {
                        router.push("/settings/model-preferences");
                    }, 600);
                } else {
                    const err = await res.json().catch(() => ({}));
                    setSaveFeedback({ type: "error", message: err.error || "Failed saving model preference" });
                }
            } catch (err: any) {
                console.error("Error saving model preference:", err);
                setSaveFeedback({ type: "error", message: err.message || "Error saving model preference" });
            } finally {
                setIsSaving(false);
            }
        },
        [currentPref, modelId, router, setStoreModelPreference, fetchModelPreferences]
    );

    const displayName = initialFormData?.name || currentPref?.model_name || modelId;

    return (
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar
                activeSettingsCategory={activeSettingsCategory}
                setActiveSettingsCategory={setActiveSettingsCategory}
                setCurrentView={setCurrentView}
            />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                {saveFeedback && (
                    <div
                        className={`max-w-3xl mx-auto mb-6 p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                            saveFeedback.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                    >
                        <span>{saveFeedback.message}</span>
                        <button
                            type="button"
                            onClick={() => setSaveFeedback(null)}
                            className="p-1 text-current opacity-60 hover:opacity-100 transition-opacity rounded-md cursor-pointer"
                            title="Dismiss"
                        >
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {isLoading && !currentPref ? (
                    <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                        Loading model preference...
                    </div>
                ) : (
                    <PersonaEditorForm
                        title={`Edit Model Preference: ${displayName}`}
                        subtitle="Configure character persona, profile avatar, Kokoro TTS voice, context window limits, and lorebook for this AI model."
                        badgeText={currentPref?.model_name || (currentPref?.id ? currentPref.id.slice(0, 12) + "..." : modelId)}
                        extraHeaderBadges={
                            instanceInfo && (
                                <Badge variant="primary" className="text-xs">
                                    @{instanceInfo.name}
                                </Badge>
                            )
                        }
                        saveButtonLabel="Save Preference"
                        isSaving={isSaving}
                        initialData={initialFormData}
                        availablePersonaTemplates={personaTemplates}
                        availableLorebookTemplates={lorebookTemplates}
                        currentIdentifier={currentPref?.id || modelId}
                        onSave={handleSaveModelPreference}
                        onCancel={() => router.push("/settings/model-preferences")}
                    />
                )}
            </main>

            {/* 3. RIGHT SETTINGS HELP SIDEBAR */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
