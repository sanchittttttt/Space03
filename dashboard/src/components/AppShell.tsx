import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite, LayoutDashboard, Activity, AlertCircle,
  BarChart3, BookOpen, Info, ChevronLeft, ChevronRight,
  Search, X, Command, Orbit
} from 'lucide-react';

export type AppPage = 'dashboard' | 'overview' | 'telemetry' | 'events' | 'evaluation' | 'evidence' | 'system';

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Mission Control',      icon: <Orbit size={15} /> },
  { id: 'overview',   label: 'Mission Overview',     icon: <LayoutDashboard size={15} /> },
  { id: 'telemetry',  label: 'Telemetry Explorer',   icon: <Activity size={15} /> },
  { id: 'events',     label: 'Anomaly Events',        icon: <AlertCircle size={15} /> },
  { id: 'evaluation', label: 'Evaluation',            icon: <BarChart3 size={15} /> },
  { id: 'evidence',   label: 'Evidence & Docs',       icon: <BookOpen size={15} /> },
  { id: 'system',     label: 'System Information',    icon: <Info size={15} /> },
];

interface ShellProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onBackToHero: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<ShellProps> = ({ currentPage, onNavigate, onBackToHero, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = NAV_ITEMS.find(n => n.id === currentPage);

  return (
    <div className="flex h-screen bg-[#060b14] text-gray-200 overflow-hidden font-inter">

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className={`
          relative z-50 hidden md:flex flex-col flex-shrink-0
          bg-[#07101d] border-r border-[#1a2a3d]
          overflow-hidden
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-[#1a2a3d] flex-shrink-0">
          <Satellite size={16} className="text-cyan-400 flex-shrink-0" strokeWidth={1.5} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                className="ml-3 overflow-hidden whitespace-nowrap"
              >
                <div className="text-[13px] font-bold tracking-widest text-white leading-none">OFFBEAT</div>
                <div className="text-[9px] font-mono text-cyan-400/80 tracking-widest mt-0.5">CATCH THE OFF-BEAT CHANNELS</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map(item => {
            const active = item.id === currentPage;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                  ${active
                    ? 'text-white bg-cyan-500/10 border-r-2 border-cyan-400'
                    : 'text-[#5a7a9a] hover:text-gray-200 hover:bg-white/[0.03]'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${active ? 'text-cyan-400' : ''}`}>{item.icon}</span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="text-[12.5px] font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-[#1a2a3d] p-2 flex-shrink-0">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center h-8 text-[#3a5a7a] hover:text-gray-400 transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </motion.aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="fixed top-0 left-0 bottom-0 w-60 z-50 flex flex-col bg-[#07101d] border-r border-[#1a2a3d] md:hidden"
          >
            <div className="flex items-center justify-between h-14 px-4 border-b border-[#1a2a3d]">
              <div className="flex items-center gap-2">
                <Satellite size={16} className="text-cyan-400" strokeWidth={1.5} />
                <span className="text-[13px] font-bold tracking-widest text-white">OFFBEAT</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 py-4">
              {NAV_ITEMS.map(item => {
                const active = item.id === currentPage;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all
                      ${active ? 'text-white bg-cyan-500/10 border-r-2 border-cyan-400' : 'text-[#5a7a9a] hover:text-gray-200'}`}
                  >
                    <span className={active ? 'text-cyan-400' : ''}>{item.icon}</span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 h-14 flex items-center gap-3 px-4 md:px-6 bg-[#07101d]/80 backdrop-blur-sm border-b border-[#1a2a3d] z-30">
          {/* Mobile menu */}
          <button
            className="md:hidden p-1.5 text-gray-500 hover:text-white"
            onClick={() => setMobileOpen(true)}
          >
            <LayoutDashboard size={18} />
          </button>

          {/* Back to hero */}
          <button
            onClick={onBackToHero}
            className="flex items-center gap-2 text-[#3a5a7a] hover:text-gray-300 transition-colors text-[12px] font-mono"
          >
            <ChevronLeft size={13} />
            <span className="hidden sm:inline">Landing</span>
          </button>

          <span className="text-[#1a2a3d] font-mono text-xs">/</span>

          {/* Breadcrumb */}
          <span className="text-[12px] font-medium text-gray-300">{currentItem?.label}</span>

          {/* Dataset badge */}
          <span className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-[#0d1f30] border border-[#1a3050] rounded text-[10px] font-mono text-cyan-400 tracking-wider">
            NASA JPL DATASET · SMAP & MSL
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search placeholder */}
          <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0d1f30] border border-[#1a2a3d] text-[11px] font-mono text-[#3a5a7a] hover:border-[#2a4a6a] hover:text-gray-400 transition-colors rounded-sm">
            <Search size={12} />
            <span>Search</span>
            <span className="ml-2 flex items-center gap-0.5 opacity-50">
              <Command size={10} />K
            </span>
          </button>

          {/* Anomaly count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-sm text-[10px] font-mono text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            2 events require review
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
