import React, { useState } from 'react';
import { ActiveTab } from '../types';
import { Share2, Menu, X, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenShare: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenShare,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'tarot', label: 'Tarot' },
    { id: 'message', label: 'Your Message' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080B14]/80 backdrop-blur-md border-b border-white/5 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          id="brand-logo-btn"
          onClick={() => {
            setActiveTab('home');
            setMobileMenuOpen(false);
          }}
          className="group flex items-center gap-2.5 text-left focus:outline-none"
        >
          <span className="font-cormorant text-2xl sm:text-3xl lg:text-[32px] font-medium tracking-tight text-[#F7F2E7] group-hover:text-[#E5C98D] transition-colors duration-300">
            The Little Universe
          </span>
          <Sparkles className="w-4 h-4 text-[#E5C98D]/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8 lg:space-x-10">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`relative py-1 text-sm font-sans-ui tracking-wide transition-all duration-200 focus:outline-none ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full animate-in fade-in" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right CTA / Share button */}
        <div className="flex items-center gap-3">
          <button
            id="header-share-btn"
            onClick={onOpenShare}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-sans-ui tracking-wider uppercase text-[#D1D5DB] hover:text-white hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            <span>Share</span>
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-6 bg-[#0B0F22]/95 border-b border-white/10 backdrop-blur-xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-3 pt-2">
            <button
              onClick={() => {
                setActiveTab('home');
                setMobileMenuOpen(false);
              }}
              className={`text-left px-3 py-2 rounded-lg text-sm font-sans-ui ${
                activeTab === 'home'
                  ? 'bg-[#1C254B] text-[#E5C98D] font-medium'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              🌌 Sanctuary Home
            </button>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-sans-ui ${
                  activeTab === item.id
                    ? 'bg-[#1C254B] text-[#E5C98D] font-medium'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
