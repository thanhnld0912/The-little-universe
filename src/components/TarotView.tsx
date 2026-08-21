import React, { useState } from 'react';
import { TarotCardBackI, TarotCardBackII, TarotCardBackIII } from './CelestialArtwork';
import { TAROT_DECK } from '../data/cosmicData';
import { TarotCard } from '../types';
import { Sparkles, RotateCcw, Compass, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TarotViewProps {
  onOpenShare: () => void;
}

export const TarotView: React.FC<TarotViewProps> = ({ onOpenShare }) => {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [revealedCard, setRevealedCard] = useState<TarotCard | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleSelectCard = (index: number) => {
    if (isFlipping) return;
    setIsFlipping(true);
    setSelectedCardIndex(index);
    setRevealedCard(TAROT_DECK[index]);
    setTimeout(() => {
      setIsFlipping(false);
    }, 400);
  };

  const handleReset = () => {
    setSelectedCardIndex(null);
    setRevealedCard(null);
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10 sm:py-14 z-10">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-2xl mx-auto mb-10 sm:mb-12"
      >
        <span className="font-sans-ui text-[11px] tracking-[0.25em] text-[#93A1BC] uppercase mb-2 block">
          TAROT
        </span>
        <h1 className="font-cormorant text-4xl sm:text-5xl md:text-6xl font-normal leading-tight mb-3 bg-gradient-to-r from-[#EDE8DD] via-[#D8B4FE] to-[#EDE8DD] bg-clip-text text-transparent">
          Choose a card.
        </h1>
        <p className="font-sans-ui text-sm sm:text-base text-[#9EACCA] font-light">
          Don’t think too much. Pick the one that quietly calls your name.
        </p>
      </motion.div>

      {/* 3 Tarot Cards Deck Row */}
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-center justify-items-center mb-12">
        {/* CARD I */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onClick={() => handleSelectCard(0)}
          className={`w-[240px] sm:w-[260px] h-[360px] sm:h-[390px] cursor-pointer rounded-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] ${
            selectedCardIndex === 0
              ? 'ring-2 ring-[#E5C98D] shadow-[0_0_40px_rgba(229,201,141,0.35)]'
              : 'hover:shadow-[0_0_30px_rgba(129,140,248,0.25)]'
          }`}
        >
          <TarotCardBackI />
        </motion.div>

        {/* CARD II */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onClick={() => handleSelectCard(1)}
          className={`w-[240px] sm:w-[260px] h-[360px] sm:h-[390px] cursor-pointer rounded-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] ${
            selectedCardIndex === 1
              ? 'ring-2 ring-[#E5C98D] shadow-[0_0_40px_rgba(229,201,141,0.35)]'
              : 'hover:shadow-[0_0_30px_rgba(129,140,248,0.25)]'
          }`}
        >
          <TarotCardBackII />
        </motion.div>

        {/* CARD III */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          onClick={() => handleSelectCard(2)}
          className={`w-[240px] sm:w-[260px] h-[360px] sm:h-[390px] cursor-pointer rounded-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] ${
            selectedCardIndex === 2
              ? 'ring-2 ring-[#E5C98D] shadow-[0_0_40px_rgba(229,201,141,0.35)]'
              : 'hover:shadow-[0_0_30px_rgba(129,140,248,0.25)]'
          }`}
        >
          <TarotCardBackIII />
        </motion.div>
      </div>

      {/* Bottom Share Link */}
      <div className="flex flex-col items-center">
        <button
          id="tarot-share-btn"
          onClick={onOpenShare}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0F1633]/80 hover:bg-[#1A234E] text-[#E5C98D] border border-[#E5C98D]/30 hover:border-[#E5C98D]/60 font-sans-ui text-xs sm:text-sm font-medium transition-all duration-200"
        >
          <span>Send this to someone</span>
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Revealed Tarot Card Reading Modal */}
      <AnimatePresence>
        {revealedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl cosmic-glass rounded-3xl p-6 sm:p-9 border border-[#E5C98D]/40 shadow-[0_0_60px_rgba(229,201,141,0.2)] bg-[#0C122C]/95 max-h-[90vh] overflow-y-auto"
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-cinzel text-xs tracking-widest text-[#E5C98D] uppercase">
                    {revealedCard.cardIndex} • {revealedCard.numeral}
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Choose Again</span>
                </button>
              </div>

              {/* Card Title & Archetype */}
              <div className="text-center mb-6">
                <span className="text-xs font-sans-ui tracking-widest text-indigo-300 uppercase block mb-1">
                  {revealedCard.archetype}
                </span>
                <h2 className="font-cormorant text-4xl sm:text-5xl text-[#F8F6F0] font-normal">
                  {revealedCard.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  {revealedCard.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-3 py-0.5 rounded-full bg-[#E5C98D]/10 border border-[#E5C98D]/25 text-[#E5C98D] text-[11px] font-sans-ui"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Wisdom Content */}
              <div className="space-y-4 mb-8">
                {/* Meaning */}
                <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                  <h4 className="text-xs font-sans-ui uppercase tracking-wider text-[#E5C98D] mb-1.5 font-medium">
                    Cosmic Meaning
                  </h4>
                  <p className="font-cormorant text-lg sm:text-xl text-[#EDE8DD] leading-relaxed">
                    {revealedCard.meaning}
                  </p>
                </div>

                {/* Daily Guidance */}
                <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                  <h4 className="text-xs font-sans-ui uppercase tracking-wider text-indigo-300 mb-1.5 font-medium">
                    Guidance for Today
                  </h4>
                  <p className="text-sm font-sans-ui text-[#BAC7E0] leading-relaxed">
                    {revealedCard.guidance}
                  </p>
                </div>

                {/* Affirmation */}
                <div className="bg-gradient-to-r from-[#17204A]/60 to-[#101736]/60 rounded-2xl p-5 border border-[#E5C98D]/20 text-center">
                  <span className="text-[11px] font-sans-ui uppercase tracking-widest text-[#E5C98D]/80 block mb-1">
                    Your Sacred Affirmation
                  </span>
                  <p className="font-cormorant italic text-lg sm:text-xl text-[#F7F4EC]">
                    "{revealedCard.affirmation}"
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#E5C98D]" />
                  Aligned with {revealedCard.element}
                </span>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={onOpenShare}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
                  >
                    <span>Share Reading</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#E5C98D]" />
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-medium text-xs sm:text-sm transition-colors"
                  >
                    Accept Reading
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
