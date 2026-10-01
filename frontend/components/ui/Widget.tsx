import React, { useState } from 'react';
import { ChevronDownIcon } from '../icons/Icons';

export const WidgetSimple: React.FC<{ title: string; content: React.ReactNode }> = ({ title, content, className = '' }) => {
	return (
		<div className={`bg-white rounded-3xl p-5 shadow-xs border border-[#edf0f7] ${className}`}>
			{/* Card Header */}
			<div className='flex items-center gap-2'>
				<h3 className='font-bold text-xl text-[#202022]'>{title}</h3>
			</div>

			{/* Collapsible Content */}
			<div className='mt-4 pt-3 border-t border-[#edf0f7] space-y-4'>{content}</div>
		</div>
	);
};

export const WidgetWithCustomHeader: React.FC<{ header: React.ReactNode; content: React.ReactNode }> = ({ header, content }) => {
	return (
		<div className={`bg-white rounded-3xl p-5 shadow-xs border border-[#edf0f7]`}>
			{/* Card Header with Collapse Toggle */}
			{header}

			{/* Collapsible Content */}
			<div className='mt-4 pt-3 border-t border-[#edf0f7] space-y-4'>{content}</div>
		</div>
	);
};

export const WidgetToggle: React.FC<{ header: string; content: React.ReactNode }> = ({ header, content }) => {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className='bg-white rounded-3xl p-5 shadow-xs border border-[#edf0f7]'>
			{/* Card Header with Collapse Toggle */}
			<button onClick={() => setIsExpanded(!isExpanded)} className='w-full flex items-center justify-between cursor-pointer select-none'>
				<div className='flex items-center gap-2'>
					{header}
				</div>
				<div className='p-1 text-[#8e90a6] hover:text-[#202022] transition-colors'>
					<ChevronDownIcon className={`w-[18px] h-[18px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} strokeWidth='2.2' />
				</div>
			</button>

			{/* Collapsible Content */}
			{isExpanded && <div className='mt-4 pt-3 border-t border-[#edf0f7] space-y-4'>{content}</div>}
		</div>
	);
};
