"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { TTS_VOICE_GROUPS } from "@/lib/voiceConstants";
import { ChevronIcon, TrashIcon, PlusIcon } from "@/components/icons/Icons";

export interface LorebookTemplateItem {
    filename: string;
    name: string;
    keys: string[] | string;
    content: string;
    error?: string;
}

export interface PersonaTemplateItem {
    filename: string;
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    first_mes?: string;
    alternate_greetings?: string[];
    picture?: string | null;
    voice?: string | null;
    num_ctx?: number | null;
    generation_settings?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        repeat_penalty?: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    };
    character_book?: {
        name?: string;
        entries?: Array<{
            name?: string;
            keys?: string[] | string;
            content?: string;
            enabled?: boolean;
        }>;
    };
}

export interface PersonaFormData {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    system_prompt: string;
    post_history_instructions?: string;
    first_mes: string;
    alternate_greetings: string[];
    voice: string;
    picture: string | null;
    num_ctx: number;
    generation_settings?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
        repeat_penalty?: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    };
    character_book?: {
        name: string;
        entries: Array<{
            name: string;
            keys: string[];
            content: string;
            enabled: boolean;
        }>;
    };
}

export interface PersonaEditorFormProps {
    title: string;
    subtitle?: string;
    badgeText?: string;
    extraHeaderBadges?: React.ReactNode;
    saveButtonLabel?: string;
    isSaving?: boolean;
    initialData?: Partial<PersonaFormData>;
    availablePersonaTemplates?: PersonaTemplateItem[];
    availableLorebookTemplates?: LorebookTemplateItem[];
    currentIdentifier?: string;
    onSave: (payload: PersonaFormData) => Promise<void> | void;
    onCancel: () => void;
}

export function PersonaEditorForm({
    title,
    subtitle = "Configure identity, audio, context size, system prompts, greetings, sampler settings, and lorebook characters.",
    badgeText,
    extraHeaderBadges,
    saveButtonLabel = "Save Changes",
    isSaving = false,
    initialData,
    availablePersonaTemplates = [],
    availableLorebookTemplates = [],
    currentIdentifier,
    onSave,
    onCancel,
}: PersonaEditorFormProps) {
    const [name, setName] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [firstMes, setFirstMes] = useState<string>("");
    const [alternateGreetings, setAlternateGreetings] = useState<string[]>([]);
    const [voice, setVoice] = useState<string>("af_heart");
    const [picture, setPicture] = useState<string>("");
    const [avatarPreview, setAvatarPreview] = useState<string>("");
    const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
    const [numCtx, setNumCtx] = useState<number>(8192);

    // Generation Settings
    const [temperature, setTemperature] = useState<number>(0.7);
    const [topP, setTopP] = useState<number>(0.9);
    const [topK, setTopK] = useState<number>(40);
    const [repeatPenalty, setRepeatPenalty] = useState<number>(1.1);
    const [presencePenalty, setPresencePenalty] = useState<number>(0.0);
    const [frequencyPenalty, setFrequencyPenalty] = useState<number>(0.0);

    // Embedded Lorebook entries
    const [lorebookEntries, setLorebookEntries] = useState<
        Array<{ name: string; keys: string; content: string; enabled: boolean }>
    >([]);

    const populateForm = useCallback((data: Partial<PersonaFormData>) => {
        if (!data) return;
        setName(data.name || "");
        let initialSystem = data.system_prompt || "";
        if (!initialSystem) {
            initialSystem = [data.description || data.personality, data.scenario].filter(Boolean).join("\n\n");
        } else {
            const extraParts: string[] = [];
            if (data.description && data.description !== initialSystem && !initialSystem.includes(data.description)) {
                extraParts.push(data.description);
            }
            if (data.scenario && !initialSystem.includes(data.scenario)) {
                extraParts.push(data.scenario);
            }
            if (extraParts.length > 0) {
                initialSystem = `${extraParts.join("\n\n")}\n\n${initialSystem}`;
            }
        }
        setSystemPrompt(initialSystem);
        setFirstMes(data.first_mes || "");
        setAlternateGreetings(
            Array.isArray(data.alternate_greetings) ? [...data.alternate_greetings] : []
        );
        setVoice(data.voice || "af_heart");
        setPicture(data.picture || "");
        setAvatarPreview(data.picture || "");
        setNumCtx(data.num_ctx || 8192);

        if (data.generation_settings) {
            setTemperature(data.generation_settings.temperature ?? 0.7);
            setTopP(data.generation_settings.top_p ?? 0.9);
            setTopK(data.generation_settings.top_k ?? 40);
            setRepeatPenalty(data.generation_settings.repeat_penalty ?? 1.1);
            setPresencePenalty(data.generation_settings.presence_penalty ?? 0.0);
            setFrequencyPenalty(data.generation_settings.frequency_penalty ?? 0.0);
        }

        const rawEntries = data.character_book?.entries || [];
        if (Array.isArray(rawEntries)) {
            setLorebookEntries(
                rawEntries.map((e: any) => ({
                    name: e.name || e.comment || "Entry",
                    keys: Array.isArray(e.keys) ? e.keys.join(", ") : String(e.keys || ""),
                    content: e.content || e.description || "",
                    enabled: e.enabled !== false,
                }))
            );
        } else {
            setLorebookEntries([]);
        }
    }, []);

    useEffect(() => {
        if (initialData) {
            populateForm(initialData);
        }
    }, [initialData, populateForm]);

    // Avatar upload
    const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const localBlobUrl = URL.createObjectURL(file);
        setAvatarPreview(localBlobUrl);
        setIsUploadingAvatar(true);

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
                    setPicture(data.picture);
                    setAvatarPreview(data.picture);
                }
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    setPicture(dataUrl);
                    setAvatarPreview(dataUrl);
                };
                reader.readAsDataURL(file);
            }
        } catch {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setPicture(dataUrl);
                setAvatarPreview(dataUrl);
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    // Greetings
    const handleAddGreeting = () => {
        setAlternateGreetings((prev) => [...prev, ""]);
    };

    const handleUpdateGreeting = (idx: number, val: string) => {
        setAlternateGreetings((prev) => {
            const next = [...prev];
            next[idx] = val;
            return next;
        });
    };

    const handleRemoveGreeting = (idx: number) => {
        setAlternateGreetings((prev) => prev.filter((_, i) => i !== idx));
    };

    // Lorebook
    const handleAddLorebookEntry = () => {
        setLorebookEntries((prev) => [
            ...prev,
            { name: "New Entry", keys: "name, keyword", content: "", enabled: true },
        ]);
    };

    const handleUpdateLorebookEntry = (
        idx: number,
        field: "name" | "keys" | "content" | "enabled",
        value: any
    ) => {
        setLorebookEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleRemoveLorebookEntry = (idx: number) => {
        setLorebookEntries((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleCopyLorebookTemplate = (filename: string) => {
        if (!filename) return;
        const tmpl = availableLorebookTemplates.find((l) => l.filename === filename);
        if (!tmpl) return;

        setLorebookEntries((prev) => [
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
        const tmpl = availablePersonaTemplates.find((p) => p.filename === filename);
        if (!tmpl) return;

        if (tmpl.system_prompt || tmpl.description || tmpl.scenario) {
            const combined = tmpl.system_prompt || [tmpl.description || tmpl.personality, tmpl.scenario].filter(Boolean).join("\n\n");
            if (!systemPrompt) setSystemPrompt(combined);
        }
        if (tmpl.first_mes && !firstMes) setFirstMes(tmpl.first_mes);
        if (Array.isArray(tmpl.alternate_greetings) && tmpl.alternate_greetings.length > 0) {
            setAlternateGreetings(tmpl.alternate_greetings);
        }
        if (tmpl.voice) setVoice(tmpl.voice);
        if (tmpl.num_ctx) setNumCtx(tmpl.num_ctx);

        const rawEntries = tmpl.character_book?.entries || [];
        if (Array.isArray(rawEntries) && rawEntries.length > 0) {
            setLorebookEntries((prev) => [
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const payload: PersonaFormData = {
            name: name.trim(),
            description: systemPrompt.trim(),
            personality: systemPrompt.trim(),
            scenario: "",
            system_prompt: systemPrompt.trim(),
            post_history_instructions: "",
            first_mes: firstMes.trim(),
            alternate_greetings: alternateGreetings.filter((g) => g.trim().length > 0),
            voice,
            picture: picture || null,
            num_ctx: Number(numCtx) || 8192,
            generation_settings: {
                temperature: Number(temperature),
                top_p: Number(topP),
                top_k: Number(topK),
                repeat_penalty: Number(repeatPenalty),
                presence_penalty: Number(presencePenalty),
                frequency_penalty: Number(frequencyPenalty),
            },
            character_book: {
                name: `${name.trim()} Lorebook`,
                entries: lorebookEntries.map((e) => ({
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

        await onSave(payload);
    };

    return (
        <div className="mx-auto space-y-8 animate-in fade-in duration-200">
            {/* Header Bar */}
            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer"
                        title="Back"
                    >
                        <ChevronIcon direction="left" className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-bold text-[#202022] tracking-tight">{title}</h3>
                            {badgeText && (
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                    {badgeText}
                                </Badge>
                            )}
                            {extraHeaderBadges}
                        </div>
                        <p className="text-xs text-[#7a7d90] mt-1 font-medium">{subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button type="submit" form="persona-editor-form" disabled={isSaving || !name.trim()}>
                        {isSaving ? "Saving..." : saveButtonLabel}
                    </Button>
                </div>
            </div>

            <form id="persona-editor-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Copy Template Header Bar */}
                {availablePersonaTemplates.length > 0 && (
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
                            {availablePersonaTemplates
                                .filter((t) => t.filename !== currentIdentifier)
                                .map((t) => (
                                    <option key={t.filename} value={t.filename}>
                                        {t.name} ({t.filename})
                                    </option>
                                ))}
                        </select>
                    </div>
                )}

                {/* 1. Identity & Audio Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                    <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">
                        1. Identity &amp; Audio Settings
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <label className="block grid grid-cols-1 md:grid-cols-2 font-bold text-[#5d6075] mb-1">Profile Avatar Image</label>
                            <div className="flex items-center gap-4 bg-[#f9fafc] p-4 rounded-xl border border-[#e8ebf3]">
                                <div className="w-42 h-42 rounded-2xl bg-[#eaecf9] border border-[#7678ed]/30 overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative group">
                                    {avatarPreview || picture ? (
                                        <img src={avatarPreview || picture || ""} alt="Avatar Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl">🎭</span>
                                    )}
                                    {isUploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                                            Converting...
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1.5">
                                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-semibold cursor-pointer transition-all shadow-xs">
                                        <span>{isUploadingAvatar ? "Uploading & Converting..." : "Choose Image File..."}</span>
                                        <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                                    </label>
                                    <p className="text-[11px] text-[#7a7d90]">
                                        Select an image file (.png, .jpg, .webp). Uploaded image automatically saves to avatar storage.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="gap-4 space-y-4">
                            <Input
                                label="Persona / Character Name *"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Sora Assistant"
                                required
                            />
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-[#5d6075]">Default TTS Voice</label>
                                <select
                                    value={voice}
                                    onChange={(e) => setVoice(e.target.value)}
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
                            <Input
                                label="Context Window Size (tokens)"
                                type="number"
                                value={numCtx}
                                onChange={(e) => setNumCtx(Number(e.target.value) || 8192)}
                                placeholder="8192"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. System Prompt Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                    <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">
                        2. System Prompt
                    </h4>
                    <Textarea
                        label="System Prompt *"
                        rows={12}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Core system instructions, character personality, backstory, world scenario, and behavioral constraints..."
                        helperText="Unified system prompt directing the AI character's identity, background, tone, scenario, and output format."
                        className="font-mono text-xs"
                    />
                </div>

                {/* 3. Greetings Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                    <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">
                        3. Greetings &amp; Conversation Openings
                    </h4>

                    <Textarea
                        label="First Greeting Message *"
                        rows={3}
                        value={firstMes}
                        onChange={(e) => setFirstMes(e.target.value)}
                        placeholder="Initial introductory message spoken by this persona when starting a conversation..."
                    />

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[#5d6075]">Alternate Greetings ({alternateGreetings.length})</label>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddGreeting}>
                                <PlusIcon className="w-3.5 h-3.5 mr-1" />
                                Add Alternate Greeting
                            </Button>
                        </div>

                        {alternateGreetings.length === 0 ? (
                            <p className="text-xs text-[#8e90a6] italic">No alternate greetings added. Click Add to create variations.</p>
                        ) : (
                            <div className="space-y-2">
                                {alternateGreetings.map((greeting, idx) => (
                                    <div key={idx} className="flex items-start gap-2 bg-[#f9fafc] p-3 rounded-xl border border-[#e8ebf3]">
                                        <span className="text-[11px] font-bold text-[#7678ed] shrink-0 mt-2">#{idx + 1}</span>
                                        <Textarea
                                            rows={2}
                                            value={greeting}
                                            onChange={(e) => handleUpdateGreeting(idx, e.target.value)}
                                            placeholder={`Alternate greeting variation #${idx + 1}...`}
                                            className="flex-1 bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGreeting(idx)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mt-1 cursor-pointer"
                                            title="Delete greeting"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Sampler Settings Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                    <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider border-b border-[#e8ebf3] pb-2">
                        4. Sampler &amp; Generation Settings
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                            label="Temperature"
                            type="number"
                            step="0.05"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                            helperText="Controls randomness. Lower values (0.2–0.5) are focused and coherent; higher values (0.7–1.2) increase creativity."
                        />
                        <Input
                            label="Top P"
                            type="number"
                            step="0.05"
                            value={topP}
                            onChange={(e) => setTopP(parseFloat(e.target.value) || 0.9)}
                            helperText="Nucleus sampling threshold. Evaluates only tokens within top cumulative probability (e.g. 0.9 = top 90%)."
                        />
                        <Input
                            label="Top K"
                            type="number"
                            value={topK}
                            onChange={(e) => setTopK(parseInt(e.target.value, 10) || 40)}
                            helperText="Limits candidate tokens to the K highest probabilities. Lower values reduce chaotic outputs; 0 disables."
                        />
                        <Input
                            label="Repeat Penalty"
                            type="number"
                            step="0.05"
                            value={repeatPenalty}
                            onChange={(e) => setRepeatPenalty(parseFloat(e.target.value) || 1.1)}
                            helperText="Penalizes recently used tokens to prevent word repetition and loops (1.0 = none, 1.1–1.2 = recommended)."
                        />
                        <Input
                            label="Presence Penalty"
                            type="number"
                            step="0.05"
                            value={presencePenalty}
                            onChange={(e) => setPresencePenalty(parseFloat(e.target.value) || 0.0)}
                            helperText="Encourages introducing new topics by penalizing tokens that have appeared in the output at all (-2.0 to 2.0)."
                        />
                        <Input
                            label="Frequency Penalty"
                            type="number"
                            step="0.05"
                            value={frequencyPenalty}
                            onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value) || 0.0)}
                            helperText="Reduces verbatim repetition based on how often tokens already appeared in the output (-2.0 to 2.0)."
                        />
                    </div>
                </div>

                {/* 5. Embedded Lorebook Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e8ebf3] pb-3">
                        <div>
                            <h4 className="text-sm font-bold text-[#7678ed] uppercase tracking-wider">
                                5. Embedded Character Lorebook ({lorebookEntries.length})
                            </h4>
                            <p className="text-xs text-[#7a7d90] mt-0.5">
                                Keyword-triggered world information automatically injected into chat context.
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddLorebookEntry}>
                            <PlusIcon className="w-3.5 h-3.5 mr-1" />
                            Add Lore Entry
                        </Button>
                    </div>

                    {availableLorebookTemplates.length > 0 && (
                        <div className="p-3 bg-[#eaecf9]/30 rounded-xl border border-[#7678ed]/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-[#202022]">Import entries from standalone Lorebook template:</span>
                            <select
                                onChange={(e) => {
                                    handleCopyLorebookTemplate(e.target.value);
                                    e.target.value = "";
                                }}
                                defaultValue=""
                                className="bg-white border border-[#e8ebf3] rounded-xl px-3 py-1.5 text-xs text-[#202022] outline-none focus:border-[#7678ed] cursor-pointer"
                            >
                                <option value="" disabled>
                                    Select template to insert...
                                </option>
                                {availableLorebookTemplates.map((l) => (
                                    <option key={l.filename} value={l.filename}>
                                        {l.name} ({l.filename})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {lorebookEntries.length === 0 ? (
                        <p className="text-xs text-[#8e90a6] italic p-4 text-center bg-[#f9fafc] rounded-xl border border-[#e8ebf3]">
                            No embedded lorebook entries. Click Add Lore Entry to configure triggered lore.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {lorebookEntries.map((entry, idx) => (
                                <div key={idx} className="p-4 bg-[#f9fafc] rounded-2xl border border-[#e8ebf3] space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-xs font-bold text-[#7678ed]">#{idx + 1}</span>
                                            <input
                                                type="text"
                                                value={entry.name}
                                                onChange={(e) => handleUpdateLorebookEntry(idx, "name", e.target.value)}
                                                placeholder="Entry Name (e.g. Magic Sword)"
                                                className="font-bold text-xs bg-white border border-[#e8ebf3] rounded-lg px-2.5 py-1 text-[#202022] outline-none focus:border-[#7678ed] flex-1 max-w-xs"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 text-xs text-[#5d6075] cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={entry.enabled}
                                                    onChange={(e) => handleUpdateLorebookEntry(idx, "enabled", e.target.checked)}
                                                    className="rounded border-[#e8ebf3] text-[#7678ed] focus:ring-[#7678ed] cursor-pointer"
                                                />
                                                <span>Enabled</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLorebookEntry(idx)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                title="Remove entry"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <Input
                                        label="Trigger Keywords (comma-separated)"
                                        value={entry.keys}
                                        onChange={(e) => handleUpdateLorebookEntry(idx, "keys", e.target.value)}
                                        placeholder="sword, excalibur, blade, weapon"
                                        className="bg-white"
                                    />

                                    <Textarea
                                        label="Lore Entry Content"
                                        rows={7}
                                        value={entry.content}
                                        onChange={(e) => handleUpdateLorebookEntry(idx, "content", e.target.value)}
                                        placeholder="Information automatically passed to the model when trigger keywords appear in conversation..."
                                        className="bg-white"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Save / Cancel Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e8ebf3]">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving || !name.trim()}>
                        {isSaving ? "Saving..." : saveButtonLabel}
                    </Button>
                </div>
            </form>
        </div>
    );
}
