import React from 'react';
import { NebulaBanner } from './CelestialArtwork';
import { fetchDailyPrediction, type DailyPrediction } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { Sparkles, RefreshCw, Compass } from 'lucide-react';
import { motion } from 'motion/react';

/**
 * Shared frame for the two states that have no reading to show.
 *
 * Keeping the same vertical space and centring as the loaded view means the
 * page does not jump when the reading arrives.
 */
const TodayStatus: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
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

/**
 * Maps the server's reading onto the fields this view renders.
 *
 * Optional fields come back as `null` rather than as invented text, so an empty
 * string here means the server genuinely had nothing for that slot and the line
 * renders blank instead of showing someone else's content.
 */
function toViewModel(prediction: DailyPrediction) {
  return {
    energyTitle: prediction.energy,
    energyPercentage: `${prediction.energyScore}%`,
    theme: prediction.theme,
    mood: prediction.mood,
    luckyColor: prediction.luckyColor,
    luckyColorHex: prediction.luckyColorHex ?? 'transparent',
    luckyNumber: String(prediction.luckyNumber).padStart(2, '0'),
    dailyWhisper: prediction.prediction,
    cosmicQuote: prediction.cosmicQuote ?? '',
    cosmicSign: prediction.cosmicSign ?? '',
    element: prediction.element ?? '',
    soundFrequency: prediction.soundFrequency ?? '',
  };
}

interface TodayViewProps {
  onRevealMessage: () => void;
  onOpenShare: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onRevealMessage,
  onOpenShare,
}) => {
  const { data: prediction, error, isLoading, isReloading, reload } = useAsyncData(
    fetchDailyPrediction,
  );

  if (isLoading) {
    return <TodayStatus message="Reading the sky…" />;
  }

  if (error !== undefined || prediction === undefined) {
    return <TodayStatus message={error ?? 'Today could not be read.'} onRetry={reload} />;
  }

  const data = toViewModel(prediction);

  // The refresh control re-fetches; it never asks for a new reading. Your day is
  // generated once and then kept, so this returns what you were already given.
  const handleShuffleEnergy = reload;
  const isRegenerating = isReloading;

  return (
    <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10 sm:py-14 z-10">
      {/* Top Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-2xl mx-auto mb-10 sm:mb-12"
      >
        <span className="font-sans-ui text-[11px] tracking-[0.25em] text-[#93A1BC] uppercase mb-2 block">
          TODAY
        </span>
        <h1 className="font-cormorant text-3xl sm:text-4xl md:text-5xl text-[#F8F6F0] font-normal leading-tight mb-3">
          What does today have waiting for you?
        </h1>
        <p className="font-cormorant italic text-base sm:text-lg text-[#BAC7E0] tracking-wide">
          {data.cosmicQuote}
        </p>
      </motion.div>

      {/* Main Grid Section */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch mb-12">
        {/* Left Card: Today's Energy */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="md:col-span-5 cosmic-glass rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative group"
        >
          <div>
            {/* Header row */}
            <div className="flex items-center justify-between text-xs text-[#8E9DB7] font-sans-ui mb-3">
              <span>Today's Energy</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8E9DB7] font-sans-ui">{data.energyPercentage}</span>
                <button
                  onClick={handleShuffleEnergy}
                  title="Tune today's energy"
                  className="opacity-40 hover:opacity-100 transition-opacity p-1 text-[#E5C98D]"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Energy Title */}
            <h2 className="font-cormorant text-3xl sm:text-4xl text-[#F7F4EC] font-normal leading-tight mb-8">
              {data.energyTitle}
            </h2>

            {/* Metrics List */}
            <div className="space-y-4 text-sm font-sans-ui">
              {/* Theme */}
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[#8E9DB7]">Theme</span>
                <span className="text-[#E2E8F0] font-medium">{data.theme}</span>
              </div>

              {/* Mood */}
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[#8E9DB7]">Mood</span>
                <span className="text-[#E2E8F0] font-medium">{data.mood}</span>
              </div>

              {/* Lucky Color */}
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[#8E9DB7]">Lucky Color</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: data.luckyColorHex }}
                  />
                  <span className="text-[#E2E8F0] font-medium">{data.luckyColor}</span>
                </div>
              </div>

              {/* Lucky Number */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[#8E9DB7]">Lucky Number</span>
                <span className="font-cormorant text-2xl text-[#E5C98D] font-semibold tracking-wider">
                  {data.luckyNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Subtle celestial hint footer */}
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-[#718096]">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-[#E5C98D]" />
              {data.cosmicSign}
            </span>
            <span>{data.soundFrequency}</span>
          </div>
        </motion.div>

        {/* Right Column: Message Whisper Card + Nebula Graphic */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="md:col-span-7 flex flex-col gap-6 justify-between"
        >
          {/* Top Whisper Card */}
          <div className="cosmic-glass rounded-2xl p-6 sm:p-7 border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between h-full">
            <div className="flex items-start gap-4 mb-6">
              {/* Star Icon Motif */}
              <div className="p-2 rounded-xl bg-indigo-900/30 border border-indigo-400/20 text-[#E5C98D] shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="font-cormorant text-lg sm:text-xl text-[#EDE8DD] leading-relaxed font-normal">
                {data.dailyWhisper}
              </p>
            </div>

            {/* Reveal Button */}
            <div className="flex justify-center sm:justify-start">
              <button
                id="today-reveal-message-btn"
                onClick={onRevealMessage}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-sans-ui font-medium text-xs sm:text-sm transition-all duration-200 shadow-[0_4px_15px_rgba(229,201,141,0.2)]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0A0E22]" />
                <span>Reveal my message</span>
              </button>
            </div>
          </div>

          {/* Bottom Cosmic Nebula Artwork Banner */}
          <NebulaBanner />
        </motion.div>
      </div>

      {/* Bottom Share Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center flex flex-col items-center"
      >
        <span className="font-sans-ui text-[10px] tracking-[0.25em] text-[#8695B0] uppercase mb-2.5">
          SHARE YOUR READING
        </span>
        <button
          id="today-send-to-someone-btn"
          onClick={onOpenShare}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0F1633]/80 hover:bg-[#1A234E] text-[#E5C98D] border border-[#E5C98D]/30 hover:border-[#E5C98D]/60 font-sans-ui text-xs sm:text-sm font-medium transition-all duration-200"
        >
          <span>Send this to someone</span>
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </div>
  );
};
