import React from 'react';

export const BrainIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<path d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z' />
		<path d='M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z' />
	</svg>
);

export const MetadataIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<polyline points='16 18 22 12 16 6' />
		<polyline points='8 6 2 12 8 18' />
		<line x1='12' y1='2' x2='12' y2='22' opacity='0.4' />
	</svg>
);

export const SearchIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<circle cx='11' cy='11' r='8' />
		<line x1='21' y1='21' x2='16.65' y2='16.65' />
	</svg>
);

export const PlusIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
		<line x1='12' y1='5' x2='12' y2='19' />
		<line x1='5' y1='12' x2='19' y2='12' />
	</svg>
);

export const EditIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
		<path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
	</svg>
);

export const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<polyline points='3 6 5 6 21 6' />
		<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
	</svg>
);

export const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
		<polyline points='20 6 9 17 4 12' />
	</svg>
);

export const ChevronIcon = ({ className = 'w-4 h-4', direction = 'down' }: { className?: string; direction?: 'up' | 'down' | 'left' | 'right' }) => {
	const rotationMap = {
		up: 'rotate-180',
		down: '',
		left: 'rotate-90',
		right: '-rotate-90',
	};
	return (
		<svg
			className={`${className} transition-transform ${rotationMap[direction]}`}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2'
			strokeLinecap='round'
			strokeLinejoin='round'
		>
			<polyline points='6 9 12 15 18 9' />
		</svg>
	);
};

export const ChevronDownIcon = ({ className = 'w-4 h-4', strokeWidth = 2 }: { className?: string; strokeWidth?: number | string }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth={strokeWidth}
		strokeLinecap='round'
		strokeLinejoin='round'
	>
		<polyline points='6 9 12 15 18 9' />
	</svg>
);


export const CloseIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
		<line x1='18' y1='6' x2='6' y2='18' />
		<line x1='6' y1='6' x2='18' y2='18' />
	</svg>
);

export const SettingsIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<circle cx='12' cy='12' r='3' />
		<path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z' />
	</svg>
);

export const ChatIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
	</svg>
);

export const FolderIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' />
	</svg>
);

export const AttachmentIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
		<path d='m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66l-8.59 8.58a2 2 0 0 1-2.83-2.83l8.49-8.48' />
	</svg>
);

export const ServerIcon = ({ className = 'w-4 h-4', color = 'black' }: { className?: string, color?: string }) => (
	<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
		<rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
		<rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
		<line x1='6' y1='6' x2='6.01' y2='6' />
		<line x1='6' y1='18' x2='6.01' y2='18' />
	</svg>
);
