import React from 'react';
import {
  LayoutDashboard,
  ArrowDownUp,
  Network,
  Users,
  FolderCheck,
  Settings,
  Terminal,
  ShieldCheck,
  Radio,
  HardDrive,
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
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      id: 'swarm' as NavTab,
      label: 'Swarm Mesh',
      icon: Network,
    },
    {
      id: 'peers' as NavTab,
      label: 'Peers',
      icon: Users,
      badge: peersCount > 0 ? peersCount : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      id: 'files' as NavTab,
      label: 'Files',
      icon: FolderCheck,
      badge: completedFilesCount > 0 ? completedFilesCount : undefined,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Left Sidebar */}
      <aside className="w-48 lg:w-52 bg-[#070a12] border-r border-slate-800/80 flex-col justify-between p-2 select-none flex-shrink-0 hidden md:flex font-mono text-xs">
        <div className="space-y-4">
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 text-[9px] font-bold tracking-widest text-slate-500 uppercase">
              CLIENT
            </div>

            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.15)] font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 text-[9px] font-bold border rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Technical Status & Dev Drawer Button */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          {/* Real Network Architecture Badge */}
          <div className="px-2.5 py-1.5 rounded-md bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1 font-semibold text-[10px]">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                P2P Protocol
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">ACTIVE</span>
            </div>
            <div className="text-[9px] text-slate-500 flex items-center justify-between">
              <span>Mesh DataChannel:</span>
              <span className="text-cyan-300">64 KB Frames</span>
            </div>
          </div>

          <button
            onClick={onToggleDebug}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] transition-all cursor-pointer border ${
              isDebugOpen
                ? 'bg-purple-950/60 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)] font-bold'
                : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-purple-400" />
              <span>Dev Console</span>
            </div>
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isDebugOpen ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#060a12] border-t border-slate-800 z-30 flex items-center justify-around py-1.5 px-2 font-mono text-[10px]">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 p-1 rounded transition-colors ${
                isActive ? 'text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 text-[8px] rounded-full bg-cyan-500 text-black font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
