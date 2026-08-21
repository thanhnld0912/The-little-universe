import React, { useState } from 'react';
import { WEEK_FORECAST_DATA } from '../data/cosmicData';
import { DayForecast } from '../types';
import { Sparkles, Battery, BatteryMedium, BatteryCharging, Sun, Heart, Users, Cloud, Wind, RotateCcw, Zap, Coffee, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ThisWeekViewProps {
  onOpenShare: () => void;
}

export const ThisWeekView: React.FC<ThisWeekViewProps> = () => {
  const [selectedDay, setSelectedDay] = useState<DayForecast | null>(null);

  const getDayIcon = (type: string) => {
    switch (type) {
      case 'QUIET':
        return <Cloud className="w-3.5 h-3.5 text-[#93C5FD]" />;
      case 'FLOW':
        return <Wind className="w-3.5 h-3.5 text-[#A7F3D0]" />;
      case 'PIVOT':
        return <RotateCcw className="w-3.5 h-3.5 text-[#FDE047]" />;
      case 'CLARITY':
        return <Zap className="w-3.5 h-3.5 text-[#C084FC]" />;
      case 'REST':
        return <Coffee className="w-3.5 h-3.5 text-[#FCA5A5]" />;
      case 'REFLECT':
        return <BookOpen className="w-3.5 h-3.5 text-[#E5C98D]" />;
      default:
        return <Sun className="w-3.5 h-3.5 text-[#E5C98D]" />;
    }
  };

  const firstFour = WEEK_FORECAST_DATA.slice(0, 4);
  const friday = WEEK_FORECAST_DATA[4];
  const satSun = WEEK_FORECAST_DATA.slice(5, 7);

  return (
    <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10 sm:py-14 z-10">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-left w-full max-w-5xl mx-auto mb-10"
      >
        <div className="flex items-center gap-1.5 font-sans-ui text-[11px] tracking-[0.25em] text-[#93A1BC] uppercase mb-3">
          <Sparkles className="w-3 h-3 text-[#E5C98D]" />
          <span>THIS WEEK</span>
        </div>
        <h1 className="font-cormorant text-3xl sm:text-4xl md:text-5xl text-[#F8F6F0] font-normal leading-tight mb-3">
          Seven days. Seven little possibilities.
        </h1>
        <p className="font-sans-ui text-sm sm:text-base text-[#9EACCA] max-w-2xl font-light leading-relaxed">
          A subtle alignment of energies. Navigate the ebb and flow of the coming days with gentle awareness.
        </p>
      </motion.div>

      {/* Week Grid Layout */}
      <div className="w-full max-w-5xl mx-auto space-y-5 mb-12">
        {/* Row 1: MON, TUE, WED, THU (4 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {firstFour.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              onClick={() => setSelectedDay(item)}
              className="cosmic-glass rounded-2xl p-5 sm:p-6 border border-indigo-500/20 hover:border-[#E5C98D]/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between h-[160px] sm:h-[180px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(229,201,141,0.1)] hover:-translate-y-1"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-cormorant text-xl text-[#F7F4EC] group-hover:text-[#E5C98D] transition-colors tracking-wide">
                  {item.shortName}
                </span>
                <BatteryMedium className="w-4 h-4 text-[#8E9DB7] opacity-60" />
              </div>

              {/* Type pill */}
              <div className="flex items-center gap-1.5 text-[11px] font-sans-ui tracking-wider uppercase text-[#BAC7E0]">
                {getDayIcon(item.type)}
                <span>{item.type}</span>
              </div>

              {/* Tagline */}
              <p className="font-sans-ui text-xs text-[#9EACCA] leading-relaxed line-clamp-2">
                {item.tagline}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Row 2: FRIDAY (Highlighted Large) + SAT & SUN (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
          {/* FRIDAY - Special Peak Energy Highlight */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            onClick={() => setSelectedDay(friday)}
            className="lg:col-span-6 cosmic-glass rounded-2xl p-6 sm:p-7 border border-[#E5C98D]/35 hover:border-[#E5C98D]/70 bg-gradient-to-br from-[#121A3B]/80 via-[#0F1735]/70 to-[#0A0F24]/90 transition-all duration-300 cursor-pointer group shadow-[0_8px_32px_rgba(229,201,141,0.12)] hover:-translate-y-1 flex flex-col justify-between min-h-[190px]"
          >
            <div>
              {/* Friday Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-cormorant text-2xl sm:text-3xl text-[#F7F4EC] group-hover:text-[#E5C98D] transition-colors font-medium tracking-wide">
                    FRIDAY
                  </span>
                  <Sun className="w-4 h-4 text-[#E5C98D]" />
                </div>
                <span className="px-3 py-1 rounded-full bg-[#E5C98D]/15 border border-[#E5C98D]/35 text-[#E5C98D] text-[11px] font-sans-ui tracking-wider font-medium uppercase">
                  Peak Energy
                </span>
              </div>

              {/* Friday Title & Quote */}
              <h3 className="font-sans-ui text-sm text-[#BAC7E0] font-medium mb-1.5">
                {friday.highlightTitle}
              </h3>
              <p className="font-cormorant italic text-base sm:text-lg text-[#EDE8DD] leading-relaxed mb-4">
                {`"${friday.highlightQuote}"`}
              </p>
            </div>

            {/* Friday Tags */}
            <div className="flex items-center gap-4 text-xs text-[#9EACCA] font-sans-ui pt-2 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                High Mood
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                Connection
              </span>
            </div>
          </motion.div>

          {/* SATURDAY */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            onClick={() => setSelectedDay(satSun[0])}
            className="lg:col-span-3 cosmic-glass rounded-2xl p-5 sm:p-6 border border-indigo-500/20 hover:border-[#E5C98D]/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[190px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-cormorant text-xl text-[#F7F4EC] group-hover:text-[#E5C98D] transition-colors tracking-wide">
                {satSun[0].shortName}
              </span>
              <Battery className="w-4 h-4 text-[#8E9DB7] opacity-60" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-sans-ui tracking-wider uppercase text-[#BAC7E0]">
              {getDayIcon(satSun[0].type)}
              <span>{satSun[0].type}</span>
            </div>

            <p className="font-sans-ui text-xs text-[#9EACCA] leading-relaxed">
              {satSun[0].tagline}
            </p>
          </motion.div>

          {/* SUNDAY */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            onClick={() => setSelectedDay(satSun[1])}
            className="lg:col-span-3 cosmic-glass rounded-2xl p-5 sm:p-6 border border-indigo-500/20 hover:border-[#E5C98D]/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[190px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-cormorant text-xl text-[#F7F4EC] group-hover:text-[#E5C98D] transition-colors tracking-wide">
                {satSun[1].shortName}
              </span>
              <BatteryCharging className="w-4 h-4 text-[#8E9DB7] opacity-60" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-sans-ui tracking-wider uppercase text-[#BAC7E0]">
              {getDayIcon(satSun[1].type)}
              <span>{satSun[1].type}</span>
            </div>

            <p className="font-sans-ui text-xs text-[#9EACCA] leading-relaxed">
              {satSun[1].tagline}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Expanded Day Details Modal */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg cosmic-glass rounded-3xl p-6 sm:p-8 border border-[#E5C98D]/30 shadow-[0_0_50px_rgba(229,201,141,0.15)] bg-[#0C122B]/95"
            >
              <button
                onClick={() => setSelectedDay(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <span className="font-cormorant text-3xl text-[#F8F6F0] font-medium">
                  {selectedDay.day}
                </span>
                <span className="px-3 py-0.5 rounded-full bg-[#E5C98D]/15 border border-[#E5C98D]/30 text-[#E5C98D] text-xs uppercase tracking-wider">
                  {selectedDay.type}
                </span>
              </div>

              <p className="text-sm font-sans-ui text-[#BAC7E0] italic mb-6">
                "{selectedDay.tagline}"
              </p>

              <div className="space-y-4 text-sm font-sans-ui text-[#CBD5E1] bg-indigo-950/40 rounded-2xl p-5 border border-white/5 mb-6">
                <div>
                  <h4 className="text-xs tracking-wider uppercase text-[#E5C98D] mb-1 font-semibold">
                    Celestial Guidance
                  </h4>
                  <p className="leading-relaxed">{selectedDay.cosmicAdvice}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                  <div>
                    <span className="text-xs text-slate-400 block">Aligned Element</span>
                    <span className="font-medium text-white">{selectedDay.element}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Guardian Stone</span>
                    <span className="font-medium text-[#E5C98D]">{selectedDay.gemstone}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedDay(null)}
                  className="px-6 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-medium text-sm transition-colors"
                >
                  Understood ✨
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
