"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import { MicIcon, MicOffIcon, CloseIcon, CheckIcon } from "../icons/Icons";

export type OneOnOneAgentStatus = "hearing" | "processing" | "talking";

const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 0.85, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.35, 1.5, 1.75, 2];

const formatPlaybackRate = (rate: number): string => {
    const rounded = Math.round(rate * 100) / 100;
    return `${rounded}x`;
};

export interface OneOnOnePanelProps {
    status: OneOnOneAgentStatus;
    isMuted: boolean;
    onToggleMute: () => void;
    onClose: () => void;
    onInterrupt?: () => void;
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
    isUserSpeaking?: boolean;
    audioLevel?: number; // 0 to 1
    assistantName?: string;
    assistantAvatar?: string;
    statusDetail?: string;
    errorText?: string | null;
    onClearError?: () => void;
}

export const OneOnOnePanel: React.FC<OneOnOnePanelProps> = ({
    status,
    isMuted,
    onToggleMute,
    onClose,
    onInterrupt,
    playbackRate = 1,
    onPlaybackRateChange,
    isUserSpeaking = false,
    audioLevel = 0,
    assistantName = "Assistant",
    assistantAvatar,
    statusDetail,
    errorText,
    onClearError,
}) => {
    const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
    const clampedLevel = Math.min(1, Math.max(0, audioLevel));
    const dynamicScale =
        status === "hearing" && !isMuted
            ? 1 + clampedLevel * 0.35
            : status === "talking"
            ? 1.08
            : 1;

    const getStatusLabel = () => {
        if (status === "talking") return "Talking";
        if (status === "processing") return "Processing";
        if (isMuted) return "Mic Muted";
        if (isUserSpeaking) return "Hearing you...";
        return "Hearing";
    };

    const getStatusSubtext = () => {
        if (statusDetail) return statusDetail;
        if (status === "talking") return `${assistantName} is speaking...`;
        if (status === "processing") return "Transcribing & thinking...";
        if (isMuted) return "Microphone is muted — tap Unmute to talk";
        if (isUserSpeaking) return "Listening — pause when finished speaking";
        return "Speak naturally — auto-sends when you stop talking";
    };

    // Visual palette per state
    const isHearingActive = status === "hearing" && !isMuted;
    const isProcessing = status === "processing";
    const isTalking = status === "talking";

    const orbGradient = isTalking
        ? "from-[#7678ed] via-[#5b5de6] to-[#9b5de5]"
        : isProcessing
        ? "from-amber-400 via-[#7678ed] to-indigo-600"
        : isHearingActive
        ? isUserSpeaking
            ? "from-emerald-400 via-teal-500 to-cyan-500"
            : "from-emerald-500 via-teal-500 to-[#7678ed]"
        : "from-slate-400 via-slate-500 to-slate-600";

    const badgeStyle = isTalking
        ? "bg-[#7678ed]/15 text-[#7678ed] border-[#7678ed]/30"
        : isProcessing
        ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
        : isHearingActive
        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
        : "bg-slate-200/70 text-slate-600 border-slate-300";

    const dotStyle = isTalking
        ? "bg-[#7678ed] motion-safe:animate-ping"
        : isProcessing
        ? "bg-amber-500 motion-safe:animate-bounce"
        : isHearingActive
        ? "bg-emerald-500 motion-safe:animate-pulse"
        : "bg-slate-400";

    return (
        <div className="h-1/3 min-h-[210px] w-full shrink-0 border-b border-[#eef0f6] bg-gradient-to-b from-[#f4f6fc] via-white to-[#f9fafc] relative flex flex-col items-center justify-between px-4 py-3 sm:py-5 select-none overflow-hidden">
            {/* Top Bar: Mode Badge + Error Toast + Close */}
            <div className="w-full flex items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs transition-colors ${badgeStyle}`}>
                        <span className="relative flex h-2 w-2">
                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${dotStyle}`} />
                            <span
                                className={`relative inline-flex rounded-full h-2 w-2 ${
                                    isTalking
                                        ? "bg-[#7678ed]"
                                        : isProcessing
                                        ? "bg-amber-500"
                                        : isHearingActive
                                        ? "bg-emerald-500"
                                        : "bg-slate-400"
                                }`}
                            />
                        </span>
                        <span>1on1 • {getStatusLabel()}</span>
                    </span>
                </div>

                {errorText && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold max-w-xs sm:max-w-md truncate">
                        <span className="truncate">{errorText}</span>
                        {onClearError && (
                            <button
                                type="button"
                                onClick={onClearError}
                                className="hover:text-rose-800 cursor-pointer shrink-0"
                                title="Dismiss error"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-xl text-[#8e90a6] hover:text-[#202022] hover:bg-[#eef0f6] transition-colors cursor-pointer"
                    title="Close 1on1 Mode"
                >
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Center Stage: Animated Circle Visualizer */}
            <div className="relative flex flex-col items-center justify-center my-auto">
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                    {/* Outer Ripple Ring 1 */}
                    <div
                        className={`absolute inset-0 rounded-full transition-transform duration-150 ease-out pointer-events-none ${
                            isTalking
                                ? "bg-[#7678ed]/20 motion-safe:animate-ping"
                                : isProcessing
                                ? "border-2 border-dashed border-[#7678ed]/40 motion-safe:animate-spin"
                                : isHearingActive
                                ? "bg-emerald-400/20"
                                : "bg-slate-200/40"
                        }`}
                        style={{
                            transform:
                                isHearingActive
                                    ? `scale(${(1.12 + clampedLevel * 0.55).toFixed(3)})`
                                    : isTalking
                                    ? "scale(1.25)"
                                    : "scale(1.08)",
                            animationDuration: isProcessing ? "6s" : "1.8s",
                        }}
                    />

                    {/* Middle Ripple Ring 2 */}
                    <div
                        className={`absolute inset-2 rounded-full transition-all duration-150 ease-out pointer-events-none ${
                            isTalking
                                ? "bg-[#7678ed]/25 border border-[#7678ed]/40 motion-safe:animate-pulse"
                                : isProcessing
                                ? "border-2 border-amber-400/50 border-t-transparent motion-safe:animate-spin"
                                : isHearingActive
                                ? "bg-teal-400/20 border border-emerald-400/40"
                                : "bg-slate-200/30 border border-slate-300/50"
                        }`}
                        style={{
                            transform:
                                isHearingActive
                                    ? `scale(${(1.04 + clampedLevel * 0.35).toFixed(3)})`
                                    : isTalking
                                    ? "scale(1.14)"
                                    : "scale(1.02)",
                            animationDuration: isProcessing ? "2.2s" : "1.4s",
                        }}
                    />

                    {/* Core Circle Orb */}
                    <div
                        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr ${orbGradient} shadow-lg flex items-center justify-center transition-transform duration-150 ease-out overflow-hidden ring-4 ring-white`}
                        style={{
                            transform: `scale(${dynamicScale.toFixed(3)})`,
                        }}
                    >
                        {assistantAvatar && (isTalking || isProcessing) ? (
                            <img
                                src={assistantAvatar}
                                alt={assistantName}
                                className={`w-full h-full object-cover ${isProcessing ? "opacity-75 scale-105 transition-transform" : "opacity-95"}`}
                            />
                        ) : null}

                        {/* Overlay State Icon / Equalizer Bars */}
                        <div
                            className={`absolute inset-0 flex items-center justify-center ${
                                assistantAvatar && (isTalking || isProcessing) ? "bg-black/30 backdrop-blur-[1px]" : ""
                            }`}
                        >
                            {isTalking ? (
                                <div className="flex items-end gap-1 h-7">
                                    <span className="w-1.5 bg-white rounded-full h-3 motion-safe:animate-[bounce_0.8s_infinite_0ms]" />
                                    <span className="w-1.5 bg-white rounded-full h-6 motion-safe:animate-[bounce_0.8s_infinite_150ms]" />
                                    <span className="w-1.5 bg-white rounded-full h-4 motion-safe:animate-[bounce_0.8s_infinite_300ms]" />
                                    <span className="w-1.5 bg-white rounded-full h-7 motion-safe:animate-[bounce_0.8s_infinite_100ms]" />
                                    <span className="w-1.5 bg-white rounded-full h-3.5 motion-safe:animate-[bounce_0.8s_infinite_250ms]" />
                                </div>
                            ) : isProcessing ? (
                                <svg className="w-8 h-8 text-white motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                                </svg>
                            ) : isMuted ? (
                                <MicOffIcon className="w-8 h-8 text-white/90" />
                            ) : (
                                <MicIcon className={`w-8 h-8 text-white transition-transform ${isUserSpeaking ? "scale-110" : "scale-100"}`} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Label & Subtitle */}
                <div className="mt-2 sm:mt-3 text-center max-w-md px-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-[#202022] tracking-tight">
                        {getStatusLabel()}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5d6075] font-medium truncate mt-0.5">
                        {getStatusSubtext()}
                    </p>
                </div>
            </div>

            {/* Bottom Controls Bar: Mic Mute Button + Playback Speed + Stop Speaking Button */}
            <div className="flex items-center gap-2.5 sm:gap-3 z-20">
                <button
                    type="button"
                    onClick={onToggleMute}
                    className={`px-4 py-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs border ${
                        isMuted
                            ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500 shadow-rose-500/20"
                            : "bg-white hover:bg-[#f4f6fc] text-[#202022] border-[#e2e5f1]"
                    }`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                    {isMuted ? (
                        <>
                            <MicOffIcon className="w-4 h-4 shrink-0" />
                            <span>Unmute Mic</span>
                        </>
                    ) : (
                        <>
                            <MicIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Mute Mic</span>
                        </>
                    )}
                </button>

                {/* YouTube-Style Playback Speed Selector */}
                {onPlaybackRateChange && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
                            className={`px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
                                isSpeedMenuOpen || playbackRate !== 1
                                    ? "bg-[#7678ed]/10 text-[#7678ed] border-[#7678ed]/30"
                                    : "bg-white hover:bg-[#f4f6fc] text-[#202022] border-[#e2e5f1]"
                            }`}
                            title="Playback speed (pitch preserved)"
                        >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 14 15.5 10.5" />
                                <path d="M20.3 18c.4-1 .7-2.2.7-3.4A9 9 0 1 0 3 14.6c0 1.2.3 2.4.7 3.4" />
                                <path d="M4 18h16" />
                            </svg>
                            <span>{formatPlaybackRate(playbackRate)}</span>
                        </button>

                        {isSpeedMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsSpeedMenuOpen(false)} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white rounded-2xl shadow-xl border border-[#e2e5f1] py-2 z-40 animate-in fade-in zoom-in-95 duration-150 flex flex-col">
                                    {/* Custom 0.05x Stepper + Range Slider */}
                                    <div className="px-3 pb-2 border-b border-[#eef0f6]">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e90a6]">
                                                Custom (0.05x)
                                            </span>
                                            <span className="text-xs font-extrabold text-[#7678ed]">
                                                {formatPlaybackRate(playbackRate)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = Math.max(0.25, Math.round((playbackRate - 0.05) * 100) / 100);
                                                    onPlaybackRateChange(next);
                                                }}
                                                disabled={playbackRate <= 0.25}
                                                className="w-6 h-6 rounded-lg bg-[#f4f6fc] hover:bg-[#e8ebf3] disabled:opacity-40 text-[#202022] font-bold text-xs flex items-center justify-center cursor-pointer shrink-0"
                                                title="Decrease speed by 0.05x"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="range"
                                                min={0.25}
                                                max={2}
                                                step={0.05}
                                                value={playbackRate}
                                                onChange={(e) => {
                                                    const val = Math.round(parseFloat(e.target.value) * 100) / 100;
                                                    onPlaybackRateChange(val);
                                                }}
                                                className="w-full accent-[#7678ed] h-1.5 bg-[#eef0f6] rounded-lg cursor-pointer"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = Math.min(2, Math.round((playbackRate + 0.05) * 100) / 100);
                                                    onPlaybackRateChange(next);
                                                }}
                                                disabled={playbackRate >= 2}
                                                className="w-6 h-6 rounded-lg bg-[#f4f6fc] hover:bg-[#e8ebf3] disabled:opacity-40 text-[#202022] font-bold text-xs flex items-center justify-center cursor-pointer shrink-0"
                                                title="Increase speed by 0.05x"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {/* Granular Quick Presets */}
                                    <div className="max-h-36 overflow-y-auto pt-1">
                                        {PLAYBACK_SPEED_OPTIONS.map((rate) => {
                                            const isSelected = Math.abs(playbackRate - rate) < 0.01;
                                            return (
                                                <button
                                                    key={rate}
                                                    type="button"
                                                    onClick={() => {
                                                        onPlaybackRateChange(rate);
                                                        setIsSpeedMenuOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? "bg-[#7678ed]/10 text-[#7678ed] font-bold"
                                                            : "text-[#202022] hover:bg-[#f4f6fc]"
                                                    }`}
                                                >
                                                    <span>{rate === 1 ? "Normal (1x)" : `${rate}x`}</span>
                                                    {isSelected && <CheckIcon className="w-3.5 h-3.5 text-[#7678ed] shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {(isTalking || isProcessing) && onInterrupt && (
                    <button
                        type="button"
                        onClick={onInterrupt}
                        className="px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                        title="Stop agent speech and return to listening"
                    >
                        <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block shrink-0" />
                        <span>Stop</span>
                    </button>
                )}
            </div>
        </div>
    );
};

