import React, { useEffect } from "react";
import { CloseIcon } from "../icons/Icons";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
    dark?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = "md", dark = false }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidthStyles = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
            <div
                className={`w-full ${maxWidthStyles[maxWidth]} rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-200 border ${
                    dark ? "bg-[#202022] text-white border-white/20" : "bg-white text-[#202022] border-[#e8ebf3]"
                }`}
            >
                {title && (
                    <div className={`flex items-center justify-between mb-4 pb-3 border-b ${dark ? "border-white/10" : "border-[#e8ebf3]"}`}>
                        <h3 className={`text-lg font-bold ${dark ? "text-white" : "text-[#202022]"}`}>{title}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className={`p-1 rounded-xl transition-colors cursor-pointer ${
                                dark ? "text-white/60 hover:text-white hover:bg-white/10" : "text-[#8e90a6] hover:text-[#202022] hover:bg-[#eaecf9]"
                            }`}
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
};
