"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/icons/Icons";
import {
    PersonaEditorForm,
    PersonaFormData,
    PersonaTemplateItem,
    LorebookTemplateItem,
} from "@/components/settings/PersonaEditorForm";

export default function EditPersonaPage() {
    const params = useParams();
    const router = useRouter();
    const rawPersonaId = typeof params?.persona_id === "string" ? params.persona_id : "";
    const personaId = decodeURIComponent(rawPersonaId);

    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-personas");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Persona list & Lorebook templates
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplateItem[]>([]);
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplateItem[]>([]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const [personasRes, lorebookRes] = await Promise.all([
                    fetch(`${getApiUrl()}/personas`),
                    fetch(`${getApiUrl()}/lorebook`),
                ]);

                if (isMounted) {
                    if (personasRes.ok) {
                        const personasData = await personasRes.json();
                        setPersonaTemplates(Array.isArray(personasData) ? personasData : []);
                    }
                    if (lorebookRes.ok) {
                        const lorebookData = await lorebookRes.json();
                        setLorebookTemplates(Array.isArray(lorebookData) ? lorebookData : []);
                    }
                }
            } catch (err) {
                console.warn("Could not load templates:", err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, []);

    const currentPersona: PersonaTemplateItem | undefined = useMemo(() => {
        if (!personaId) return undefined;
        return personaTemplates.find(
            (p) =>
                p.filename === personaId ||
                p.filename === `${personaId}.json` ||
                p.name.toLowerCase() === personaId.toLowerCase()
        );
    }, [personaTemplates, personaId]);

    const initialFormData: Partial<PersonaFormData> | undefined = useMemo(() => {
        if (!currentPersona) return undefined;
        return {
            name: currentPersona.name,
            description: currentPersona.description || currentPersona.personality || "",
            personality: currentPersona.description || currentPersona.personality || "",
            scenario: currentPersona.scenario || "",
            system_prompt: currentPersona.system_prompt || "",
            post_history_instructions: currentPersona.post_history_instructions || "",
            first_mes: currentPersona.first_mes || "",
            alternate_greetings: currentPersona.alternate_greetings || [],
            voice: currentPersona.voice || "af_heart",
            picture: currentPersona.picture || "",
            num_ctx: currentPersona.num_ctx || 8192,
            generation_settings: currentPersona.generation_settings || {
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1,
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
            },
            character_book: currentPersona.character_book
                ? {
                      name: currentPersona.character_book.name || `${currentPersona.name} Lorebook`,
                      entries: (currentPersona.character_book.entries || []).map((e: any) => ({
                          name: e.name || e.comment || "Entry",
                          keys: Array.isArray(e.keys) ? e.keys : String(e.keys || "").split(",").map((k) => k.trim()).filter(Boolean),
                          content: e.content || e.description || "",
                          enabled: e.enabled !== false,
                      })),
                  }
                : undefined,
        };
    }, [currentPersona]);

    const handleSavePersona = async (payload: PersonaFormData) => {
        if (!currentPersona) return;
        setIsSaving(true);
        setSaveFeedback(null);

        try {
            const res = await fetch(`${getApiUrl()}/personas/${encodeURIComponent(currentPersona.filename)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setSaveFeedback({ type: "success", message: "Persona template saved successfully." });
                setTimeout(() => {
                    router.push("/settings/personas");
                }, 800);
            } else {
                const errData = await res.json().catch(() => ({}));
                setSaveFeedback({ type: "error", message: errData.error || "Failed saving persona template" });
            }
        } catch (err: any) {
            console.error("Error saving persona template:", err);
            setSaveFeedback({ type: "error", message: err.message || "Network error saving persona template" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white rounded-none md:rounded-l-[32px] w-full h-full select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar
                activeSettingsCategory={activeSettingsCategory}
                setActiveSettingsCategory={setActiveSettingsCategory}
                setCurrentView={setCurrentView}
            />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
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

                {isLoading && !currentPersona ? (
                    <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">
                        Loading persona template...
                    </div>
                ) : !currentPersona ? (
                    <div className="mx-auto p-8 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 text-center space-y-3">
                        <p className="text-base font-bold text-rose-800">Persona Not Found</p>
                        <p className="text-xs text-[#7a7d90]">
                            No persona template matching <code className="font-mono">{personaId}</code> exists.
                        </p>
                        <Button type="button" variant="outline" onClick={() => router.push("/settings/personas")}>
                            Return to Personas
                        </Button>
                    </div>
                ) : (
                    <PersonaEditorForm
                        title={`Edit Persona: ${currentPersona.name}`}
                        badgeText={currentPersona.filename}
                        saveButtonLabel="Save Persona"
                        isSaving={isSaving}
                        initialData={initialFormData}
                        availablePersonaTemplates={personaTemplates}
                        availableLorebookTemplates={lorebookTemplates}
                        currentIdentifier={currentPersona.filename}
                        onSave={handleSavePersona}
                        onCancel={() => router.push("/settings/personas")}
                    />
                )}
            </main>

            {/* 3. RIGHT SETTINGS HELP SIDEBAR */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
