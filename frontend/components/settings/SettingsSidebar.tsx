'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type SettingsCategory = 'import-chat' | 'manage-instances' | 'preferences' | 'manage-lorebook' | 'manage-personas' | 'about-walpaca';

export interface SettingsSidebarProps {
	activeSettingsCategory: SettingsCategory;
	setActiveSettingsCategory: (category: SettingsCategory) => void;
	setCurrentView?: (view: 'chat' | 'settings') => void;
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

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSettingsCategory, setActiveSettingsCategory, setCurrentView }) => {
	const router = useRouter();
	const pathname = usePathname();
	const [searchQuery, setSearchQuery] = useState('');

	const currentActive: SettingsCategory =
		pathname === '/settings/about'
			? 'about-walpaca'
			: pathname === '/settings/instances'
				? 'manage-instances'
				: pathname === '/settings/lorebook'
					? 'manage-lorebook'
					: pathname === '/settings/personas'
						? 'manage-personas'
						: pathname === '/settings/preferences'
							? 'preferences'
							: pathname === '/settings/import'
								? 'import-chat'
								: activeSettingsCategory;

	const categories: Array<{
		id: SettingsCategory;
		label: string;
		description: string;
		gradient: string;
		icon: React.ReactNode;
	}> = [
		{
			id: 'import-chat',
			label: 'Import Chat',
			description: 'Import conversation logs, JSON, or Markdown',
			gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
					<polyline points='17 8 12 3 7 8' />
					<line x1='12' y1='3' x2='12' y2='15' />
				</svg>
			),
		},
		{
			id: 'manage-instances',
			label: 'Manage Instances',
			description: 'Configure Ollama, OpenAI, & API backends',
			gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
					<rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
					<line x1='6' y1='6' x2='6.01' y2='6' />
					<line x1='6' y1='18' x2='6.01' y2='18' />
				</svg>
			),
		},
		{
			id: 'manage-lorebook',
			label: 'Manage Lorebook',
			description: 'World info entries and context keywords',
			gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
					<path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' />
				</svg>
			),
		},
		{
			id: 'manage-personas',
			label: 'Manage Personas',
			description: 'Custom character profiles & avatars',
			gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
					<circle cx='12' cy='7' r='4' />
				</svg>
			),
		},
		{
			id: 'preferences',
			label: 'Preferences',
			description: 'Global defaults, theme, and generation parameters',
			gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<line x1='4' y1='21' x2='4' y2='14' />
					<line x1='4' y1='10' x2='4' y2='3' />
					<line x1='12' y1='21' x2='12' y2='12' />
					<line x1='12' y1='8' x2='12' y2='3' />
					<line x1='20' y1='21' x2='20' y2='16' />
					<line x1='20' y1='12' x2='20' y2='3' />
				</svg>
			),
		},
		{
			id: 'about-walpaca',
			label: 'About Walpaca',
			description: 'Version info, updates, and system details',
			gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
			icon: (
				<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<circle cx='12' cy='12' r='10' />
					<line x1='12' y1='16' x2='12' y2='12' />
					<line x1='12' y1='8' x2='12.01' y2='8' />
				</svg>
			),
		},
	];

	const filteredCategories = categories.filter((c) => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return true;
		return c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
	});

	const categoryRouteMap: Record<SettingsCategory, string> = {
		'import-chat': '/settings/import',
		'manage-instances': '/settings/instances',
		'manage-lorebook': '/settings/lorebook',
		'manage-personas': '/settings/personas',
		'preferences': '/settings/preferences',
		'about-walpaca': '/settings/about',
	};

	const handleCategoryClick = (catId: SettingsCategory) => {
		setActiveSettingsCategory(catId);
		const target = categoryRouteMap[catId] || '/settings/import';
		router.push(target);
	};

	const handleBackToChat = () => {
		if (setCurrentView) {
			setCurrentView('chat');
		}
		router.push('/');
	};

	return (
		<section className='w-[350px] border-r border-[#e8ebf3] flex flex-col bg-[#f9fafc] shrink-0'>
			{/* Search Bar Header matching ChatListPanel */}
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
			</div>

			{/* Category List */}
			<div className='flex-1 overflow-y-auto px-3 space-y-1.5 custom-scrollbar pb-4'>
				{filteredCategories.map((cat) => {
					const isActive = (currentActive || activeSettingsCategory) === cat.id;

					return (
						<div
							key={cat.id}
							draggable={true}
							onClick={() => handleCategoryClick(cat.id)}
							className={`relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all`}
						>
							{/* Avatar */}
							<div
								style={{ background: defaultGetAvatarColor(cat.label) }}
								className='w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg tracking-wide shrink-0 shadow-sm'
							>
								{cat.icon}
							</div>

							{/* Info */}
							<div className='flex-1 min-w-0'>
								<div className='flex items-center justify-between gap-1 mb-0.5'>
									<h4 className='font-semibold text-lg text-[#202022] truncate'>{cat.label}</h4>
								</div>
								<div className='flex items-center justify-between gap-1'>
									<p className={`text-xs ${isActive ? 'text-[#7678ed] font-medium' : 'text-[#7a7d90]'}`}>{cat.description}</p>
								</div>
							</div>
						</div>
					);
				})}

				{filteredCategories.length === 0 && (
					<div className='p-8 text-center text-xs text-[#8e90a6] font-medium'>No settings found matching &ldquo;{searchQuery}&rdquo;</div>
				)}
			</div>

			{/* Back to Chat Footer */}
			<div className='p-3 border-t border-[#e8ebf3] bg-[#f9fafc]'>
				<button
					onClick={handleBackToChat}
					className='w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] font-semibold text-sm transition-all cursor-pointer shadow-xs'
				>
					<svg
						width='16'
						height='16'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2.2'
						strokeLinecap='round'
						strokeLinejoin='round'
					>
						<line x1='19' y1='12' x2='5' y2='12' />
						<polyline points='12 19 5 12 12 5' />
					</svg>
					<span>Back to Chat</span>
				</button>
			</div>
		</section>
	);
};
