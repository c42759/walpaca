"use client";

import React, { useRef, useEffect } from "react";
import { BrainIcon } from "../icons/Icons";

export interface SelectedAttachment {
    id: string;
    name: string;
    type: "image" | "plain_text" | "code" | "audio";
    content: string;
    size?: number;
    extension?: string;
}

export interface ChatInputProps {
    inputText: string;
    setInputText: (text: string) => void;
    handleSendMessage: (e: React.FormEvent) => void | Promise<void>;
    selectedAttachments: SelectedAttachment[];
    handleAttachmentSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleRemoveSelectedAttachment: (index: number) => void;
    isThinkingEnabled: boolean;
    setIsThinkingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSelectModelModalOpen: (open: boolean) => void;
    selectedChatInstanceId: string;
    selectedChatModelId: string;
    instances: Array<{ id: string; properties?: { name?: string }; type?: string }>;
    modelPreferences: Record<string, { id?: string; character?: unknown; name?: string }>;
    instanceModelsList: Array<{ id: string; name?: string }>;
    getCharacterName?: (char?: unknown) => string | undefined;
    promptTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
    autoResizeTextarea?: (el: HTMLTextAreaElement | null) => void;
}

const defaultAutoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = typeof window !== "undefined" ? window.innerHeight * 0.3 : 240;
    if (el.scrollHeight > maxHeight) {
        el.style.height = `${maxHeight}px`;
        el.style.overflowY = "auto";
    } else {
        el.style.height = `${el.scrollHeight}px`;
        el.style.overflowY = "hidden";
    }
};

const defaultGetCharacterName = (char?: unknown): string | undefined => {
    if (!char || typeof char !== "object") return undefined;
    const c = char as { name?: string; data?: { name?: string } };
    if (c.data && c.data.name && String(c.data.name).trim()) {
        return String(c.data.name).trim();
    }
    if (c.name && String(c.name).trim()) {
        return String(c.name).trim();
    }
    return undefined;
};

export const ChatInput: React.FC<ChatInputProps> = ({
    inputText,
    setInputText,
    handleSendMessage,
    selectedAttachments,
    handleAttachmentSelect,
    handleRemoveSelectedAttachment,
    isThinkingEnabled,
    setIsThinkingEnabled,
    setIsSelectModelModalOpen,
    selectedChatInstanceId,
    selectedChatModelId,
    instances,
    modelPreferences,
    instanceModelsList,
    getCharacterName = defaultGetCharacterName,
    promptTextareaRef,
    autoResizeTextarea = defaultAutoResizeTextarea,
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (promptTextareaRef && "current" in promptTextareaRef) {
            promptTextareaRef.current = internalTextareaRef.current;
        }
    });

    const selectedInst = instances.find((i) => i.id === selectedChatInstanceId);
    const selectedInstName = selectedInst?.properties?.name || selectedInst?.type || "Instance";
    const selectedPrefKey = (selectedChatModelId || "").toLowerCase();
    const selectedPref =
        modelPreferences[selectedChatModelId] || modelPreferences[selectedPrefKey] || Object.values(modelPreferences).find((p) => p.id?.toLowerCase() === selectedPrefKey);

    let selectedModelName = selectedChatModelId;
    if (selectedPref) {
        selectedModelName = getCharacterName(selectedPref.character) || selectedPref.name || selectedPref.id || selectedChatModelId;
    } else if (selectedChatModelId) {
        const instMod = instanceModelsList.find((m) => m.id === selectedChatModelId);
        if (instMod) {
            selectedModelName = instMod.name || instMod.id;
        }
    }

    if (!selectedModelName) {
        selectedModelName = "Select Model";
    }

    return (
        <form onSubmit={handleSendMessage} className="p-4 px-8 border-t border-[#eef0f6] bg-white flex flex-col gap-3">
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*,.mp3,.wav,audio/*,.txt,.md,.css,.js,.jsx,.ts,.tsx,.php,.py,.html,.json,.xml,.csv,.c,.cpp,.h,.hpp,.cs,.java,.rb,.rs,.go,.sql,.sh,.yaml,.yml,.dockerfile,.env,.odt,.docx,.pptx,.pdf"
                multiple
                onChange={handleAttachmentSelect}
                className="hidden"
            />

            {/* Attachments Preview Strip */}
            {selectedAttachments.length > 0 && (
                <div className="flex items-center gap-3 px-1 py-1.5 overflow-x-auto w-full border-b border-[#eef0f6]/60 pb-3">
                    {selectedAttachments.map((att, idx) =>
                        att.type === "image" ? (
                            <div key={att.id || idx} className="relative group w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#e2e5f1] shadow-xs bg-[#f4f6fc]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={att.content} alt={att.name || `Selected ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSelectedAttachment(idx)}
                                    className="absolute top-1 right-1 bg-black/60 hover:bg-[#ff4d4f] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shadow-sm"
                                    title="Remove image"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ) : att.type === "audio" ? (
                            <div
                                key={att.id || idx}
                                className="relative group flex items-center gap-2.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all shrink-0 max-w-[240px] shadow-2xs"
                            >
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                                    {att.extension || "mp3"}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1 pr-1">
                                    <span className="text-xs font-semibold text-[#2d3142] truncate" title={att.name}>
                                        {att.name}
                                    </span>
                                    <span className="text-[10px] text-[#8e90a6] font-medium">
                                        {att.size ? (att.size > 1024 * 1024 ? `${(att.size / (1024 * 1024)).toFixed(1)} MB` : `${(att.size / 1024).toFixed(1)} KB`) : "Audio"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSelectedAttachment(idx)}
                                    className="text-[#8e90a6] hover:text-[#ff4d4f] p-1 rounded-full hover:bg-black/5 transition-all cursor-pointer shrink-0"
                                    title="Remove audio attachment"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div
                                key={att.id || idx}
                                className="relative group flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#7678ed]/30 bg-[#7678ed]/5 hover:bg-[#7678ed]/10 transition-all shrink-0 max-w-[220px] shadow-2xs"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[#7678ed]/15 text-[#7678ed] flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                                    {att.extension || "txt"}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1 pr-1">
                                    <span className="text-xs font-semibold text-[#2d3142] truncate" title={att.name}>
                                        {att.name}
                                    </span>
                                    <span className="text-[10px] text-[#8e90a6] font-medium">{att.size ? `${(att.size / 1024).toFixed(1)} KB` : "Document"}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSelectedAttachment(idx)}
                                    className="text-[#8e90a6] hover:text-[#ff4d4f] p-1 rounded-full hover:bg-black/5 transition-all cursor-pointer shrink-0"
                                    title="Remove attachment"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ),
                    )}
                    {selectedAttachments.length < 4 && (
                        <span className="text-xs text-[#8e90a6] font-medium ml-1 select-none whitespace-nowrap">{selectedAttachments.length}/4 attachments</span>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2.5 w-full">
                {/* Combined Model & Instance Selector Button */}
                <button
                    type="button"
                    onClick={() => setIsSelectModelModalOpen(true)}
                    className="group relative shrink-0 flex items-center bg-[#f0f2f9] border border-[#e8ebf3] rounded-2xl p-2.5 hover:px-3.5 hover:bg-[#eaecf9] transition-all duration-300 ease-in-out shadow-xs cursor-pointer text-xs font-bold text-[#202022] max-w-[42px] hover:max-w-[340px] overflow-hidden"
                    title={`Model: ${selectedModelName} @ ${selectedInstName}`}
                >
                    <div className="flex items-center gap-2 pl-1 shrink-0">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[#7678ed] shrink-0"
                        >
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        <div className="flex items-center gap-1.5 opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[280px] transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                            <span className="truncate">{selectedModelName}</span>
                            <span className="text-[#8e90a6] font-semibold">@</span>
                            <span className="text-[#7678ed] truncate">{selectedInstName}</span>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#8e90a6"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="ml-0.5 shrink-0 group-hover:text-[#202022] transition-colors"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                    </div>
                </button>

                {/* 3. Thinking Mode Brain Toggle Button */}
                <button
                    type="button"
                    onClick={() => setIsThinkingEnabled((prev) => !prev)}
                    className={`p-2.5 rounded-2xl transition-all cursor-pointer shrink-0 border flex items-center justify-center ${
                        isThinkingEnabled
                            ? "bg-[#7678ed]/10 border-[#7678ed] text-[#7678ed] opacity-100 shadow-xs"
                            : "bg-[#f0f2f9] border-[#e8ebf3] text-[#8e90a6] hover:bg-[#eaecf9] opacity-40 hover:opacity-70"
                    }`}
                    title={isThinkingEnabled ? "Thinking Mode Enabled (think=True)" : "Thinking Mode Disabled (click to enable)"}
                >
                    <BrainIcon className="w-5 h-5" />
                </button>

                {/* Attach file button */}
                <button
                    type="button"
                    disabled={selectedAttachments.length >= 4}
                    onClick={() => {
                        if (selectedAttachments.length < 4) {
                            fileInputRef.current?.click();
                        }
                    }}
                    className="p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#8e90a6] disabled:hover:bg-transparent"
                    title={selectedAttachments.length >= 4 ? "Maximum 4 attachments reached" : "Attach file (Max 4 attachments)"}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                </button>

                <textarea
                    ref={(el) => {
                        internalTextareaRef.current = el;
                        if (autoResizeTextarea) {
                            autoResizeTextarea(el);
                        }
                    }}
                    rows={1}
                    placeholder="Write a message..."
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        if (autoResizeTextarea) {
                            autoResizeTextarea(e.currentTarget);
                        }
                    }}
                    onInput={(e) => {
                        if (autoResizeTextarea) {
                            autoResizeTextarea(e.currentTarget);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (inputText.trim() || selectedAttachments.length > 0) {
                                handleSendMessage(e);
                            }
                        }
                    }}
                    className="flex-1 bg-[#f0f2f9] text-[#202022] placeholder-[#8e90a6] rounded-2xl px-5 py-3.5 text-lg outline-none focus:ring-2 focus:ring-[#7678ed]/30 transition-all font-medium resize-none overflow-hidden max-h-[30vh]"
                />

                <button type="button" className="p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors shrink-0" title="Emoji">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                </button>

                <button
                    type="submit"
                    className="w-11 h-11 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-[#7678ed]/30 shrink-0"
                    title="Send"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </form>
    );
};
