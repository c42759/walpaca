"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { TTS_VOICE_GROUPS } from "@/lib/voiceConstants";
import { ChevronIcon, TrashIcon, PlusIcon, CloseIcon } from "@/components/icons/Icons";
import { PersonaTemplate, LorebookTemplate } from "@/components/settings/ManagePersonasPanel";

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
    const [personaTemplates, setPersonaTemplates] = useState<PersonaTemplate[]>([]);
    const [lorebookTemplates, setLorebookTemplates] = useState<LorebookTemplate[]>([]);

    // Form State
    const [personaFormName, setPersonaFormName] = useState<string>("");
    const [personaFormDescription, setPersonaFormDescription] = useState<string>("");
    const [personaFormScenario, setPersonaFormScenario] = useState<string>("");
    const [personaFormSystemPrompt, setPersonaFormSystemPrompt] = useState<string>("");
    const [personaFormPostHistoryInstructions, setPersonaFormPostHistoryInstructions] = useState<string>("");
    const [personaFormFirstMes, setPersonaFormFirstMes] = useState<string>("");
    const [personaFormAlternateGreetings, setPersonaFormAlternateGreetings] = useState<string[]>([]);
    const [personaFormVoice, setPersonaFormVoice] = useState<string>("af_heart");
    const [personaFormPicture, setPersonaFormPicture] = useState<string>("");
    const [personaAvatarPreview, setPersonaAvatarPreview] = useState<string>("");
    const [isUploadingPersonaAvatar, setIsUploadingPersonaAvatar] = useState<boolean>(false);
    const [personaFormNumCtx, setPersonaFormNumCtx] = useState<number>(8192);
    const [personaFormTemperature, setPersonaFormTemperature] = useState<number>(0.7);
    const [personaFormTopP, setPersonaFormTopP] = useState<number>(0.9);
    const [personaFormTopK, setPersonaFormTopK] = useState<number>(40);
    const [personaFormRepeatPenalty, setPersonaFormRepeatPenalty] = useState<number>(1.1);
    const [personaFormPresencePenalty, setPersonaFormPresencePenalty] = useState<number>(0.0);
    const [personaFormFrequencyPenalty, setPersonaFormFrequencyPenalty] = useState<number>(0.0);
    const [personaFormLorebookEntries, setPersonaFormLorebookEntries] = useState<
        Array<{ name: string; keys: string; content: string; enabled: boolean }>
    >([]);

    // Fetch initial templates
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

    // Resolve matching persona
    const currentPersona: PersonaTemplate | undefined = useMemo(() => {
        if (!personaId) return undefined;
        return personaTemplates.find(
            (p) =>
                p.filename === personaId ||
                p.filename === `${personaId}.json` ||
                p.name.toLowerCase() === personaId.toLowerCase()
        );
    }, [personaTemplates, personaId]);

    // Populate form fields
    const populateForm = useCallback((tmpl: PersonaTemplate) => {
        setPersonaFormName(tmpl.name || "");
        setPersonaFormDescription(tmpl.description || tmpl.personality || "");
        setPersonaFormScenario(tmpl.scenario || "");
        setPersonaFormSystemPrompt(tmpl.system_prompt || "");
        setPersonaFormPostHistoryInstructions(tmpl.post_history_instructions || "");
        setPersonaFormFirstMes(tmpl.first_mes || tmpl.greeting || "");
        setPersonaFormAlternateGreetings(
            Array.isArray(tmpl.alternate_greetings) ? [...tmpl.alternate_greetings] : []
        );
        setPersonaFormVoice(tmpl.voice || "af_heart");
        setPersonaFormPicture(tmpl.picture || "");
        setPersonaAvatarPreview(tmpl.picture || "");
        setPersonaFormNumCtx(tmpl.num_ctx || 8192);
        setPersonaFormTemperature(
            tmpl.generation_settings?.temperature ?? tmpl.temperature ?? 0.7
        );
        setPersonaFormTopP(tmpl.generation_settings?.top_p ?? tmpl.top_p ?? 0.9);
        setPersonaFormTopK(tmpl.generation_settings?.top_k ?? tmpl.top_k ?? 40);
        setPersonaFormRepeatPenalty(
            tmpl.generation_settings?.repeat_penalty ?? tmpl.repeat_penalty ?? 1.1
        );
        setPersonaFormPresencePenalty(
            tmpl.generation_settings?.presence_penalty ?? tmpl.presence_penalty ?? 0.0
        );
        setPersonaFormFrequencyPenalty(
            tmpl.generation_settings?.frequency_penalty ?? tmpl.frequency_penalty ?? 0.0
        );

        const rawEntries = tmpl.character_book?.entries || [];
        if (Array.isArray(rawEntries)) {
            setPersonaFormLorebookEntries(
                rawEntries.map((e: any) => ({
                    name: e.name || e.comment || "Entry",
                    keys: Array.isArray(e.keys) ? e.keys.join(", ") : String(e.keys || ""),
                    content: e.content || e.description || "",
                    enabled: e.enabled !== false,
                }))
            );
        } else {
            setPersonaFormLorebookEntries([]);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        Promise.resolve().then(() => {
            if (currentPersona && isMounted) {
                populateForm(currentPersona);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [currentPersona, populateForm]);

    // Avatar upload
    const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const localBlobUrl = URL.createObjectURL(file);
        setPersonaAvatarPreview(localBlobUrl);
        setIsUploadingPersonaAvatar(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch(`${getApiUrl()}/personas/avatar`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.picture) {
                    setPersonaFormPicture(data.picture);
                    setPersonaAvatarPreview(data.picture);
                }
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    setPersonaFormPicture(dataUrl);
                    setPersonaAvatarPreview(dataUrl);
                };
                reader.readAsDataURL(file);
            }
        } catch {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setPersonaFormPicture(dataUrl);
                setPersonaAvatarPreview(dataUrl);
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingPersonaAvatar(false);
        }
    };

    // Greetings
    const handleAddGreeting = () => {
        setPersonaFormAlternateGreetings((prev) => [...prev, ""]);
    };

    const handleUpdateGreeting = (idx: number, val: string) => {
        setPersonaFormAlternateGreetings((prev) => {
            const next = [...prev];
            next[idx] = val;
            return next;
        });
    };

    const handleRemoveGreeting = (idx: number) => {
        setPersonaFormAlternateGreetings((prev) => prev.filter((_, i) => i !== idx));
    };

    // Lorebook
    const handleAddLorebookEntry = () => {
        setPersonaFormLorebookEntries((prev) => [
            ...prev,
            { name: "New Entry", keys: "name, keyword", content: "", enabled: true },
        ]);
    };

    const handleUpdateLorebookEntry = (
        idx: number,
        field: "name" | "keys" | "content" | "enabled",
        value: any
    ) => {
        setPersonaFormLorebookEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleRemoveLorebookEntry = (idx: number) => {
        setPersonaFormLorebookEntries((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleCopyLorebookTemplate = (filename: string) => {
        if (!filename) return;
        const tmpl = lorebookTemplates.find((l) => l.filename === filename);
        if (!tmpl) return;

        setPersonaFormLorebookEntries((prev) => [
            ...prev,
            {
                name: tmpl.name || tmpl.filename.replace(".json", ""),
                keys: Array.isArray(tmpl.keys) ? tmpl.keys.join(", ") : tmpl.keys || "",
                content: tmpl.content || "",
                enabled: true,
            },
        ]);
    };

    const handleCopyFromPersonaTemplate = (filename: string) => {
        if (!filename) return;
        const tmpl = personaTemplates.find((p) => p.filename === filename);
        if (!tmpl) return;

        if (tmpl.description && !personaFormDescription) setPersonaFormDescription(tmpl.description);
        if (tmpl.scenario && !personaFormScenario) setPersonaFormScenario(tmpl.scenario);
        if (tmpl.system_prompt && !personaFormSystemPrompt) setPersonaFormSystemPrompt(tmpl.system_prompt);
        if (tmpl.post_history_instructions && !personaFormPostHistoryInstructions)
            setPersonaFormPostHistoryInstructions(tmpl.post_history_instructions);
        if (tmpl.first_mes && !personaFormFirstMes) setPersonaFormFirstMes(tmpl.first_mes);
        if (Array.isArray(tmpl.alternate_greetings) && tmpl.alternate_greetings.length > 0) {
            setPersonaFormAlternateGreetings(tmpl.alternate_greetings);
        }
        if (tmpl.voice) setPersonaFormVoice(tmpl.voice);
        if (tmpl.num_ctx) setPersonaFormNumCtx(tmpl.num_ctx);

        const rawEntries = tmpl.character_book?.entries || [];
        if (Array.isArray(rawEntries) && rawEntries.length > 0) {
            setPersonaFormLorebookEntries((prev) => [
                ...prev,
                ...rawEntries.map((e: any) => ({
                    name: e.name || e.comment || "Entry",
                    keys: Array.isArray(e.keys) ? e.keys.join(", ") : String(e.keys || ""),
                    content: e.content || e.description || "",
                    enabled: e.enabled !== false,
                })),
            ]);
        }
    };

    // Save
    const handleSavePersona = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!personaFormName.trim() || !currentPersona) return;

        setIsSaving(true);
        setSaveFeedback(null);

        const payload: any = {
            name: personaFormName.trim(),
            description: personaFormDescription.trim(),
            personality: personaFormDescription.trim(),
            scenario: personaFormScenario.trim(),
            system_prompt: personaFormSystemPrompt.trim(),
            post_history_instructions: personaFormPostHistoryInstructions.trim(),
            first_mes: personaFormFirstMes.trim(),
            alternate_greetings: personaFormAlternateGreetings.filter((g) => g.trim().length > 0),
            voice: personaFormVoice,
            picture: personaFormPicture || null,
            num_ctx: Number(personaFormNumCtx) || 8192,
            generation_settings: {
                temperature: Number(personaFormTemperature),
                top_p: Number(personaFormTopP),
                top_k: Number(personaFormTopK),
                repeat_penalty: Number(personaFormRepeatPenalty),
                presence_penalty: Number(personaFormPresencePenalty),
                frequency_penalty: Number(personaFormFrequencyPenalty),
            },
            character_book: {
                name: `${personaFormName.trim()} Lorebook`,
                entries: personaFormLorebookEntries.map((e) => ({
                    name: e.name.trim(),
                    keys: e.keys
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean),
                    content: e.content,
                    enabled: e.enabled !== false,
                })),
            },
        };

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
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MIDDLE SETTINGS CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Header Bar */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/settings/personas")}
                                className="p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer"
                                title="Back to Personas List"
                            >
                                <ChevronIcon direction="left" className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Edit Persona: {personaFormName || currentPersona?.name || personaId}</h3>
                                    {currentPersona?.filename && (
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            {currentPersona.filename}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-[#7a7d90] mt-1 font-medium">
                                    Configure identity, audio, context size, system prompts, greetings, sampler settings, and lorebook characters.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button type="submit" form="edit-persona-form" disabled={isSaving || !personaFormName.trim()}>
                                {isSaving ? "Saving..." : "Save Persona"}
                            </Button>
                        </div>
                    </div>

                    {saveFeedback && (
                        <div
                            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                                saveFeedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
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
                        <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">Loading persona template...</div>
                    ) : !currentPersona ? (
                        <div className="p-8 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 text-center space-y-3">
                            <p className="text-base font-bold text-rose-800">Persona Not Found</p>
                            <p className="text-xs text-[#7a7d90]">
                                No persona template matching <code className="font-mono">{personaId}</code> exists.
                            </p>
                            <Button type="button" variant="outline" onClick={() => router.push("/settings/personas")}>
                                Return to Personas
                            </Button>
                        </div>
                    ) : (
                        <form id="edit-persona-form" onSubmit={handleSavePersona} className="space-y-6">
                            {/* Copy Template Header Bar */}
                            <div className="p-4 rounded-xl bg-[#eaecf9]/40 border border-[#7678ed]/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-[#202022]">Copy fields from another Persona template:</span>
                                <select
                                    onChange={(e) => handleCopyFromPersonaTemplate(e.target.value)}
                                    defaultValue=""
                                    className="bg-white border border-[#e8ebf3] rounded-xl px-3 py-1.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] cursor-pointer"
                                >
                                    <option value="" disabled>
                                        Select template to duplicate...
                                    </option>
                                    {personaTemplates
                                        .filter((t) => t.filename !== currentPersona?.filename)
                                        .map((t) => (
                                            <option key={t.filename} value={t.filename}>
                                                {t.name} ({t.filename})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* 1. Identity & Audio Card */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">1. Identity &amp; Audio Settings</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Persona / Character Name *"
                                        value={personaFormName}
                                        onChange={(e) => setPersonaFormName(e.target.value)}
                                        placeholder="e.g. Sora Assistant"
                                        required
                                    />
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-[#5d6075]">Default TTS Voice</label>
                                        <select
                                            value={personaFormVoice}
                                            onChange={(e) => setPersonaFormVoice(e.target.value)}
                                            className="w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all cursor-pointer"
                                        >
                                            {TTS_VOICE_GROUPS.map((group) => (
                                                <optgroup key={group.gender} label={`${group.gender} Voices`}>
                                                    {group.voices.map((v) => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.label}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-[#5d6075] mb-1">Persona Avatar Image</label>
                                    <div className="flex items-center gap-4 bg-[#f9fafc] p-4 rounded-xl border border-[#e8ebf3]">
                                        <div className="w-30 h-30 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/30 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative group">
                                            {personaAvatarPreview || personaFormPicture ? (
                                                <img src={personaAvatarPreview || personaFormPicture || ""} alt="Avatar Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">🎭</span>
                                            )}
                                            {isUploadingPersonaAvatar && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">Converting...</div>
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-1.5">
                                            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold cursor-pointer transition-all shadow-xs">
                                                <span>{isUploadingPersonaAvatar ? "Uploading & Converting..." : "Choose Image File..."}</span>
                                                <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                                            </label>
                                            <p className="text-[11px] text-[#7a7d90]">
                                                Select an image file (.png, .jpg, .webp). Uploaded image automatically saves to avatar storage.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Input
                                        label="Context Window Size (tokens)"
                                        type="number"
                                        value={personaFormNumCtx}
                                        onChange={(e) => setPersonaFormNumCtx(Number(e.target.value) || 8192)}
                                        placeholder="8192"
                                    />
                                </div>
                            </div>

                            {/* 2. Prompts & Personality Card */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">2. Personality &amp; System Prompts</h4>
                                <Textarea
                                    label="Description / Personality Bio"
                                    rows={3}
                                    value={personaFormDescription}
                                    onChange={(e) => setPersonaFormDescription(e.target.value)}
                                    placeholder="Brief backstory, role, personality traits, and overall character tone..."
                                />
                                <Textarea
                                    label="Scenario / Context"
                                    rows={2}
                                    value={personaFormScenario}
                                    onChange={(e) => setPersonaFormScenario(e.target.value)}
                                    placeholder="Current setting or environment (e.g. Modern office, futuristic space station...)"
                                />
                                <Textarea
                                    label="System Instructions / Main System Prompt"
                                    rows={4}
                                    value={personaFormSystemPrompt}
                                    onChange={(e) => setPersonaFormSystemPrompt(e.target.value)}
                                    placeholder="Core system prompt directing AI behavior, output constraints, formatting, etc."
                                    className="font-mono"
                                />
                                <Textarea
                                    label="Post-History Instructions (In-Chat Bias)"
                                    rows={2}
                                    value={personaFormPostHistoryInstructions}
                                    onChange={(e) => setPersonaFormPostHistoryInstructions(e.target.value)}
                                    placeholder="Rules appended right after conversation history (e.g. 'Always respond concisely and never break character')"
                                />
                            </div>

                            {/* 3. Greetings Card */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">
                                    3. Greetings &amp; Conversation Openers
                                </h4>
                                <Textarea
                                    label="First Message / Initial Greeting"
                                    rows={3}
                                    value={personaFormFirstMes}
                                    onChange={(e) => setPersonaFormFirstMes(e.target.value)}
                                    placeholder="The default message that opens a new conversation when this persona is selected..."
                                />

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-[#5d6075]">Alternate Greetings ({personaFormAlternateGreetings.length})</label>
                                        <Button type="button" variant="outline" size="sm" onClick={handleAddGreeting} icon={<PlusIcon className="w-3.5 h-3.5" />}>
                                            Add Alternate Greeting
                                        </Button>
                                    </div>

                                    {personaFormAlternateGreetings.map((greet, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <Textarea
                                                rows={2}
                                                value={greet}
                                                onChange={(e) => handleUpdateGreeting(idx, e.target.value)}
                                                placeholder={`Alternative greeting option #${idx + 1}...`}
                                                className="flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveGreeting(idx)}
                                                className="p-2 text-[#7a7d90] hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer mt-1"
                                                title="Delete alternate greeting"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Sampler & Generation Settings Card */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                                <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">4. Sampler &amp; Generation Settings</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Temperature: {personaFormTemperature}</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.05"
                                            value={personaFormTemperature}
                                            onChange={(e) => setPersonaFormTemperature(parseFloat(e.target.value))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Top P: {personaFormTopP}</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={personaFormTopP}
                                            onChange={(e) => setPersonaFormTopP(parseFloat(e.target.value))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Top K: {personaFormTopK}</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={personaFormTopK}
                                            onChange={(e) => setPersonaFormTopK(parseInt(e.target.value, 10))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Repeat Penalty: {personaFormRepeatPenalty}</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="2"
                                            step="0.05"
                                            value={personaFormRepeatPenalty}
                                            onChange={(e) => setPersonaFormRepeatPenalty(parseFloat(e.target.value))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Presence Penalty: {personaFormPresencePenalty}</label>
                                        <input
                                            type="range"
                                            min="-2"
                                            max="2"
                                            step="0.1"
                                            value={personaFormPresencePenalty}
                                            onChange={(e) => setPersonaFormPresencePenalty(parseFloat(e.target.value))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#202022] mb-1">Frequency Penalty: {personaFormFrequencyPenalty}</label>
                                        <input
                                            type="range"
                                            min="-2"
                                            max="2"
                                            step="0.1"
                                            value={personaFormFrequencyPenalty}
                                            onChange={(e) => setPersonaFormFrequencyPenalty(parseFloat(e.target.value))}
                                            className="w-full accent-[#7678ed] cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 5. Embedded Lorebook Card */}
                            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e8ebf3] pb-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider">5. Embedded Lorebook Characters &amp; World Info</h4>
                                        <p className="text-xs text-[#7a7d90] mt-0.5">Keyword-activated lore entries bundled directly into this persona template.</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            onChange={(e) => handleCopyLorebookTemplate(e.target.value)}
                                            defaultValue=""
                                            className="bg-[#f9fafc] border border-[#e8ebf3] rounded-xl px-3 py-1.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] cursor-pointer"
                                        >
                                            <option value="" disabled>
                                                Import from Lorebook...
                                            </option>
                                            {lorebookTemplates.map((t) => (
                                                <option key={t.filename} value={t.filename}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                        <Button type="button" variant="outline" size="sm" onClick={handleAddLorebookEntry} icon={<PlusIcon className="w-3.5 h-3.5" />}>
                                            Add Entry
                                        </Button>
                                    </div>
                                </div>

                                {personaFormLorebookEntries.length === 0 ? (
                                    <div className="p-6 rounded-xl border border-dashed border-[#e8ebf3] text-center text-xs text-[#7a7d90]">
                                        No embedded lorebook entries yet. Click &ldquo;Add Entry&rdquo; or select a lorebook template above.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {personaFormLorebookEntries.map((entry, idx) => (
                                            <div key={idx} className="p-4 rounded-xl border border-[#e8ebf3] bg-[#f9fafc] space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <Input
                                                            value={entry.name}
                                                            onChange={(e) => handleUpdateLorebookEntry(idx, "name", e.target.value)}
                                                            placeholder="Entry Name / Comment"
                                                            className="text-xs font-bold"
                                                        />
                                                        <label className="flex items-center gap-1 text-[11px] font-semibold text-[#5d6075] shrink-0 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={entry.enabled}
                                                                onChange={(e) => handleUpdateLorebookEntry(idx, "enabled", e.target.checked)}
                                                                className="rounded accent-[#7678ed]"
                                                            />
                                                            Active
                                                        </label>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLorebookEntry(idx)}
                                                        className="p-1.5 text-[#7a7d90] hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Delete entry"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <Input
                                                    label="Activation Keys (comma-separated)"
                                                    value={entry.keys}
                                                    onChange={(e) => handleUpdateLorebookEntry(idx, "keys", e.target.value)}
                                                    placeholder="elena, spaceship, cyberdeck"
                                                    className="font-mono text-xs"
                                                />

                                                <Textarea
                                                    label="Entry Content / Memory Snippet"
                                                    rows={3}
                                                    value={entry.content}
                                                    onChange={(e) => handleUpdateLorebookEntry(idx, "content", e.target.value)}
                                                    placeholder="Detailed lore description inserted when any activation key appears in context..."
                                                    className="text-xs"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Bottom Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => router.push("/settings/personas")}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving || !personaFormName.trim()}>
                                    {isSaving ? "Saving..." : "Save Persona"}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR - HELP & TIPS */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
