"use client";

import React, { useRef, useEffect, useState } from "react";
import { BrainIcon, PromptIcon, MicIcon, UploadIcon, CloseIcon } from "../icons/Icons";
import { getApiUrl } from "@/lib/api";

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
    onFilesAdded?: (files: File[]) => void;
    isThinkingEnabled: boolean;
    setIsThinkingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSelectModelModalOpen: (open: boolean) => void;
    onOpenCustomPromptsModal?: () => void;
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
    onFilesAdded,
    isThinkingEnabled,
    setIsThinkingEnabled,
    setIsSelectModelModalOpen,
    onOpenCustomPromptsModal,
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
    const audioFileInputRef = useRef<HTMLInputElement | null>(null);
    const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const dragCounterRef = useRef(0);

    // Voice Recording & Audio Transcription States
    const [isMicMenuOpen, setIsMicMenuOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribeError, setTranscribeError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const sendAudioForTranscription = async (fileOrBlob: Blob, filename = "recording.webm") => {
        setIsTranscribing(true);
        setTranscribeError(null);
        try {
            const formData = new FormData();
            formData.append("file", fileOrBlob, filename);

            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/stt`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || `Transcription failed (HTTP ${res.status})`);
            }

            const data = await res.json();
            const text = (data.text || "").trim();
            if (text) {
                setInputText(inputText ? `${inputText} ${text}` : text);
                setTimeout(() => {
                    const el = promptTextareaRef?.current || internalTextareaRef.current;
                    if (el) {
                        autoResizeTextarea(el);
                        el.focus();
                    }
                }, 50);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to transcribe audio";
            setTranscribeError(msg);
            setTimeout(() => setTranscribeError(null), 5000);
        } finally {
            setIsTranscribing(false);
        }
    };

    const startRecording = async () => {
        setIsMicMenuOpen(false);
        setTranscribeError(null);
        try {
            if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access is not supported in this browser");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            let mimeType = "audio/webm;codecs=opus";
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "";
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.start(250);
            setIsRecording(true);
            setRecordingSeconds(0);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setRecordingSeconds((prev) => prev + 1);
            }, 1000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Could not access microphone";
            setTranscribeError(msg);
            setTimeout(() => setTranscribeError(null), 5000);
        }
    };

    const stopRecording = (shouldTranscribe = true) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = () => {
                if (shouldTranscribe && audioChunksRef.current.length > 0) {
                    const mimeType = recorder.mimeType || "audio/webm";
                    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    sendAudioForTranscription(audioBlob, `voice-recording.${ext}`);
                }
                audioChunksRef.current = [];
            };
            recorder.stop();
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        setIsRecording(false);
        setRecordingSeconds(0);
    };

    const cancelRecording = () => {
        stopRecording(false);
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsMicMenuOpen(false);
        const file = e.target.files?.[0];
        if (file) {
            sendAudioForTranscription(file, file.name);
        }
        e.target.value = "";
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (!onFilesAdded) return;
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const imageFiles: File[] = [];

        if (clipboardData.files && clipboardData.files.length > 0) {
            for (let i = 0; i < clipboardData.files.length; i++) {
                const file = clipboardData.files[i];
                if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(file.name)) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
            for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        const filename =
                            file.name && file.name !== "image.png" && file.name !== "blob"
                                ? file.name
                                : `clipboard-${Date.now()}.png`;
                        const renamedFile = new File([file], filename, { type: file.type });
                        imageFiles.push(renamedFile);
                    }
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            onFilesAdded(imageFiles);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
            setIsDraggingOver(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDraggingOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDraggingOver(false);

        if (onFilesAdded && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            onFilesAdded(files);
        }
    };

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
        <form
            onSubmit={handleSendMessage}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative p-2.5 sm:p-4 px-3 sm:px-6 md:px-8 border-t border-[#eef0f6] bg-white flex flex-col gap-2 sm:gap-3 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))]"
        >
            {/* Drag and Drop Overlay */}
            {isDraggingOver && (
                <div className="absolute inset-0 z-20 m-1.5 sm:m-2 rounded-2xl border-2 border-dashed border-[#7678ed] bg-white/95 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-[#7678ed] shadow-lg pointer-events-none transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#7678ed]/15 flex items-center justify-center shrink-0">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                    </div>
                    <div className="flex flex-col text-center sm:text-left">
                        <span className="text-sm font-bold text-[#202022]">Drop files or images here</span>
                        <span className="text-xs text-[#8e90a6] font-medium">Attach directly to your next message</span>
                    </div>
                </div>
            )}
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

            {/* Transcribing Banner or Error Toast */}
            {isTranscribing && (
                <div className="mb-2 px-3.5 py-2 rounded-xl bg-[#7678ed]/10 border border-[#7678ed]/20 text-xs sm:text-sm font-semibold text-[#7678ed] flex items-center gap-2 animate-in fade-in duration-200">
                    <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                    <span>Transcribing audio with Whisper...</span>
                </div>
            )}
            {transcribeError && (
                <div className="mb-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm font-semibold text-rose-600 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                    <span className="truncate">{transcribeError}</span>
                    <button
                        type="button"
                        onClick={() => setTranscribeError(null)}
                        className="p-1 hover:text-rose-800 transition-colors cursor-pointer shrink-0"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2.5 w-full">
                {/* Combined Model & Instance Selector Button */}
                <button
                    type="button"
                    onClick={() => setIsSelectModelModalOpen(true)}
                    className="group relative shrink-0 flex items-center bg-[#f0f2f9] border border-[#e8ebf3] rounded-2xl p-2 sm:p-2.5 hover:px-3 hover:bg-[#eaecf9] transition-all duration-300 ease-in-out shadow-xs cursor-pointer text-xs font-bold text-[#202022] max-w-[125px] sm:max-w-[160px] md:max-w-[42px] md:hover:max-w-[340px] overflow-hidden"
                    title={`Model: ${selectedModelName} @ ${selectedInstName}`}
                >
                    <div className="flex items-center gap-1.5 sm:gap-2 pl-0.5 sm:pl-1 shrink-0">
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
                        <div className="flex items-center gap-1.5 opacity-100 max-w-[85px] sm:max-w-[120px] md:opacity-0 md:max-w-0 md:group-hover:opacity-100 md:group-hover:max-w-[280px] transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
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

                {isRecording ? (
                    <div className="flex-1 bg-[#f0f2f9] text-[#202022] rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 animate-in fade-in duration-200 min-h-[44px] sm:min-h-[52px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shrink-0" />
                            <span className="font-semibold text-sm sm:text-base text-rose-600 shrink-0">
                                Recording
                            </span>
                            <span className="text-xs sm:text-sm font-mono text-[#5d6075] bg-white/80 px-2 py-0.5 rounded-md border border-[#e2e5f1] shrink-0">
                                {formatRecordingTime(recordingSeconds)}
                            </span>
                            <span className="text-xs text-[#8e90a6] hidden sm:inline truncate">
                                Speak into your microphone...
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={cancelRecording}
                                className="px-2.5 py-1 text-xs font-semibold text-[#8e90a6] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Cancel recording"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => stopRecording(true)}
                                className="px-3 py-1 bg-[#7678ed] hover:bg-[#6869d9] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                title="Done and transcribe"
                            >
                                Transcribe
                            </button>
                        </div>
                    </div>
                ) : (
                    <textarea
                        ref={(el) => {
                            internalTextareaRef.current = el;
                            if (autoResizeTextarea) {
                                autoResizeTextarea(el);
                            }
                            if (promptTextareaRef) {
                                (promptTextareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                            }
                        }}
                        rows={1}
                        placeholder={isTranscribing ? "Transcribing audio..." : "Write a message..."}
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
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (inputText.trim() || selectedAttachments.length > 0) {
                                    handleSendMessage(e);
                                }
                            }
                        }}
                        disabled={isTranscribing}
                        className="flex-1 bg-[#f0f2f9] text-[#202022] placeholder-[#8e90a6] rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 text-base sm:text-lg outline-none focus:ring-2 focus:ring-[#7678ed]/30 transition-all font-medium resize-none overflow-hidden max-h-[30vh]"
                    />
                )}

                <button
                    type="button"
                    onClick={onOpenCustomPromptsModal}
                    className="p-2.5 text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc] rounded-2xl transition-colors shrink-0 cursor-pointer"
                    title="Custom Prompts"
                >
                    <PromptIcon className="w-5 h-5" />
                </button>

                {/* Microphone & Voice / Audio Input Option */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            if (isRecording) {
                                stopRecording(true);
                            } else {
                                setIsMicMenuOpen((prev) => !prev);
                            }
                        }}
                        disabled={isTranscribing}
                        className={`p-2.5 rounded-2xl transition-colors cursor-pointer ${
                            isRecording
                                ? "bg-rose-500 text-white animate-pulse"
                                : isTranscribing
                                ? "bg-[#7678ed]/20 text-[#7678ed]"
                                : isMicMenuOpen
                                ? "text-[#7678ed] bg-[#7678ed]/10"
                                : "text-[#8e90a6] hover:text-[#7678ed] hover:bg-[#f4f6fc]"
                        }`}
                        title={
                            isRecording
                                ? "Stop & Transcribe"
                                : isTranscribing
                                ? "Transcribing audio..."
                                : "Voice & Audio Input (Whisper STT)"
                        }
                    >
                        {isTranscribing ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                            </svg>
                        ) : (
                            <MicIcon className="w-5 h-5" />
                        )}
                    </button>

                    {/* Mic Options Popover */}
                    {isMicMenuOpen && !isRecording && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsMicMenuOpen(false)} />
                            <div className="absolute right-0 bottom-full mb-2 w-52 bg-white rounded-2xl shadow-xl border border-[#e8ebf3] py-1.5 z-40 select-none animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <span className="p-1.5 rounded-lg bg-[#7678ed]/10 text-[#7678ed]">
                                        <MicIcon className="w-4 h-4" />
                                    </span>
                                    <span>Record Voice</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMicMenuOpen(false);
                                        audioFileInputRef.current?.click();
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[#202022] hover:bg-[#f4f6fc] transition-colors flex items-center gap-2.5 cursor-pointer"
                                >
                                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                                        <UploadIcon className="w-4 h-4" />
                                    </span>
                                    <span>Upload Audio File</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* Hidden Audio File Input */}
                    <input
                        ref={audioFileInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                        onChange={handleAudioFileChange}
                        className="hidden"
                    />
                </div>

                <button
                    type="submit"
                    className="w-10 h-10 sm:w-11 sm:h-11 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-[#7678ed]/30 shrink-0 cursor-pointer"
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
