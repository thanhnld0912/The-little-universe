import React, { useState } from 'react';
import { fetchWeeklyPrediction, type WeeklyDay } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { DayForecast } from '../types';
import { Sparkles, Battery, BatteryMedium, BatteryCharging, Sun, Heart, Users, Cloud, Wind, RotateCcw, Zap, Coffee, BookOpen, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ThisWeekViewProps {
  onOpenShare: () => void;
}

/** Maps a day from the server onto the shape this view and its modal render. */
function toDayForecast(day: WeeklyDay): DayForecast {
  return {
    id: day.id,
    day: day.day,
    shortName: day.shortName,
    type: day.type,
    tagline: day.tagline,
    isPeak: day.isPeak,
    batteryLevel: day.score,
    highlightTitle: day.highlightTitle,
    highlightQuote: day.highlightQuote,
    element: day.element ?? undefined,
    gemstone: day.gemstone ?? undefined,
    cosmicAdvice: day.prediction,
  };
}

/** Same framing as the loaded view, so the page does not jump on arrival. */
const WeekStatus: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-4 z-10 text-center">
    <p className="font-cormorant italic text-lg text-[#BAC7E0] tracking-wide">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-5 flex items-center gap-2 px-5 py-2 rounded-full bg-[#0F1633]/80 hover:bg-[#1A234E] text-[#E5C98D] border border-[#E5C98D]/30 hover:border-[#E5C98D]/60 font-sans-ui text-xs transition-all duration-200"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Try again</span>
      </button>
    )}
  </div>
);

export const ThisWeekView: React.FC<ThisWeekViewProps> = () => {
  const [selectedDay, setSelectedDay] = useState<DayForecast | null>(null);
  const { data: week, error, isLoading, reload } = useAsyncData(fetchWeeklyPrediction);

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

  if (isLoading) {
    return <WeekStatus message="Reading the week ahead…" />;
  }

  if (error !== undefined || week === undefined) {
    return <WeekStatus message={error ?? 'This week could not be read.'} onRetry={reload} />;
  }

  const days = week.days.map(toDayForecast);

  // The brightest day is found, not assumed. It used to be hard-coded as
  // `days[4]`, which only worked because the generator happens to place the peak
  // on Friday today; the API guarantees exactly one `isPeak` day but not which.
  const peakIndex = days.findIndex((day) => day.isPeak);
  const peak = peakIndex === -1 ? days[days.length - 1] : days[peakIndex];
  const before = peakIndex === -1 ? days.slice(0, -1) : days.slice(0, peakIndex);
  const after = peakIndex === -1 ? [] : days.slice(peakIndex + 1);

  const firstFour = before;
  const friday = peak;
  const satSun = after;

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
                    {friday.day.toUpperCase()}
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

          {/* The days after the peak. Mapped rather than written out twice, so
              every remaining day renders wherever the peak happens to fall. */}
          {satSun.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + idx * 0.1 }}
              onClick={() => setSelectedDay(item)}
              className="lg:col-span-3 cosmic-glass rounded-2xl p-5 sm:p-6 border border-indigo-500/20 hover:border-[#E5C98D]/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[190px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-cormorant text-xl text-[#F7F4EC] group-hover:text-[#E5C98D] transition-colors tracking-wide">
                  {item.shortName}
                </span>
                {idx === 0 ? (
                  <Battery className="w-4 h-4 text-[#8E9DB7] opacity-60" />
                ) : (
                  <BatteryCharging className="w-4 h-4 text-[#8E9DB7] opacity-60" />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-sans-ui tracking-wider uppercase text-[#BAC7E0]">
                {getDayIcon(item.type)}
                <span>{item.type}</span>
              </div>

              <p className="font-sans-ui text-xs text-[#9EACCA] leading-relaxed">{item.tagline}</p>
            </motion.div>
          ))}
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
