"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { DownloadIcon, CloseIcon, CheckIcon } from "../icons/Icons";

export interface PullModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    instanceId: string;
    instanceName: string;
    getApiUrl: () => string;
    onPullSuccess?: (modelName: string) => void;
}

const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const POPULAR_MODELS = [
    "llama3.2",
    "deepseek-r1:8b",
    "qwen2.5-coder:7b",
    "mistral",
    "nomic-embed-text",
];

export const PullModelModal: React.FC<PullModelModalProps> = ({
    isOpen,
    onClose,
    instanceId,
    instanceName,
    getApiUrl,
    onPullSuccess,
}) => {
    const [modelName, setModelName] = useState<string>("");
    const [isPulling, setIsPulling] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Progress details
    const [currentStatus, setCurrentStatus] = useState<string>("");
    const [completedBytes, setCompletedBytes] = useState<number>(0);
    const [totalBytes, setTotalBytes] = useState<number>(0);
    const [percent, setPercent] = useState<number | null>(null);
    const [logLines, setLogLines] = useState<string[]>([]);

    const abortControllerRef = useRef<AbortController | null>(null);
    const logContainerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setModelName("");
            setIsPulling(false);
            setIsComplete(false);
            setErrorMessage(null);
            setCurrentStatus("");
            setCompletedBytes(0);
            setTotalBytes(0);
            setPercent(null);
            setLogLines([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            // Abort any ongoing stream on close
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        }
    }, [isOpen]);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logLines]);

    if (!isOpen) return null;

    const handleStartPull = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = modelName.trim();
        if (!trimmed || isPulling) return;

        setIsPulling(true);
        setIsComplete(false);
        setErrorMessage(null);
        setCurrentStatus("Initiating download...");
        setCompletedBytes(0);
        setTotalBytes(0);
        setPercent(null);
        setLogLines([`Requesting pull for '${trimmed}' on ${instanceName}...`]);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const url = `${getApiUrl()}/instances/${encodeURIComponent(instanceId)}/models/pull`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: trimmed }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}: Failed to start model pull`);
            }

            if (!response.body) {
                throw new Error("No response body stream received");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const eventBlock of events) {
                    const lines = eventBlock.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const rawJson = line.slice(6).trim();
                            if (!rawJson) continue;
                            try {
                                const parsed = JSON.parse(rawJson);

                                if (parsed.error) {
                                    throw new Error(parsed.error);
                                }

                                if (parsed.status) {
                                    setCurrentStatus(parsed.status);
                                    setLogLines((prev) => [...prev.slice(-40), parsed.status]);
                                }

                                if (parsed.total && parsed.completed !== undefined) {
                                    setTotalBytes(parsed.total);
                                    setCompletedBytes(parsed.completed);
                                    const calculatedPercent = Math.min(
                                        100,
                                        Math.max(0, Math.round((parsed.completed / parsed.total) * 100))
                                    );
                                    setPercent(calculatedPercent);
                                }

                                if (parsed.status === "success") {
                                    setIsComplete(true);
                                    setIsPulling(false);
                                    setPercent(100);
                                    if (onPullSuccess) {
                                        onPullSuccess(trimmed);
                                    }
                                }
                            } catch (parseErr) {
                                if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
                                    throw parseErr;
                                }
                            }
                        }
                    }
                }
            }

            setIsPulling(false);
            setIsComplete(true);
            if (onPullSuccess) {
                onPullSuccess(trimmed);
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                setLogLines((prev) => [...prev, "Pull cancelled by user."]);
                setCurrentStatus("Cancelled");
            } else {
                const msg = err instanceof Error ? err.message : "Error pulling model";
                setErrorMessage(msg);
                setLogLines((prev) => [...prev, `Error: ${msg}`]);
            }
            setIsPulling(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleCancelPull = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPulling(false);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 select-none"
            onClick={isPulling ? undefined : onClose}
        >
            <div
                className="bg-white text-[#202022] rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[calc(100vw-24px)] sm:w-full max-w-lg shadow-2xl border border-[#e8ebf3] animate-in fade-in zoom-in duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#eef0f6] mb-4 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center shrink-0">
                            <DownloadIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-[#202022] tracking-tight">
                                {isPulling || isComplete ? "Pulling Model" : "Pull New Model"}
                            </h3>
                            <p className="text-xs text-[#8e90a6] mt-0.5">
                                {instanceName}
                            </p>
                        </div>
                    </div>
                    {!isPulling && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-[#8e90a6] hover:text-[#202022] hover:bg-[#f4f6fc] rounded-full transition-colors cursor-pointer"
                            title="Close"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Form or Progress View */}
                {!isPulling && !isComplete && !errorMessage ? (
                    <form onSubmit={handleStartPull} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-[#202022] mb-1">
                                Model Tag or Name *
                            </label>
                            <Input
                                ref={inputRef as any}
                                type="text"
                                required
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                placeholder="e.g., llama3.2, deepseek-r1:8b, mistral:7b"
                                helperText="Enter any model identifier from ollama.com/library or Hugging Face."
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Quick Tags */}
                        <div>
                            <span className="block text-[11px] font-bold text-[#8e90a6] uppercase tracking-wider mb-2">
                                Popular Models
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {POPULAR_MODELS.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setModelName(tag)}
                                        className="px-2.5 py-1 rounded-xl bg-[#f0f2fb] hover:bg-[#eaecf9] text-[#7678ed] text-xs font-mono font-medium transition-colors cursor-pointer"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#eef0f6]">
                            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" size="sm" disabled={!modelName.trim()}>
                                Pull Model
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {/* Status Header */}
                        <div className="p-3.5 rounded-2xl bg-[#f9fafc] border border-[#eef0f6] space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-xs sm:text-sm text-[#202022] truncate">
                                    {modelName}
                                </span>
                                {isComplete ? (
                                    <Badge variant="success">Completed</Badge>
                                ) : errorMessage ? (
                                    <Badge variant="danger">Failed</Badge>
                                ) : (
                                    <Badge variant="primary">
                                        {percent !== null ? `${percent}%` : "Downloading"}
                                    </Badge>
                                )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-[#eaecf9] h-2.5 rounded-full overflow-hidden relative">
                                {percent !== null ? (
                                    <div
                                        className="bg-[#7678ed] h-full rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${percent}%` }}
                                    />
                                ) : isPulling ? (
                                    <div className="bg-[#7678ed] h-full rounded-full w-1/3 animate-pulse" />
                                ) : null}
                            </div>

                            {/* Bytes & Status label */}
                            <div className="flex items-center justify-between text-[11px] text-[#8e90a6] font-medium pt-0.5">
                                <span className="truncate max-w-[240px] text-[#5d6075]">
                                    {currentStatus || (isComplete ? "Success" : "Working...")}
                                </span>
                                {totalBytes > 0 && (
                                    <span className="font-mono shrink-0">
                                        {formatBytes(completedBytes)} / {formatBytes(totalBytes)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Error Alert */}
                        {errorMessage && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                {errorMessage}
                            </div>
                        )}

                        {/* Success Alert */}
                        {isComplete && (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                                <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Model &quot;{modelName}&quot; has been successfully pulled and registered!</span>
                            </div>
                        )}

                        {/* Logs Console */}
                        <div>
                            <span className="block text-[11px] font-bold text-[#8e90a6] uppercase tracking-wider mb-1.5">
                                Activity Log
                            </span>
                            <div
                                ref={logContainerRef}
                                className="bg-[#202022] text-[#e8ebf3] rounded-xl p-3 h-32 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 custom-scrollbar select-text"
                            >
                                {logLines.map((line, idx) => (
                                    <div key={idx} className="break-all opacity-90">
                                        &gt; {line}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#eef0f6]">
                            {isPulling ? (
                                <Button type="button" variant="danger" size="sm" onClick={handleCancelPull}>
                                    Cancel Pull
                                </Button>
                            ) : isComplete ? (
                                <Button type="button" variant="primary" size="sm" onClick={onClose}>
                                    Done
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setErrorMessage(null);
                                            setIsComplete(false);
                                            setIsPulling(false);
                                        }}
                                    >
                                        Change Model
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleStartPull()}
                                    >
                                        Retry
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
