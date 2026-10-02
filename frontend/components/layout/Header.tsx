import React from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { EditIcon, TrashIcon, PlusIcon, ChevronIcon } from "../icons/Icons";

export interface HeaderProps {
    activeChatTitle: string;
    activeChatId: string | null;
    selectedChatModelName: string;
    selectedChatInstanceName: string;
    setIsSelectModelModalOpen: (open: boolean) => void;
    handleOpenRenameModal: () => void;
    handleOpenDuplicateModal: () => void;
    handleOpenExportModal: () => void;
    handleOpenDeleteModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    activeChatTitle,
    activeChatId,
    selectedChatModelName,
    selectedChatInstanceName,
    setIsSelectModelModalOpen,
    handleOpenRenameModal,
    handleOpenDuplicateModal,
    handleOpenExportModal,
    handleOpenDeleteModal,
}) => {
    return (
        <header className="px-6 py-4 border-b border-[#e8ebf3] bg-white flex items-center justify-between shrink-0 shadow-2xs select-none">
            {/* Title & Model Selector */}
            <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[#202022] truncate tracking-tight">{activeChatTitle || "Select or Start a Chat"}</h2>
                    <p className="text-xs text-[#8e90a6] truncate mt-0.5 font-medium">
                        Active Model: <span className="text-[#7678ed] font-semibold">{selectedChatModelName}</span> @ {selectedChatInstanceName}
                    </p>
                </div>

                <button
                    onClick={() => setIsSelectModelModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#eaecf9] hover:bg-[#e0e3f5] text-[#7678ed] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                    <span>Change Model</span>
                    <ChevronIcon direction="down" className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Action Buttons */}
            {activeChatId && (
                <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={handleOpenRenameModal} icon={<EditIcon className="w-3.5 h-3.5" />}>
                        Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleOpenExportModal}>
                        Export
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleOpenDuplicateModal}>
                        Duplicate
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleOpenDeleteModal} icon={<TrashIcon className="w-3.5 h-3.5" />}>
                        Delete
                    </Button>
                </div>
            )}
        </header>
    );
};
