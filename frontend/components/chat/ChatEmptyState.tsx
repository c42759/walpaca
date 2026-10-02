"use client";
/* eslint-disable @next/next/no-img-element */

import React from "react";

export interface ChatEmptyStateProps {
    title?: string;
    description?: string;
    iconSrc?: string;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
    title = "No chat select",
    description = "Select a conversation from the chat list on the left to view messages and continue chatting.",
    iconSrc = "/icon-black.svg",
}) => {
    return (
        <section className="flex-1 flex flex-col items-center justify-center bg-white p-8 text-center select-none">
            <div className="w-24 h-24 rounded-3xl bg-[#f0f2f9] flex items-center justify-center mb-6 text-[#7678ed] shadow-inner">
                <img src={iconSrc} alt="Alpaca Logo" className="w-14 h-14 opacity-70" />
            </div>
            <h3 className="text-2xl font-bold text-[#202022] mb-2">{title}</h3>
            <p className="text-base text-[#8e90a6] max-w-sm">{description}</p>
        </section>
    );
};
