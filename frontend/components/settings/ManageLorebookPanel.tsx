import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input, Textarea } from "../ui/Input";
import { PlusIcon, EditIcon, TrashIcon, SearchIcon } from "../icons/Icons";
import { LorebookTemplate } from "./ManagePersonasPanel";

export interface ManageLorebookPanelProps {
    lorebookTemplates: LorebookTemplate[];
    isLorebookLoading: boolean;
    getApiUrl: () => string;
    fetchLorebookTemplates: () => Promise<void>;
}

export const ManageLorebookPanel: React.FC<ManageLorebookPanelProps> = ({ lorebookTemplates, isLorebookLoading, getApiUrl, fetchLorebookTemplates }) => {
    const [lorebookSearchQuery, setLorebookSearchQuery] = useState<string>("");
    const [isLorebookModalOpen, setIsLorebookModalOpen] = useState<boolean>(false);
    const [editingLorebookTemplate, setEditingLorebookTemplate] = useState<LorebookTemplate | null>(null);
    const [lorebookFormName, setLorebookFormName] = useState<string>("");
    const [lorebookFormKeys, setLorebookFormKeys] = useState<string>("");
    const [lorebookFormContent, setLorebookFormContent] = useState<string>("");
    const [lorebookSaving, setLorebookSaving] = useState<boolean>(false);
    const [deletingLorebookTemplate, setDeletingLorebookTemplate] = useState<LorebookTemplate | null>(null);

    const handleOpenCreateLorebookModal = () => {
        setEditingLorebookTemplate(null);
        setLorebookFormName("");
        setLorebookFormKeys("");
        setLorebookFormContent("");
        setIsLorebookModalOpen(true);
    };

    const handleOpenEditLorebookModal = (template: LorebookTemplate) => {
        setEditingLorebookTemplate(template);
        setLorebookFormName(template.name);
        setLorebookFormKeys(Array.isArray(template.keys) ? template.keys.join(", ") : "");
        setLorebookFormContent(template.content || "");
        setIsLorebookModalOpen(true);
    };

    const handleSaveLorebookTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lorebookFormName.trim()) return;

        setLorebookSaving(true);
        try {
            const keysArray = lorebookFormKeys
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);

            const payload: any = {
                name: lorebookFormName.trim(),
                keys: keysArray,
                content: lorebookFormContent,
            };

            let url = `${getApiUrl()}/lorebook`;
            let method = "POST";

            if (editingLorebookTemplate) {
                url = `${getApiUrl()}/lorebook/${encodeURIComponent(editingLorebookTemplate.filename)}`;
                method = "PUT";
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setIsLorebookModalOpen(false);
                fetchLorebookTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed saving lorebook template");
            }
        } catch (err: any) {
            console.error("Error saving lorebook template:", err);
            alert(err.message || "Error saving template");
        } finally {
            setLorebookSaving(false);
        }
    };

    const handleConfirmDeleteLorebookTemplate = async () => {
        if (!deletingLorebookTemplate) return;

        try {
            const filename = deletingLorebookTemplate.filename;
            const res = await fetch(`${getApiUrl()}/lorebook/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDeletingLorebookTemplate(null);
                fetchLorebookTemplates();
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed deleting lorebook template");
            }
        } catch (err: any) {
            console.error("Error deleting lorebook template:", err);
            alert(err.message || "Error deleting template");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 pb-8">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-white border border-[#e8ebf3] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-[#202022] tracking-tight">Manage Lorebook Templates</h3>
                    <p className="text-sm text-[#7a7d90] mt-1 font-medium">
                        Create, view, and edit reusable character books and lore items stored as JSON files in the lorebook folder.
                    </p>
                </div>

                <button
                    onClick={handleOpenCreateLorebookModal}
                    className="p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                    title="Add Instance"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <input
                    type="text"
                    value={lorebookSearchQuery}
                    onChange={(e) => setLorebookSearchQuery(e.target.value)}
                    placeholder="Search lorebook templates by character name or keywords..."
                    className="w-full bg-white border border-[#e8ebf3] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#202022] placeholder-[#a0a3b5] outline-none focus:border-[#7678ed] transition-all shadow-xs"
                />
                <SearchIcon className="absolute left-4 top-3.5 text-[#a0a3b5] w-4 h-4" />
            </div>

            {/* Cards Grid */}
            {isLorebookLoading ? (
                <div className="p-12 text-center text-[#7a7d90] font-medium animate-pulse bg-white rounded-2xl border border-[#e8ebf3]">Loading lorebook templates...</div>
            ) : (
                (() => {
                    const filtered = lorebookTemplates.filter((l) => {
                        const q = lorebookSearchQuery.toLowerCase().trim();
                        if (!q) return true;
                        const nameMatch = l.name.toLowerCase().includes(q);
                        const fileMatch = l.filename.toLowerCase().includes(q);
                        const keysMatch = Array.isArray(l.keys) && l.keys.some((k) => k.toLowerCase().includes(q));
                        return nameMatch || fileMatch || keysMatch;
                    });

                    if (filtered.length === 0) {
                        return (
                            <div className="p-12 text-center bg-white rounded-2xl border border-[#e8ebf3] space-y-3">
                                <h4 className="font-bold text-[#202022] text-base">No lorebook templates found</h4>
                                <p className="text-xs text-[#7a7d90] max-w-sm mx-auto">
                                    {lorebookSearchQuery ? "No templates match your search filter." : "No lorebook JSON files exist in the lorebook directory."}
                                </p>
                                {!lorebookSearchQuery && (
                                    <Button variant="primary" size="sm" onClick={handleOpenCreateLorebookModal}>
                                        Create Lorebook Template
                                    </Button>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filtered.map((tmpl) => (
                                <div
                                    key={tmpl.filename}
                                    className="p-5 bg-white rounded-2xl border border-[#e8ebf3] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#7678ed]/40 transition-all"
                                >
                                    <div className="space-y-3">
                                        <div>
                                            <h4 className="font-bold text-[#202022] text-base leading-snug">{tmpl.name}</h4>
                                            <span className="text-[11px] font-mono text-[#a0a3b5] block mt-0.5">{tmpl.filename}</span>
                                        </div>

                                        <div>
                                            <span className="text-[11px] font-bold text-[#a0a3b5] uppercase tracking-wider block mb-1.5">Trigger Keys</span>
                                            {Array.isArray(tmpl.keys) && tmpl.keys.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tmpl.keys.map((key, idx) => (
                                                        <Badge key={idx} variant="primary">
                                                            {key}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-[#a0a3b5] italic">No trigger keys set</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={"flex items-center justify-between pt-3 border-t border-[#e8ebf3] gap-2 justify-end"}>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleOpenEditLorebookModal(tmpl)}
                                                className="p-1.5 text-[#7a7d90] hover:text-[#7678ed] transition-colors rounded-lg hover:bg-[#eaecf9]"
                                                title="Edit"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingLorebookTemplate(tmpl)}
                                                className="p-1.5 text-[#7a7d90] hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()
            )}

            {/* Modal: Create/Edit Lorebook */}
            {isLorebookModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">{editingLorebookTemplate ? "Edit Lorebook Template" : "New Lorebook Template"}</h3>
                            <button onClick={() => setIsLorebookModalOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors cursor-pointer">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveLorebookTemplate} className="space-y-4">
                            <Input
                                label="Character / Template Name"
                                required
                                value={lorebookFormName}
                                onChange={(e) => setLorebookFormName(e.target.value)}
                                placeholder="e.g., John Doe"
                                className="!bg-white/10 !border-white/15 !text-white"
                            />
                            <Input
                                label="Trigger Keywords (comma-separated)"
                                value={lorebookFormKeys}
                                onChange={(e) => setLorebookFormKeys(e.target.value)}
                                placeholder="e.g., john, john doe, protagonist"
                                className="!bg-white/10 !border-white/15 !text-white !font-mono"
                            />
                            <Textarea
                                label="Lorebook Content / Lore Info"
                                rows={5}
                                value={lorebookFormContent}
                                onChange={(e) => setLorebookFormContent(e.target.value)}
                                placeholder="Enter detailed character background or world lore..."
                                className="!bg-white/10 !border-white/15 !text-white"
                            />

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                <Button type="button" variant="ghost" onClick={() => setIsLorebookModalOpen(false)} className="text-white/70 hover:text-white">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" isLoading={lorebookSaving} disabled={!lorebookFormName.trim()}>
                                    Save Lorebook
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingLorebookTemplate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
                    <div className="bg-[#202022] text-white border border-white/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-rose-400 mb-2">Delete Lorebook Template?</h3>
                        <p className="text-sm text-white/70 leading-relaxed mb-6">
                            Are you sure you want to delete <strong className="text-white">"{deletingLorebookTemplate.name}"</strong> (
                            <span className="font-mono text-xs text-white/50">{deletingLorebookTemplate.filename}</span>)? Action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={() => setDeletingLorebookTemplate(null)} className="text-white/70 hover:text-white">
                                Cancel
                            </Button>
                            <Button type="button" variant="danger" onClick={handleConfirmDeleteLorebookTemplate}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
