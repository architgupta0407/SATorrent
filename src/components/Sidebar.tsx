import React from 'react';
import {
  LayoutDashboard,
  ArrowDownUp,
  Network,
  Users,
  FolderCheck,
  Settings,
  Terminal,
} from 'lucide-react';

export type NavTab = 'overview' | 'transfers' | 'swarm' | 'peers' | 'files' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeTransfersCount: number;
  completedFilesCount: number;
  peersCount: number;
  isDebugOpen: boolean;
  onToggleDebug: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeTransfersCount,
  completedFilesCount,
  peersCount,
  isDebugOpen,
  onToggleDebug,
}) => {
  const mainNav = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'transfers' as NavTab,
      label: 'Transfers',
      icon: ArrowDownUp,
      badge: activeTransfersCount > 0 ? activeTransfersCount : undefined,
    },
    {
      id: 'swarm' as NavTab,
      label: 'Swarm',
      icon: Network,
    },
    {
      id: 'peers' as NavTab,
      label: 'Peers',
      icon: Users,
      badge: peersCount > 0 ? peersCount : undefined,
    },
    {
      id: 'files' as NavTab,
      label: 'Files',
      icon: FolderCheck,
      badge: completedFilesCount > 0 ? completedFilesCount : undefined,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Desktop Left Sidebar: 190px–200px width, dense, restrained */}
      <aside className="w-48 bg-[#111418] border-r border-[#272d34] flex-col justify-between p-2 select-none flex-shrink-0 hidden md:flex text-xs">
        <div className="space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-[#656d77] uppercase tracking-wider">
            Library
          </div>

          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#1e293b] text-[#e7eaee] font-medium'
                    : 'text-[#9299a3] hover:text-[#e7eaee] hover:bg-[#161a1f]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-[#656d77]'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded font-mono ${
                      isActive ? 'bg-blue-600/30 text-blue-300' : 'bg-[#191e24] text-[#9299a3]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Dev Console Launcher */}
        <div className="pt-2 border-t border-[#272d34]">
          <button
            onClick={onToggleDebug}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors cursor-pointer text-[11px] ${
              isDebugOpen
                ? 'bg-[#1e293b] text-blue-300 font-medium'
                : 'text-[#9299a3] hover:text-[#e7eaee] hover:bg-[#161a1f]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#656d77]" />
              <span>Console</span>
            </div>
            <span className={`w-1.5 h-1.5 rounded-full ${isDebugOpen ? 'bg-blue-400' : 'bg-[#656d77]'}`} />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#111418] border-t border-[#272d34] z-30 flex items-center justify-around py-1 px-1 text-[10px]">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 p-1 rounded transition-colors ${
                isActive ? 'text-blue-400 font-medium' : 'text-[#656d77] hover:text-[#9299a3]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-[#656d77]'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 text-[8px] rounded-full bg-blue-600 text-white font-mono">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
