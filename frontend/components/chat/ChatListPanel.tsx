'use client';

import React from 'react';

export interface ChatItem {
	id: string;
	name: string;
	avatarText?: string;
	avatarImg?: string;
	lastMessage: string;
	time: string;
	unreadCount?: number;
	isPinned?: boolean;
	isDelivered?: boolean;
	folder?: string;
}

export interface ChatListPanelProps {
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	handleOpenNewChatModal: () => void;
	chatItems: ChatItem[];
	activeTab: string;
	activeChatId: string;
	setActiveChatId: (id: string) => void;
	draggedChatId: string | null;
	setDraggedChatId: (id: string | null) => void;
	setDragOverFolderTarget: (target: string | null) => void;
	getAvatarColor?: (name: string) => string;
}

const defaultGetAvatarColor = (name: string): string => {
	if (!name) return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}

	const gradients = [
		'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
		'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
		'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
		'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
		'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
		'linear-gradient(135deg, #10b981 0%, #059669 100%)',
		'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
		'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
		'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
		'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
		'linear-gradient(135deg, #059669 0%, #047857 100%)',
	];

	return gradients[Math.abs(hash) % gradients.length];
};

export const ChatListPanel: React.FC<ChatListPanelProps> = ({
	searchQuery,
	setSearchQuery,
	handleOpenNewChatModal,
	chatItems,
	activeTab,
	activeChatId,
	setActiveChatId,
	draggedChatId,
	setDraggedChatId,
	setDragOverFolderTarget,
	getAvatarColor = defaultGetAvatarColor,
}) => {
	const filteredChats = chatItems.filter((chat) => {
		const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesFolder =
			activeTab === 'none' || activeTab === 'all'
				? !chat.folder || chat.folder === 'none'
				: chat.folder === activeTab;
		return matchesSearch && matchesFolder;
	});

	return (
		<section className='w-[350px] border-r border-[#e8ebf3] flex flex-col bg-[#f9fafc] shrink-0'>
			{/* Search Bar Header */}
			<div className='p-4 pb-3 flex items-center gap-2'>
				<div className='relative flex-1 flex items-center bg-[#eaecf9] rounded-2xl px-3.5 py-2.5 transition-colors focus-within:bg-[#e2e5f8]'>
					<svg
						width='18'
						height='18'
						viewBox='0 0 24 24'
						fill='none'
						stroke='#7678ed'
						strokeWidth='2.2'
						strokeLinecap='round'
						strokeLinejoin='round'
						className='mr-2.5 shrink-0 opacity-80'
					>
						<circle cx='11' cy='11' r='8' />
						<line x1='21' y1='21' x2='16.65' y2='16.65' />
					</svg>
					<input
						type='text'
						placeholder='Search'
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className='bg-transparent text-lg text-[#202022] placeholder-[#8e90a6] outline-none w-full font-medium'
					/>
				</div>
				<button
					onClick={handleOpenNewChatModal}
					className='p-2.5 bg-[#7678ed] hover:bg-[#6869d9] text-white rounded-2xl flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer'
					title='Create New Chat'
				>
					<svg
						width='18'
						height='18'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2.5'
						strokeLinecap='round'
						strokeLinejoin='round'
					>
						<line x1='12' y1='5' x2='12' y2='19' />
						<line x1='6' y1='12' x2='18' y2='12' />
					</svg>
				</button>
			</div>

			{/* Chat List Scrollable Items */}
			<div className='flex-1 overflow-y-auto px-2 space-y-1.5 pb-4'>
				{filteredChats.map((chat) => {
					const isSelected = activeChatId === chat.id;
					const isBeingDragged = draggedChatId === chat.id;
					return (
						<div
							key={chat.id}
							draggable={true}
							onDragStart={(e) => {
								e.dataTransfer.setData('text/plain', chat.id);
								e.dataTransfer.effectAllowed = 'move';
								setDraggedChatId(chat.id);
							}}
							onDragEnd={() => {
								setDraggedChatId(null);
								setDragOverFolderTarget(null);
							}}
							onClick={() => {
								setActiveChatId(chat.id);
								if (typeof window !== 'undefined') {
									window.history.pushState(null, '', `/${chat.id}`);
								}
							}}
							className={`relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:cursor-grabbing transition-all ${
								isBeingDragged ? 'opacity-40 scale-95 border-2 border-dashed border-[#7678ed]' : ''
							} ${isSelected ? 'bg-[#edeffb] shadow-[0_2px_8px_rgba(118,120,237,0.08)]' : 'hover:bg-[#f2f4fa]'}`}
						>
							{/* Avatar */}
							{chat.avatarText ? (
								<div
									style={{ background: getAvatarColor(chat.name) }}
									className='w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg tracking-wide shrink-0 shadow-sm'
								>
									{chat.avatarText}
								</div>
							) : (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img
									src={chat.avatarImg}
									alt={chat.name}
									className='w-12 h-12 rounded-2xl object-cover shrink-0 shadow-sm'
								/>
							)}

							{/* Info */}
							<div className='flex-1 min-w-0'>
								<div className='flex items-center justify-between gap-1 mb-0.5'>
									<h4 className='font-semibold text-lg text-[#202022] truncate'>{chat.name}</h4>
									<span className='text-sm text-[#8e90a6] font-medium shrink-0'>{chat.time}</span>
								</div>
								<div className='flex items-center justify-between gap-1'>
									<p className={`text-xs truncate ${isSelected ? 'text-[#7678ed] font-medium' : 'text-[#7a7d90]'}`}>
										{chat.lastMessage}
									</p>

									{/* Pin / Badge / Delivered */}
									<div className='flex items-center gap-1.5 shrink-0'>
										{chat.unreadCount && (
											<span className='bg-[#ff7a55] text-white text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none'>
												{chat.unreadCount}
											</span>
										)}
										{chat.isPinned && (
											<svg
												width='13'
												height='13'
												viewBox='0 0 24 24'
												fill='#7678ed'
												stroke='#7678ed'
												strokeWidth='1.5'
											>
												<path d='M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z' />
											</svg>
										)}
										{chat.isDelivered && (
											<svg
												width='15'
												height='15'
												viewBox='0 0 24 24'
												fill='none'
												stroke='#7678ed'
												strokeWidth='2.5'
												strokeLinecap='round'
												strokeLinejoin='round'
											>
												<polyline points='18 6 9 17 4 12' />
											</svg>
										)}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
};
