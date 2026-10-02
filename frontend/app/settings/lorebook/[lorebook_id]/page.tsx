"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { getApiUrl } from "@/lib/api";
import { SettingsSidebar, SettingsCategory } from "@/components/settings/SettingsSidebar";
import { SettingsHelpSidebar } from "@/components/settings/SettingsHelpSidebar";
import { LorebookTemplate } from "@/components/settings/ManagePersonasPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ChevronIcon } from "@/components/icons/Icons";

interface EditLorebookPageProps {
    params: Promise<{ lorebook_id: string }>;
}

export default function EditLorebookPage({ params }: EditLorebookPageProps) {
    const router = useRouter();
    const resolvedParams = use(params);
    const rawLorebookId = resolvedParams.lorebook_id;
    const decodedId = decodeURIComponent(rawLorebookId);

    const { setCurrentView } = useAppStore();
    const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("manage-lorebook");

    const [lorebookTemplate, setLorebookTemplate] = useState<LorebookTemplate | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState<string>("");
    const [keys, setKeys] = useState<string>("");
    const [content, setContent] = useState<string>("");

    useEffect(() => {
        let isMounted = true;
        const fetchLorebook = async () => {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                const res = await fetch(`${getApiUrl()}/lorebook`);
                if (!res.ok) {
                    throw new Error(`Failed to load lorebooks: HTTP ${res.status}`);
                }
                const data: LorebookTemplate[] = await res.json();
                if (!isMounted) return;

                const match = data.find(
                    (l) =>
                        l.filename === decodedId ||
                        l.name === decodedId ||
                        l.filename.toLowerCase() === decodedId.toLowerCase() ||
                        l.filename === `${decodedId}.json`
                );

                if (!match) {
                    setErrorMessage(`Lorebook template "${decodedId}" not found.`);
                    setLorebookTemplate(null);
                } else {
                    setLorebookTemplate(match);
                    setName(match.name || "");
                    setKeys(Array.isArray(match.keys) ? match.keys.join(", ") : (match.keys as unknown as string) || "");
                    setContent(match.content || "");
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : "Error loading lorebook";
                    setErrorMessage(message);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchLorebook();
        return () => {
            isMounted = false;
        };
    }, [decodedId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage("Character / Template Name is required.");
            return;
        }

        if (!lorebookTemplate) return;

        setIsSaving(true);
        setErrorMessage(null);
        setSaveSuccessMessage(null);

        try {
            const keysArray = keys
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);

            const payload = {
                name: name.trim(),
                keys: keysArray,
                content: content,
            };

            const url = `${getApiUrl()}/lorebook/${encodeURIComponent(lorebookTemplate.filename)}`;
            const res = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to update lorebook template");
            }

            setSaveSuccessMessage("Lorebook template updated successfully!");
            setTimeout(() => {
                router.push("/settings/lorebook");
            }, 600);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error saving lorebook template";
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const parsedKeys = keys
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

    return (
        <div className="flex-1 flex overflow-hidden bg-white rounded-l-[32px] select-text">
            {/* 1. SETTINGS CATEGORIES SIDEBAR */}
            <SettingsSidebar activeSettingsCategory={activeSettingsCategory} setActiveSettingsCategory={setActiveSettingsCategory} setCurrentView={setCurrentView} />

            {/* 2. MAIN CONTENT AREA */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-6 pb-12">
                    {/* Header Bar */}
                    <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/settings/lorebook")}
                                className="p-2 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] transition-all cursor-pointer"
                                title="Back to Lorebook Templates List"
                            >
                                <ChevronIcon direction="left" className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">
                                        Edit Lorebook: {lorebookTemplate?.name || lorebookTemplate?.filename || rawLorebookId}
                                    </h3>
                                    {lorebookTemplate?.filename && (
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            {lorebookTemplate.filename}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-[#7a7d90] mt-1 font-medium">Update trigger keywords, description, and character lore notes stored in this template.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button type="submit" form="edit-persona-form" disabled={isSaving || !lorebookTemplate?.name.trim()}>
                                {isSaving ? "Saving..." : "Save Lore"}
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    {errorMessage && (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
                            <span>{errorMessage}</span>
                            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
                                ✕
                            </button>
                        </div>
                    )}

                    {saveSuccessMessage && <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{saveSuccessMessage}</div>}

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">Loading lorebook template...</div>
                    ) : !lorebookTemplate ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-4">
                            <h4 className="font-bold text-[#202022] text-lg">Lorebook Not Found</h4>
                            <p className="text-sm text-[#7a7d90]">Could not find a lorebook template matching &ldquo;{decodedId}&rdquo;.</p>
                            <Button variant="primary" onClick={() => router.push("/settings/lorebook")}>
                                Return to Lorebook List
                            </Button>
                        </div>
                    ) : (
                        /* Edit Form */
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="bg-white rounded-2xl border border-[#e8ebf3] shadow-xs p-6 space-y-6">
                                <h4 className="text-base font-bold text-[#202022] pb-3 border-b border-[#e8ebf3]">Lorebook Details</h4>

                                <div className="space-y-4">
                                    <Input label="Character / Template Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., John Doe" />

                                    <div>
                                        <Input
                                            label="Trigger Keywords (comma-separated)"
                                            value={keys}
                                            onChange={(e) => setKeys(e.target.value)}
                                            placeholder="e.g., john, john doe, protagonist"
                                            className="font-mono text-xs"
                                        />
                                        {parsedKeys.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {parsedKeys.map((k, i) => (
                                                    <Badge key={i} variant="primary">
                                                        {k}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Textarea
                                        label="Lorebook Content / Lore Info"
                                        rows={10}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Enter detailed character background or world lore..."
                                    />
                                </div>
                            </div>

                            {/* Action Bar */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button type="button" variant="ghost" onClick={() => router.push("/settings/lorebook")} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={isSaving} disabled={!name.trim() || isSaving}>
                                    Save Lorebook
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </main>

            {/* 3. RIGHT SIDEBAR */}
            <SettingsHelpSidebar activeSettingsCategory={activeSettingsCategory} />
        </div>
    );
}
