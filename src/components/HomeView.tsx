import React from 'react';
import { CosmicOrb } from './CelestialArtwork';
import { ActiveTab } from '../types';
import { Sparkles, Moon } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  return (
    <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-4 py-8 sm:py-12 text-center z-10">
      {/* Central Celestial Cosmic Orb Graphic */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="mb-8 sm:mb-12"
      >
        <CosmicOrb />
      </motion.div>

      {/* Content Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="max-w-2xl mx-auto flex flex-col items-center"
      >
        {/* Eyebrow */}
        <span className="font-sans-ui text-[11px] sm:text-xs tracking-[0.25em] text-[#93A1BC] uppercase mb-3 sm:mb-4">
          YOUR LITTLE UNIVERSE
        </span>

        {/* Headline */}
        <h1 className="font-cormorant text-4xl sm:text-5xl md:text-6xl text-[#F8F6F0] font-normal leading-[1.15] mb-4 sm:mb-5">
          A little magic for your day.
        </h1>

        {/* Description */}
        <p className="font-sans-ui text-sm sm:text-base text-[#9EACCA] max-w-lg mb-8 sm:mb-10 leading-relaxed font-light">
          Take a breath, look at the stars, and see what today has waiting for you.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
          <button
            id="home-discover-today-btn"
            onClick={() => onNavigate('today')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-sans-ui font-medium text-sm transition-all duration-200 transform hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(229,201,141,0.25)]"
          >
            <Sparkles className="w-4 h-4 text-[#0A0E22]" />
            <span>Discover Today</span>
          </button>

          <button
            id="home-explore-week-btn"
            onClick={() => onNavigate('week')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[#0D132D]/70 hover:bg-[#151D44] text-[#E2E8F0] border border-white/15 hover:border-white/30 font-sans-ui font-medium text-sm transition-all duration-200"
          >
            <Moon className="w-4 h-4 text-[#E5C98D]" />
            <span>Explore Your Week</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
