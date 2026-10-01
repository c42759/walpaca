import React, { useEffect, useRef } from 'react';
import { ChatMessageItem, Message } from './ChatMessageItem';

export interface ChatMessageListProps {
  messages: Message[];
  isGenerating?: boolean;
  copiedMessageId: string | null;
  handleCopyMessage: (id: string, text: string) => void;
  handleRegenerateMessage?: (messageId: string) => void;
  setActiveAttachmentModal: (modal: { open: boolean; type: string; title: string; content: any } | null) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isGenerating,
  copiedMessageId,
  handleCopyMessage,
  handleRegenerateMessage,
  setActiveAttachmentModal,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  if (messages.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center p-8 text-center select-none'>
        <div className='w-16 h-16 rounded-3xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-2xl mb-4 shadow-sm'>
          🦙
        </div>
        <h3 className='text-xl font-bold text-[#202022] tracking-tight'>Welcome to Walpaca</h3>
        <p className='text-sm text-[#7a7d90] max-w-sm mt-1 leading-relaxed font-medium'>
          Select a character or model from the top selector and start a conversation.
        </p>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto p-6 space-y-4'>
      {messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          message={msg}
          copiedMessageId={copiedMessageId}
          handleCopyMessage={handleCopyMessage}
          handleRegenerateMessage={handleRegenerateMessage}
          setActiveAttachmentModal={setActiveAttachmentModal}
        />
      ))}

      {isGenerating && (
        <div className='flex items-center gap-3 p-4 rounded-3xl bg-white border border-[#e8ebf3] max-w-xs shadow-xs animate-pulse'>
          <div className='w-8 h-8 rounded-xl bg-[#eaecf9] text-[#7678ed] flex items-center justify-center font-bold text-xs'>
            🦙
          </div>
          <span className='text-xs font-semibold text-[#7a7d90]'>Thinking & generating response...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
