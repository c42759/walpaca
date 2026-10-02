import React from "react";
import { BrainIcon, MetadataIcon, CheckIcon } from "../icons/Icons";
import { Button } from "../ui/Button";

export interface MessageAttachment {
    type: string;
    name: string;
    content: any;
}

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    time?: string;
    model?: string;
    avatarText?: string;
    avatarImg?: string;
    attachments?: MessageAttachment[];
    metadata?: any;
    thought?: string;
}

export interface ChatMessageItemProps {
    message: Message;
    setActiveAttachmentModal: (modal: { open: boolean; type: string; title: string; content: any } | null) => void;
    copiedMessageId: string | null;
    handleCopyMessage: (id: string, text: string) => void;
    handleRegenerateMessage?: (messageId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, setActiveAttachmentModal, copiedMessageId, handleCopyMessage, handleRegenerateMessage }) => {
    const isUser = message.role === "user";

    return (
        <div className={`flex items-start gap-4 mb-6 animate-in fade-in duration-200 ${isUser ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className="w-10 h-10 rounded-2xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-sm shrink-0 border border-[#7678ed]/20 shadow-xs overflow-hidden">
                {message.avatarImg ? <img src={message.avatarImg} alt={message.role} className="w-full h-full object-cover" /> : message.avatarText || (isUser ? "U" : "AI")}
            </div>

            {/* Message Content Container */}
            <div className={`flex flex-col max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold text-[#202022]">{isUser ? "You" : message.model || "Assistant"}</span>
                    {message.time && <span className="text-[10px] text-[#a0a3b5] font-medium">{message.time}</span>}
                </div>

                {/* Thought Process Box (If Present) */}
                {message.thought && (
                    <div className="mb-2.5 p-3 rounded-2xl bg-[#f0f2fb] border border-[#7678ed]/20 text-xs text-[#5d6075] space-y-1.5 w-full">
                        <div className="flex items-center gap-1.5 font-semibold text-[#7678ed]">
                            <BrainIcon className="w-3.5 h-3.5" />
                            <span>Thinking Process</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed font-mono text-[11px]">{message.thought}</p>
                    </div>
                )}

                {/* Text Bubble */}
                <div
                    className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                        isUser ? "bg-[#7678ed] text-white rounded-tr-xs" : "bg-white text-[#202022] border border-[#e8ebf3] rounded-tl-xs"
                    }`}
                >
                    {message.text}
                </div>

                {/* Attachments Pills */}
                {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {message.attachments.map((att, idx) => (
                            <button
                                key={idx}
                                onClick={() =>
                                    setActiveAttachmentModal({
                                        open: true,
                                        type: att.type,
                                        title: att.name || "Attachment",
                                        content: att.content,
                                    })
                                }
                                className="px-3 py-1.5 rounded-xl bg-white border border-[#e8ebf3] hover:border-[#7678ed] text-xs font-medium text-[#202022] shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                {att.type === "thought" ? <BrainIcon className="w-3.5 h-3.5 text-[#7678ed]" /> : <MetadataIcon className="w-3.5 h-3.5 text-[#7678ed]" />}
                                <span className="truncate max-w-[150px]">{att.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center gap-2 mt-1.5 px-1 opacity-80 hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => handleCopyMessage(message.id, message.text)}
                        className="text-[11px] text-[#a0a3b5] hover:text-[#7678ed] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                        {copiedMessageId === message.id ? (
                            <>
                                <CheckIcon className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-semibold">Copied</span>
                            </>
                        ) : (
                            <span>Copy</span>
                        )}
                    </button>
                    {!isUser && handleRegenerateMessage && (
                        <button
                            onClick={() => handleRegenerateMessage(message.id)}
                            className="text-[11px] text-[#a0a3b5] hover:text-[#7678ed] font-medium cursor-pointer transition-colors"
                        >
                            Regenerate
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
