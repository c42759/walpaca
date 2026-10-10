"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import React, { useState } from "react";
import { BrainIcon, MetadataIcon, DownloadIcon, AudioIcon, ToolIcon } from "../icons/Icons";
import { isCharEnabled, getCharacterName, formatAvatarPicture, DEFAULT_MODEL_AVATAR } from "@/lib/characterUtils";

export interface MessageAttachment {
    id?: string;
    type: string;
    name?: string;
    content: string;
}

export interface Message {
    id: string;
    senderName: string;
    senderAvatar?: string;
    senderRole?: string;
    instanceId?: string;
    model?: string;
    isSelf: boolean;
    content: string;
    time: string;
    views?: number;
    reactions?: { emoji: string; count: number }[];
    image?: string;
    attachments?: MessageAttachment[];
}

export interface TTSState {
    msgId: string | null;
    status: "idle" | "playing" | "paused" | "stopped";
    lineIndex?: number;
}

export const isImageAttachment = (att: MessageAttachment | any): boolean => {
    if (!att) return false;
    const typeStr = (att.type || "").toLowerCase();
    if (typeStr.includes("image") || typeStr.includes("photo") || typeStr.includes("png") || typeStr.includes("jpg") || typeStr.includes("jpeg")) {
        return true;
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (
        contentStr.startsWith("data:image/") ||
        contentStr.startsWith("iVBOR") ||
        contentStr.startsWith("/9j/") ||
        contentStr.startsWith("R0lGOD") ||
        contentStr.startsWith("UklGR")
    ) {
        return true;
    }
    return false;
};

export const getImageSrc = (att: MessageAttachment | any): string => {
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (contentStr.startsWith("data:") || contentStr.startsWith("http://") || contentStr.startsWith("https://") || contentStr.startsWith("/")) {
        return contentStr;
    }
    return `data:image/png;base64,${contentStr}`;
};

export const isAudioAttachment = (att: MessageAttachment | any): boolean => {
    if (!att) return false;
    const typeStr = (att.type || "").toLowerCase();
    if (typeStr.includes("audio") || typeStr.includes("mp3") || typeStr.includes("wav")) return true;
    const name = (att.name || "").toLowerCase();
    if (
        name.endsWith(".mp3") ||
        name.endsWith(".wav") ||
        name.endsWith(".ogg") ||
        name.endsWith(".m4a") ||
        name.endsWith(".flac") ||
        name.endsWith(".aac")
    ) {
        return true;
    }
    const contentStr = typeof att.content === "string" ? att.content.trim() : "";
    if (contentStr.startsWith("data:audio/")) return true;
    return false;
};

export interface AudioAttachmentCardProps {
    attachment: MessageAttachment | any;
    isSelf?: boolean;
}

export const AudioAttachmentCard: React.FC<AudioAttachmentCardProps> = ({ attachment, isSelf }) => {
    const name = attachment.name || "audio.mp3";
    const ext = (name.split(".").pop() || "audio").toLowerCase();
    const src = attachment.content || "";

    return (
        <div
            className={`rounded-2xl border p-3 my-1 w-full max-w-md transition-all ${
                isSelf
                    ? "bg-white/15 border-white/25 text-white shadow-xs backdrop-blur-xs"
                    : "bg-white border-[#e2e5f1] text-[#202022] shadow-xs"
            }`}
        >
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelf ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-600"
                        }`}
                        title={ext.toUpperCase()}
                    >
                        <AudioIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold truncate" title={name}>
                            {name}
                        </span>
                        <span className={`text-[10px] ${isSelf ? "text-white/70" : "text-[#8e90a6]"}`}>
                            Audio attachment
                        </span>
                    </div>
                </div>

                {src && (
                    <a
                        href={src}
                        download={name}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            isSelf
                                ? "hover:bg-white/20 text-white"
                                : "hover:bg-[#f4f6fc] text-[#8e90a6] hover:text-[#7678ed]"
                        }`}
                        title="Download audio"
                    >
                        <DownloadIcon className="w-4 h-4" />
                    </a>
                )}
            </div>

            {src && (
                <div className="w-full mt-1">
                    <audio
                        controls
                        src={src}
                        preload="metadata"
                        className="w-full h-8 rounded-lg outline-none"
                    />
                </div>
            )}
        </div>
    );
};

export interface ToolAttachmentCardProps {
    attachment: MessageAttachment | any;
    isSelf?: boolean;
}

export const ToolAttachmentCard: React.FC<ToolAttachmentCardProps> = ({ attachment, isSelf }) => {
    const [expanded, setExpanded] = useState(false);
    let parsedData: any = null;
    try {
        parsedData = typeof attachment.content === "string" ? JSON.parse(attachment.content) : attachment.content;
    } catch {
        parsedData = attachment.content;
    }

    const toolName = attachment.name ? attachment.name.replace(/^Tool:\s*/i, "") : "Tool Execution";

    return (
        <div
            className={`rounded-2xl border transition-all overflow-hidden my-1.5 w-full max-w-full ${
                isSelf ? "bg-white/10 border-white/25 text-white shadow-xs" : "bg-white border-[#e2e5f1] text-[#2d3142] shadow-xs"
            }`}
        >
            <div
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between px-3.5 py-2.5 gap-3 cursor-pointer hover:bg-black/2 transition-colors select-none"
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelf ? "bg-white/20 text-white" : "bg-[#10b981]/15 text-[#059669]"
                        }`}
                    >
                        <ToolIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold font-mono text-[#059669] truncate">
                            {toolName}
                        </span>
                        <span className={`text-[10px] ${isSelf ? "text-white/75" : "text-[#8e90a6]"}`}>
                            MCP Tool Execution
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                        Executed
                    </span>
                    <button
                        type="button"
                        className="p-1 rounded-lg text-xs text-[#8e90a6] hover:text-[#202022]"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="p-3 border-t border-[#e2e5f1] bg-[#f9fafc] text-xs font-mono space-y-2 overflow-x-auto max-h-72 custom-scrollbar">
                    {parsedData?.call && (
                        <div>
                            <span className="text-[10px] font-bold uppercase text-[#8e90a6] block mb-0.5">Parameters:</span>
                            <pre className="bg-white p-2 rounded-xl border border-[#e8ebf3] text-[11px] text-[#202022] whitespace-pre-wrap">
                                {typeof parsedData.call === "object" ? JSON.stringify(parsedData.call, null, 2) : String(parsedData.call)}
                            </pre>
                        </div>
                    )}
                    <div>
                        <span className="text-[10px] font-bold uppercase text-[#8e90a6] block mb-0.5">Result:</span>
                        <pre className="bg-white p-2 rounded-xl border border-[#e8ebf3] text-[11px] text-[#059669] whitespace-pre-wrap">
                            {typeof parsedData?.result === "object" ? JSON.stringify(parsedData.result, null, 2) : typeof parsedData === "object" ? JSON.stringify(parsedData, null, 2) : String(parsedData)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export interface DocumentAttachmentCardProps {
    attachment: MessageAttachment | any;
    extension: string;
    isSelf?: boolean;
    highlightCodeTokens?: (code: string, lang?: string) => React.ReactNode;
}

export const DocumentAttachmentCard: React.FC<DocumentAttachmentCardProps> = ({ attachment, extension, isSelf, highlightCodeTokens }) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(attachment.content || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const name = attachment.name || `file.${extension}`;
    const lines = attachment.content ? attachment.content.split("\n").length : 0;
    const sizeKb = attachment.content ? (new Blob([attachment.content]).size / 1024).toFixed(1) : "0";

    return (
        <div
            className={`rounded-xl border transition-all overflow-hidden my-1 w-full max-w-full ${
                isSelf ? "bg-white/10 border-white/25 text-white shadow-xs" : "bg-white border-[#e2e5f1] text-[#2d3142] shadow-xs"
            }`}
        >
            <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                            isSelf ? "bg-white/20 text-white" : "bg-[#7678ed]/15 text-[#7678ed]"
                        }`}
                    >
                        {extension}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold truncate" title={name}>
                            {name}
                        </span>
                        <span className={`text-[11px] ${isSelf ? "text-white/75" : "text-[#8e90a6]"}`}>
                            {sizeKb} KB • {lines} line{lines !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                            isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-[#f4f6fc] hover:bg-[#eef0f6] text-[#7678ed] border border-[#e2e5f1]"
                        }`}
                        title="Copy content"
                    >
                        {copied ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Copied</span>
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                <span>Copy</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                            isSelf ? "bg-white/20 hover:bg-white/30 text-white" : "bg-[#f4f6fc] hover:bg-[#eef0f6] text-[#5d6075] border border-[#e2e5f1]"
                        }`}
                        title={expanded ? "Collapse preview" : "View content"}
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                </div>
            </div>

            {expanded && (
                <pre
                    className={`p-3 border-t text-xs font-mono overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap select-text ${
                        isSelf ? "bg-black/30 border-white/15 text-white/90" : "bg-[#1e1e24] border-[#e2e5f1] text-[#f8f8f2]"
                    }`}
                >
                    <code className="font-mono">{highlightCodeTokens ? highlightCodeTokens(attachment.content || "", extension) : attachment.content || ""}</code>
                </pre>
            )}
        </div>
    );
};

export interface ChatMessageListProps {
    messages: Message[];
    activeSearchMsgId?: string | null;
    selectedChatModelId?: string;
    modelPreferences?: Record<string, any>;
    handleUseCharacterFirstMes?: () => void;
    // Inline editing
    editingMsgId: string | null;
    editingMsgContent: string;
    setEditingMsgContent: (content: string) => void;
    setEditingMsgId: (id: string | null) => void;
    handleSaveInlineEdit: () => void | Promise<void>;
    handleStartInlineEdit: (msg: Message) => void;
    autoResizeTextarea?: (el: HTMLTextAreaElement | null) => void;
    // Modals / Actions
    handleOpenForkModal: (msg: Message) => void;
    handleOpenDeleteMessageModal: (msg: Message) => void;
    setActiveImageModal: (modal: { src: string; title: string } | null) => void;
    setActiveAttachmentModal: (modal: { title: string; type: string; content: string } | null) => void;
    setLineContextMenu?: (menu: any) => void;
    // TTS
    ttsState?: TTSState;
    handlePlayTTS?: (msgId: string, text: string, voice?: string) => void;
    handlePauseTTS?: () => void;
    handleResumeTTS?: () => void;
    handleStopTTS?: () => void;
    // Helpers / Renderers
    renderMarkdownText: (text: string, activeLineIndex?: number, onLineContextMenu?: (e: React.MouseEvent, lineText: string, lineIndex: number) => void) => React.ReactNode;
    highlightCodeTokens?: (code: string, lang?: string) => React.ReactNode;
    handleCallForAnswer?: () => void;
    messagesEndRef?: React.RefObject<HTMLDivElement | null>;
    onAvatarClick?: (msg: Message, pref?: any) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
    messages,
    activeSearchMsgId,
    selectedChatModelId = "",
    modelPreferences = {},
    handleUseCharacterFirstMes,
    onAvatarClick,
    editingMsgId,
    editingMsgContent,
    setEditingMsgContent,
    setEditingMsgId,
    handleSaveInlineEdit,
    handleStartInlineEdit,
    autoResizeTextarea,
    handleOpenForkModal,
    handleOpenDeleteMessageModal,
    setActiveImageModal,
    setActiveAttachmentModal,
    setLineContextMenu,
    ttsState = { msgId: null, status: "stopped" },
    handlePlayTTS,
    handlePauseTTS,
    handleResumeTTS,
    handleStopTTS,
    renderMarkdownText,
    highlightCodeTokens,
    handleCallForAnswer,
    messagesEndRef,
}) => {
    return (
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 flex flex-col">
            {messages.length === 0
                ? (() => {
                      const selectedPrefKey = (selectedChatModelId || "").toLowerCase();
                      const selectedPref =
                          modelPreferences[selectedChatModelId] ||
                          modelPreferences[selectedPrefKey] ||
                          Object.values(modelPreferences).find((p: any) => p?.id?.toLowerCase() === selectedPrefKey);
                      const char = selectedPref?.character || {};
                      const charData = char.data || char || {};
                      const firstMes = (charData.first_mes || charData.first_message || selectedPref?.first_message || "").trim();

                      return (
                          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-4 sm:p-8 select-none my-auto">
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#f0f2f9] flex items-center justify-center mb-4 sm:mb-6 text-[#7678ed] shadow-inner">
                                  <img src="/icon-black.svg" alt="Alpaca Logo" className="w-12 h-12 sm:w-14 sm:h-14 opacity-70" />
                              </div>
                              <h3 className="text-xl sm:text-2xl font-bold text-[#202022] mb-2">No messages yet</h3>
                              <p className="text-sm sm:text-base text-[#8e90a6] max-w-sm mb-6">Start a conversation by typing a message below or using a character template.</p>
                              {selectedPref && firstMes ? (
                                  <button
                                      type="button"
                                      onClick={handleUseCharacterFirstMes}
                                      className="px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
                                  >
                                      <span>✨</span>
                                      <span>Use Character</span>
                                  </button>
                              ) : null}
                          </div>
                      );
                  })()
                : messages.map((msg) => {
                      if (msg.isSelf) {
                          // User message (Role 'user' -> Right side, full width)
                          const imageAttachments = (msg.attachments || []).filter(isImageAttachment);
                          const imageSources: string[] = [];
                          if (msg.image) imageSources.push(msg.image);
                          imageAttachments.forEach((att) => {
                              const src = getImageSrc(att);
                              if (src && !imageSources.includes(src)) imageSources.push(src);
                          });

                          const isEditingUser = editingMsgId === msg.id;
                          const isSearchActive = activeSearchMsgId === msg.id;

                          return (
                              <div
                                  key={msg.id}
                                  id={`chat-message-${msg.id}`}
                                  className={`flex items-start justify-end gap-2.5 sm:gap-3.5 w-full transition-all duration-300 rounded-2xl ${
                                      isSearchActive ? "ring-4 ring-amber-400 ring-offset-2 scale-[1.005]" : ""
                                  }`}
                              >
                                  <div className="flex flex-col items-end flex-1 w-full min-w-0">
                                      <div className="bg-[#7678ed] text-white rounded-2xl rounded-tr-sm px-4 py-3 sm:px-5 sm:py-4 text-base sm:text-lg shadow-[0_4px_14px_rgba(118,120,237,0.35)] w-full">
                                          {isEditingUser ? (
                                              <div className="flex flex-col gap-3 w-full my-1">
                                                  <textarea
                                                      ref={autoResizeTextarea}
                                                      rows={1}
                                                      value={editingMsgContent}
                                                      onChange={(e) => {
                                                          setEditingMsgContent(e.target.value);
                                                          if (autoResizeTextarea) autoResizeTextarea(e.currentTarget);
                                                      }}
                                                      onInput={(e) => {
                                                          if (autoResizeTextarea) autoResizeTextarea(e.currentTarget);
                                                      }}
                                                      className="w-full bg-white/10 text-white placeholder-white/50 rounded-xl p-3.5 text-base outline-none border border-white/30 focus:border-white transition-all resize-none overflow-hidden font-normal leading-relaxed"
                                                      autoFocus
                                                  />
                                                  <div className="flex items-center justify-end gap-2">
                                                      <button
                                                          type="button"
                                                          onClick={() => setEditingMsgId(null)}
                                                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
                                                      >
                                                          Cancel
                                                      </button>
                                                      <button
                                                          type="button"
                                                          onClick={handleSaveInlineEdit}
                                                          disabled={!editingMsgContent.trim()}
                                                          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#7678ed] hover:bg-white/90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                                                      >
                                                          Save
                                                      </button>
                                                  </div>
                                              </div>
                                          ) : (
                                              <>
                                                  <div className="leading-relaxed font-normal">{renderMarkdownText(msg.content)}</div>
                                                  {imageSources.length > 0 && (
                                                      <div className="flex flex-row gap-2.5 overflow-x-auto mt-3 pb-1.5 max-w-full">
                                                          {imageSources.map((src, idx) => (
                                                              <img
                                                                  key={idx}
                                                                  src={src}
                                                                  alt={`Attachment ${idx + 1}`}
                                                                  className="h-32 min-w-[128px] max-w-[260px] rounded-xl object-cover border border-white/20 shadow-xs flex-shrink-0 cursor-pointer hover:opacity-95 transition-opacity"
                                                                  onClick={() =>
                                                                      setActiveImageModal({
                                                                          src,
                                                                          title: `Attachment Image ${idx + 1}`,
                                                                      })
                                                                  }
                                                              />
                                                          ))}
                                                      </div>
                                                  )}
                                                  {(() => {
                                                      const audioAtts = (msg.attachments || []).filter(isAudioAttachment);
                                                      const docAtts = (msg.attachments || []).filter(
                                                          (att) => att.type !== "thought" && att.type !== "metadata" && !isImageAttachment(att) && !isAudioAttachment(att),
                                                      );
                                                      if (audioAtts.length === 0 && docAtts.length === 0) return null;
                                                      return (
                                                          <div className="flex flex-col gap-2 mt-3 w-full max-w-full">
                                                              {audioAtts.map((att, idx) => (
                                                                  <AudioAttachmentCard
                                                                      key={att.id || `audio-${idx}`}
                                                                      attachment={att}
                                                                      isSelf={msg.isSelf}
                                                                  />
                                                              ))}
                                                              {docAtts.map((att, idx) => {
                                                                  const ext = att.name ? att.name.split(".").pop()?.toLowerCase() || "txt" : "file";
                                                                  return (
                                                                      <DocumentAttachmentCard
                                                                          key={att.id || idx}
                                                                          attachment={att}
                                                                          extension={ext}
                                                                          isSelf={msg.isSelf}
                                                                          highlightCodeTokens={highlightCodeTokens}
                                                                      />
                                                                  );
                                                              })}
                                                          </div>
                                                      );
                                                  })()}
                                                  <div className="flex items-center justify-end gap-2 text-sm text-white/80 mt-2">
                                                      <button
                                                          type="button"
                                                          onClick={() => handleOpenForkModal(msg)}
                                                          className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer"
                                                          title="Fork Chat"
                                                      >
                                                          <svg
                                                              width="13"
                                                              height="13"
                                                              viewBox="0 0 24 24"
                                                              fill="none"
                                                              stroke="currentColor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                          >
                                                              <circle cx="12" cy="18" r="3" />
                                                              <circle cx="6" cy="6" r="3" />
                                                              <circle cx="18" cy="6" r="3" />
                                                              <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
                                                              <path d="M12 12v3" />
                                                          </svg>
                                                      </button>
                                                      <button
                                                          type="button"
                                                          onClick={() => handleStartInlineEdit(msg)}
                                                          className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer"
                                                          title="Edit Message"
                                                      >
                                                          <svg
                                                              width="13"
                                                              height="13"
                                                              viewBox="0 0 24 24"
                                                              fill="none"
                                                              stroke="currentColor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                          >
                                                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                          </svg>
                                                      </button>
                                                      <button
                                                          type="button"
                                                          onClick={() => handleOpenDeleteMessageModal(msg)}
                                                          className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white hover:text-[#ff7875] transition-all cursor-pointer"
                                                          title="Delete Message"
                                                      >
                                                          <svg
                                                              width="13"
                                                              height="13"
                                                              viewBox="0 0 24 24"
                                                              fill="none"
                                                              stroke="currentColor"
                                                              strokeWidth="2"
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                          >
                                                              <polyline points="3 6 5 6 21 6" />
                                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                          </svg>
                                                      </button>
                                                      <span>{msg.time}</span>
                                                  </div>
                                              </>
                                          )}
                                      </div>
                                  </div>
                                  <div
                                      className="w-10 h-10 rounded-2xl bg-[#7678ed] text-white flex items-center justify-center font-bold text-sm shrink-0 mt-1 shadow-sm"
                                      title="You"
                                  >
                                      <svg
                                          width="20"
                                          height="20"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                      >
                                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                          <circle cx="12" cy="7" r="4" />
                                      </svg>
                                  </div>
                              </div>
                          );
                      } else {
                          // Assistant / Incoming message (Role 'assistant' -> Left side, full width)
                          const prefKey = (msg.senderName || "").toLowerCase();
                          const pref = modelPreferences[prefKey] || modelPreferences[msg.senderName || ""] || (msg.model ? modelPreferences[msg.model.toLowerCase()] : undefined);
                          const avatarSrc = msg.senderAvatar || formatAvatarPicture(pref?.picture) || DEFAULT_MODEL_AVATAR;
                          const charName = isCharEnabled(pref?.character) ? getCharacterName(pref?.character) : undefined;
                          const displayName = charName || getCharacterName(pref?.character) || msg.senderName;
                          const modelVoice = pref?.voice || undefined;

                          const isThisMsgPlaying = ttsState.msgId === msg.id && ttsState.status === "playing";
                          const isThisMsgActive = ttsState.msgId === msg.id && ttsState.status !== "stopped";
                          const isEditingAssistant = editingMsgId === msg.id;

                          const thoughtAtt = msg.attachments?.find((a) => a.type?.toLowerCase() === "thought" || a.type?.toLowerCase() === "brain");
                          const metadataAtt = msg.attachments?.find((a) => a.type?.toLowerCase() === "metadata" || a.type?.toLowerCase() === "data");
                          const isSearchActive = activeSearchMsgId === msg.id;

                          return (
                              <div
                                  key={msg.id}
                                  id={`chat-message-${msg.id}`}
                                  className={`flex items-start gap-2.5 sm:gap-3.5 w-full transition-all duration-300 rounded-2xl ${
                                      isSearchActive ? "ring-4 ring-[#7678ed] ring-offset-2 scale-[1.005]" : ""
                                  }`}
                              >
                                  <img
                                      src={avatarSrc}
                                      alt={displayName}
                                      onClick={() => onAvatarClick?.(msg, pref)}
                                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl object-cover shrink-0 mt-1 shadow-sm cursor-pointer hover:ring-2 hover:ring-[#7678ed]/50 hover:opacity-90 active:scale-95 transition-all"
                                      title={`View ${displayName} persona details`}
                                  />
                                  <div className="flex flex-col items-start flex-1 w-full min-w-0">
                                      <div className="bg-[#f0f2f9] rounded-2xl rounded-tl-sm px-4 py-3 sm:px-5 sm:py-4 text-base sm:text-lg text-[#202022] shadow-[0_1px_3px_rgba(0,0,0,0.02)] w-full">
                                          <div className="flex items-center justify-between gap-3 mb-1.5">
                                              <div className="flex items-center gap-2">
                                                  {/* TTS Controls in front of displayName */}
                                                  {isThisMsgActive ? (
                                                      <div className="flex items-center gap-1">
                                                          {isThisMsgPlaying ? (
                                                              <button
                                                                  type="button"
                                                                  onClick={handlePauseTTS}
                                                                  className="p-1.5 rounded-xl bg-[#7678ed] text-white hover:bg-[#6869d9] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                                  title="Pause Speech"
                                                              >
                                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                      <rect x="6" y="4" width="4" height="16" rx="1" />
                                                                      <rect x="14" y="4" width="4" height="16" rx="1" />
                                                                  </svg>
                                                              </button>
                                                          ) : (
                                                              <button
                                                                  type="button"
                                                                  onClick={handleResumeTTS}
                                                                  className="p-1.5 rounded-xl bg-[#7678ed] text-white hover:bg-[#6869d9] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                                  title="Resume Speech"
                                                              >
                                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                      <polygon points="5 3 19 12 5 21 5 3" />
                                                                  </svg>
                                                              </button>
                                                          )}
                                                          <button
                                                              type="button"
                                                              onClick={handleStopTTS}
                                                              className="p-1.5 rounded-xl bg-[#ff7a55] text-white hover:bg-[#e06845] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                              title="Stop Speech"
                                                          >
                                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                  <rect x="4" y="4" width="16" height="16" rx="2" />
                                                              </svg>
                                                          </button>
                                                      </div>
                                                  ) : (
                                                      <button
                                                          type="button"
                                                          onClick={() => handlePlayTTS && handlePlayTTS(msg.id, msg.content, modelVoice)}
                                                          className="p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#7678ed] hover:bg-[#7678ed] hover:text-white transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                          title="Play Speech"
                                                      >
                                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                              <polygon points="5 3 19 12 5 21 5 3" />
                                                          </svg>
                                                      </button>
                                                  )}
                                                  <p className="text-base font-semibold text-[#7678ed]">{displayName}</p>
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                  {thoughtAtt && (
                                                      <button
                                                          type="button"
                                                          onClick={() =>
                                                              setActiveAttachmentModal({
                                                                  title: thoughtAtt.name || "Thought",
                                                                  type: "thought",
                                                                  content: thoughtAtt.content,
                                                              })
                                                          }
                                                          className="px-2.5 py-1 rounded-xl bg-white border border-[#e2e5f1] hover:bg-[#7678ed] hover:text-white text-[#7678ed] transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                                          title="View Thought / Reasoning"
                                                      >
                                                          <BrainIcon className="w-3.5 h-3.5" />
                                                          <span>Thought</span>
                                                      </button>
                                                  )}
                                                  {metadataAtt && (
                                                      <button
                                                          type="button"
                                                          onClick={() =>
                                                              setActiveAttachmentModal({
                                                                  title: metadataAtt.name || "Metadata",
                                                                  type: "metadata",
                                                                  content: metadataAtt.content,
                                                              })
                                                          }
                                                          className="px-2.5 py-1 rounded-xl bg-white border border-[#e2e5f1] hover:bg-[#7678ed] hover:text-white text-[#7678ed] transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                                          title="View Metadata"
                                                      >
                                                          <MetadataIcon className="w-3.5 h-3.5" />
                                                          <span>Metadata</span>
                                                      </button>
                                                  )}
                                                  <button
                                                      type="button"
                                                      onClick={() => handleOpenForkModal(msg)}
                                                      className="p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#7678ed] hover:border-[#7678ed] hover:bg-[#f4f6fc] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                      title="Fork Chat"
                                                  >
                                                      <svg
                                                          width="14"
                                                          height="14"
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                      >
                                                          <circle cx="12" cy="18" r="3" />
                                                          <circle cx="6" cy="6" r="3" />
                                                          <circle cx="18" cy="6" r="3" />
                                                          <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
                                                          <path d="M12 12v3" />
                                                      </svg>
                                                  </button>
                                                  <button
                                                      type="button"
                                                      onClick={() => handleStartInlineEdit(msg)}
                                                      className="p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#7678ed] hover:border-[#7678ed] hover:bg-[#f4f6fc] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                      title="Edit Message"
                                                  >
                                                      <svg
                                                          width="14"
                                                          height="14"
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                      >
                                                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                                      </svg>
                                                  </button>
                                                  <button
                                                      type="button"
                                                      onClick={() => handleOpenDeleteMessageModal(msg)}
                                                      className="p-1.5 rounded-xl bg-white border border-[#e2e5f1] text-[#8e90a6] hover:text-[#ff4d4f] hover:border-[#ff4d4f] hover:bg-[#fff1f0] transition-all shadow-xs cursor-pointer flex items-center justify-center"
                                                      title="Delete Message"
                                                  >
                                                      <svg
                                                          width="14"
                                                          height="14"
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                      >
                                                          <polyline points="3 6 5 6 21 6" />
                                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                      </svg>
                                                  </button>
                                              </div>
                                          </div>
                                          <div className="leading-relaxed">
                                              {isEditingAssistant ? (
                                                  <div className="flex flex-col gap-3 w-full my-2">
                                                      <textarea
                                                          ref={autoResizeTextarea}
                                                          rows={1}
                                                          value={editingMsgContent}
                                                          onChange={(e) => {
                                                              setEditingMsgContent(e.target.value);
                                                              if (autoResizeTextarea) autoResizeTextarea(e.currentTarget);
                                                          }}
                                                          onInput={(e) => {
                                                              if (autoResizeTextarea) autoResizeTextarea(e.currentTarget);
                                                          }}
                                                          className="w-full bg-white border border-[#e2e5f1] text-[#202022] rounded-xl p-3.5 text-base outline-none focus:border-[#7678ed] focus:ring-1 focus:ring-[#7678ed] transition-all resize-none overflow-hidden font-normal leading-relaxed"
                                                          autoFocus
                                                      />
                                                      <div className="flex items-center justify-end gap-2">
                                                          <button
                                                              type="button"
                                                              onClick={() => setEditingMsgId(null)}
                                                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#e2e5f1] hover:bg-[#d5d8e6] text-[#5d6075] transition-all cursor-pointer"
                                                          >
                                                              Cancel
                                                          </button>
                                                          <button
                                                              type="button"
                                                              onClick={handleSaveInlineEdit}
                                                              disabled={!editingMsgContent.trim()}
                                                              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#7678ed] hover:bg-[#6869d9] disabled:opacity-50 text-white transition-all shadow-xs cursor-pointer"
                                                          >
                                                              Save
                                                          </button>
                                                      </div>
                                                  </div>
                                              ) : (
                                                  renderMarkdownText(msg.content, msg.id === ttsState.msgId ? ttsState.lineIndex : undefined, (e, lineText, lineIdx) => {
                                                      if (setLineContextMenu) {
                                                          setLineContextMenu({
                                                              x: e.clientX,
                                                              y: e.clientY,
                                                              msgId: msg.id,
                                                              lineText,
                                                              lineIndex: lineIdx,
                                                              voice: modelVoice,
                                                              fullContent: msg.content,
                                                          });
                                                      }
                                                  })
                                              )}
                                              {(() => {
                                                  const toolAtts = (msg.attachments || []).filter((att) => att.type?.toLowerCase() === "tool");
                                                  const audioAtts = (msg.attachments || []).filter(isAudioAttachment);
                                                  const docAtts = (msg.attachments || []).filter(
                                                      (att) => att.type?.toLowerCase() !== "tool" && att.type !== "thought" && att.type !== "metadata" && !isImageAttachment(att) && !isAudioAttachment(att),
                                                  );
                                                  if (toolAtts.length === 0 && audioAtts.length === 0 && docAtts.length === 0) return null;
                                                  return (
                                                      <div className="flex flex-col gap-2 mt-3 w-full max-w-full">
                                                          {toolAtts.map((att, idx) => (
                                                              <ToolAttachmentCard
                                                                  key={att.id || `tool-${idx}`}
                                                                  attachment={att}
                                                                  isSelf={false}
                                                              />
                                                          ))}
                                                          {audioAtts.map((att, idx) => (
                                                              <AudioAttachmentCard
                                                                  key={att.id || `audio-${idx}`}
                                                                  attachment={att}
                                                                  isSelf={false}
                                                             />
                                                          ))}
                                                          {docAtts.map((att, idx) => {
                                                              const ext = att.name ? att.name.split(".").pop()?.toLowerCase() || "txt" : "file";
                                                              return (
                                                                  <DocumentAttachmentCard
                                                                      key={att.id || idx}
                                                                      attachment={att}
                                                                      extension={ext}
                                                                      isSelf={false}
                                                                      highlightCodeTokens={highlightCodeTokens}
                                                                  />
                                                              );
                                                          })}
                                                      </div>
                                                  );
                                              })()}
                                          </div>
                                          <div className="flex items-center justify-between gap-4 mt-2.5 pt-1">
                                              {msg.reactions && msg.reactions.length > 0 && (
                                                  <div className="flex items-center gap-1.5">
                                                      {msg.reactions.map((r, i) => (
                                                          <span
                                                              key={i}
                                                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-[#e2e5f1] rounded-full text-base font-medium text-[#4a4d63] shadow-xs"
                                                          >
                                                              <span>{r.emoji}</span> {r.count}
                                                          </span>
                                                      ))}
                                                  </div>
                                              )}
                                              <div className="flex items-center gap-2 text-sm text-[#8e90a6]">
                                                  {msg.views !== undefined && (
                                                      <span className="flex items-center gap-1">
                                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                              <circle cx="12" cy="12" r="3" />
                                                          </svg>
                                                          {msg.views}
                                                      </span>
                                                  )}
                                                  <span>{msg.time}</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      }
                  })}
            {messages.length > 0 && messages[messages.length - 1].isSelf && (
                <div className="flex justify-center my-3 animate-in fade-in duration-200 select-none">
                    <button
                        type="button"
                        onClick={handleCallForAnswer}
                        className="px-5 py-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white text-sm font-semibold rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                        <span>🤖</span>
                        <span>Call for an answer</span>
                    </button>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};
