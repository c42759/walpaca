import React from 'react';
import { SettingsIcon, ChatIcon, FolderIcon } from '../icons/Icons';

export type SettingsCategory =
  | 'import-chat'
  | 'manage-instances'
  | 'preferences'
  | 'manage-lorebook'
  | 'manage-personas'
  | 'about-walpaca';

export interface SettingsSidebarProps {
  activeSettingsCategory: SettingsCategory;
  setActiveSettingsCategory: (category: SettingsCategory) => void;
  setCurrentView: (view: 'chat' | 'settings') => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSettingsCategory,
  setActiveSettingsCategory,
  setCurrentView,
}) => {
  const categories: Array<{ id: SettingsCategory; label: string; icon: React.ReactNode }> = [
    {
      id: 'import-chat',
      label: 'Import Chat',
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
          <polyline points='17 8 12 3 7 8' />
          <line x1='12' y1='3' x2='12' y2='15' />
        </svg>
      ),
    },
    {
      id: 'manage-lorebook',
      label: 'Manage Lorebook',
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
          <path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' />
        </svg>
      ),
    },
    {
      id: 'manage-personas',
      label: 'Manage Personas',
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
          <circle cx='12' cy='7' r='4' />
        </svg>
      ),
    },
    {
      id: 'manage-instances',
      label: 'Manage Instances',
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
          <rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
          <line x1='6' y1='6' x2='6.01' y2='6' />
          <line x1='6' y1='18' x2='6.01' y2='18' />
        </svg>
      ),
    },
    {
      id: 'preferences',
      label: 'Preferences',
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
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
      icon: (
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='10' />
          <line x1='12' y1='16' x2='12' y2='12' />
          <line x1='12' y1='8' x2='12.01' y2='8' />
        </svg>
      ),
    },
  ];

  return (
    <aside className='w-[260px] border-r border-[#e8ebf3] bg-[#f9fafc] p-5 flex flex-col justify-between shrink-0 select-none'>
      <div>
        <h2 className='text-xl font-bold text-[#202022] mb-6 px-2 tracking-tight'>Settings</h2>
        <nav className='space-y-1.5'>
          {categories.map((cat) => {
            const isActive = activeSettingsCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveSettingsCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-base font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#7678ed] text-white shadow-md shadow-[#7678ed]/20'
                    : 'text-[#5d6075] hover:bg-[#ebedf7] hover:text-[#202022]'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-[#7678ed]'}>{cat.icon}</span>
                <span className='truncate'>{cat.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={() => setCurrentView('chat')}
        className='w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#eaecf8] hover:bg-[#e0e3f5] text-[#202022] font-semibold text-sm transition-all cursor-pointer shadow-xs'
      >
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
          <line x1='19' y1='12' x2='5' y2='12' />
          <polyline points='12 19 5 12 12 5' />
        </svg>
        <span>Back to Chat</span>
      </button>
    </aside>
  );
};
