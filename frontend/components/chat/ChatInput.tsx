import React, { useRef } from 'react';
import { BrainIcon, AttachmentIcon, MetadataIcon, CloseIcon } from '../icons/Icons';

export interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  handleSendMessage: () => void;
  isGenerating?: boolean;
  handleStopGeneration?: () => void;
  selectedAttachments: Array<{ type: string; name: string; content: any }>;
  handleRemoveAttachment: (index: number) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (enabled: boolean) => void;
  selectedModelName?: string;
  selectedInstName?: string;
  setIsSelectModelModalOpen: (open: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  handleSendMessage,
  isGenerating,
  handleStopGeneration,
  selectedAttachments,
  handleRemoveAttachment,
  handleFileUpload,
  thinkingEnabled,
  setThinkingEnabled,
  selectedModelName,
  selectedInstName,
  setIsSelectModelModalOpen,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className='p-4 border-t border-[#e8ebf3] bg-white shrink-0 select-none shadow-2xs'>
      {/* Attached Files Bar */}
      {selectedAttachments.length > 0 && (
        <div className='flex flex-wrap gap-2 mb-3 px-1'>
          {selectedAttachments.map((att, idx) => (
            <div
              key={idx}
              className='px-3 py-1.5 rounded-xl bg-[#eaecf9] border border-[#7678ed]/20 text-xs font-medium text-[#7678ed] flex items-center gap-2 shadow-2xs'
            >
              <AttachmentIcon className='w-3.5 h-3.5' />
              <span className='truncate max-w-[160px]'>{att.name}</span>
              <button
                type='button'
                onClick={() => handleRemoveAttachment(idx)}
                className='hover:text-rose-500 transition-colors cursor-pointer ml-1'
              >
                <CloseIcon className='w-3.5 h-3.5' />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Bar */}
      <div className='bg-[#f9fafc] border border-[#e8ebf3] focus-within:border-[#7678ed] rounded-3xl p-3 flex flex-col gap-2 transition-all shadow-xs'>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Send a message to Walpaca... (Press Enter to send, Shift+Enter for new line)'
          rows={2}
          className='w-full bg-transparent outline-none resize-none text-sm text-[#202022] placeholder-[#a0a3b5] px-2 py-1 leading-relaxed'
        />

        {/* Bottom Toolbar */}
        <div className='flex items-center justify-between pt-2 border-t border-[#e8ebf3]/60 px-1'>
          <div className='flex items-center gap-2'>
            {/* Model Selector Pill */}
            <button
              type='button'
              onClick={() => setIsSelectModelModalOpen(true)}
              className='px-3 py-1.5 rounded-xl bg-white border border-[#e8ebf3] hover:border-[#7678ed] text-xs font-semibold text-[#202022] shadow-2xs transition-all cursor-pointer flex items-center gap-1.5'
            >
              <span className='truncate max-w-[120px]'>{selectedModelName || 'Select Model'}</span>
              {selectedInstName && <span className='text-[#7678ed] text-[10px] font-bold'>@{selectedInstName}</span>}
            </button>

            {/* Thinking Mode Toggle */}
            <button
              type='button'
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                thinkingEnabled
                  ? 'bg-[#eaecf9] text-[#7678ed] border border-[#7678ed]/30'
                  : 'bg-white text-[#8e90a6] border border-[#e8ebf3] hover:text-[#202022]'
              }`}
              title='Toggle Thinking Mode'
            >
              <BrainIcon className='w-3.5 h-3.5' />
              <span>Thinking</span>
            </button>

            {/* File Upload Hidden Input & Trigger */}
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileUpload}
              className='hidden'
              multiple
            />
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='p-1.5 rounded-xl bg-white border border-[#e8ebf3] hover:border-[#7678ed] text-[#8e90a6] hover:text-[#7678ed] transition-colors cursor-pointer shadow-2xs'
              title='Attach Files'
            >
              <AttachmentIcon className='w-4 h-4' />
            </button>
          </div>

          {/* Send / Stop Button */}
          {isGenerating ? (
            <button
              type='button'
              onClick={handleStopGeneration}
              className='px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-all cursor-pointer shadow-md shadow-rose-500/20'
            >
              Stop
            </button>
          ) : (
            <button
              type='button'
              onClick={handleSendMessage}
              disabled={!inputText.trim() && selectedAttachments.length === 0}
              className={`px-4 py-2 rounded-2xl font-semibold text-xs transition-all cursor-pointer shadow-md ${
                inputText.trim() || selectedAttachments.length > 0
                  ? 'bg-[#7678ed] hover:bg-[#6869d9] text-white shadow-[#7678ed]/20'
                  : 'bg-[#eaecf9] text-[#a0a3b5] cursor-not-allowed shadow-none'
              }`}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
