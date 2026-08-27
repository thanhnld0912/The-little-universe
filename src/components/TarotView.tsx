import React, { useRef, useState } from 'react';
import { TarotCardBackI, TarotCardBackII, TarotCardBackIII } from './CelestialArtwork';
import {
  drawTarotCard,
  interpretTarotDraw,
  type ShareTarget,
  type TarotDrawnCard,
  type TarotReading,
} from '../services/api';
import { Sparkles, RotateCcw, Compass, RefreshCw, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TarotViewProps {
  /**
   * Takes what should be shared. The draw id lives in this component's state,
   * so the view has to say what it is offering rather than the modal guessing.
   */
  onOpenShare: (target: ShareTarget | null) => void;
}

/** The three backs, in the order they are laid out. */
const CARD_BACKS = [TarotCardBackI, TarotCardBackII, TarotCardBackIII];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong reading the sky.';
}

/**
 * The tarot view.
 *
 * WHICH BACK YOU PICK DOES NOT DECIDE THE CARD, and it never could have: three
 * face-down backs carry no information. It used to map straight onto a
 * three-entry array, so the deck was effectively three cards and the left-hand
 * back was always the same one. The pick is the ritual; the draw is the server's,
 * made from the whole deck with a cryptographic random source and written down
 * before the response is built.
 *
 * Two requests, shown in two stages. The card comes back quickly and is revealed
 * at once; the reading is written by a model and takes seconds, so it arrives
 * into a placeholder rather than holding the whole reveal behind it.
 */
export const TarotView: React.FC<TarotViewProps> = ({ onOpenShare }) => {
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [drawId, setDrawId] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<TarotDrawnCard | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [reading, setReading] = useState<TarotReading | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);

  /**
   * Every draw is numbered. A response carrying a stale number belongs to a
   * reading that has since been dismissed, and writing it into state would drop
   * someone else's card on top of the one being read.
   */
  const drawToken = useRef(0);

  const runInterpret = async (id: string, token: number) => {
    setIsInterpreting(true);
    setReadingError(null);
    try {
      const result = await interpretTarotDraw(id);
      if (drawToken.current !== token) return;
      setReading(result.reading);
    } catch (caught) {
      if (drawToken.current !== token) return;
      setReadingError(messageOf(caught));
    } finally {
      if (drawToken.current === token) setIsInterpreting(false);
    }
  };

  const handleSelectCard = async (index: number) => {
    if (isDrawing || drawn) return;

    const token = drawToken.current + 1;
    drawToken.current = token;

    setSelectedCardIndex(index);
    setIsDrawing(true);
    setDrawError(null);
    setReading(null);
    setReadingError(null);

    try {
      const draw = await drawTarotCard();
      if (drawToken.current !== token) return;

      const card = draw.cards[0];
      if (!card) throw new Error('The deck returned no card.');

      setDrawId(draw.drawId);
      setDrawn(card);
      setIsDrawing(false);
      void runInterpret(draw.drawId, token);
    } catch (caught) {
      if (drawToken.current !== token) return;
      setDrawError(messageOf(caught));
      setSelectedCardIndex(null);
      setIsDrawing(false);
    }
  };

  const handleReset = () => {
    // Abandons anything still in flight before clearing, so a late reading
    // cannot reopen the modal after it has been dismissed.
    drawToken.current += 1;
    setSelectedCardIndex(null);
    setDrawId(null);
    setDrawn(null);
    setDrawError(null);
    setIsDrawing(false);
    setReading(null);
    setReadingError(null);
    setIsInterpreting(false);
  };

  const isReversed = drawn?.orientation === 'reversed';

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
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-center justify-items-center mb-8">
        {CARD_BACKS.map((Back, index) => {
          const isSelected = selectedCardIndex === index;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * (index + 1) }}
              onClick={() => void handleSelectCard(index)}
              aria-busy={isSelected && isDrawing}
              className={`relative w-[240px] sm:w-[260px] h-[360px] sm:h-[390px] rounded-2xl transition-all duration-300 transform ${
                isDrawing
                  ? 'cursor-wait'
                  : 'cursor-pointer hover:-translate-y-2 hover:scale-[1.02]'
              } ${
                isSelected
                  ? 'ring-2 ring-[#E5C98D] shadow-[0_0_40px_rgba(229,201,141,0.35)]'
                  : 'hover:shadow-[0_0_30px_rgba(129,140,248,0.25)]'
              }`}
            >
              <Back />
              {isSelected && isDrawing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#080C1E]/60 backdrop-blur-[2px]">
                  <span className="font-cinzel text-[11px] tracking-[0.3em] text-[#E5C98D] uppercase animate-pulse">
                    Drawing
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* A failed draw leaves nothing to reveal, so it is said here rather than
          in a modal that would have no card in it. */}
      {drawError && (
        <div className="mb-8 max-w-md text-center">
          <p className="font-sans-ui text-sm text-[#E7B4B4] mb-3">{drawError}</p>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[#BAC7E0] text-xs font-sans-ui transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Bottom Share Link */}
      <div className="flex flex-col items-center">
        <button
          id="tarot-share-btn"
          onClick={() => onOpenShare(drawId ? { kind: 'tarot', drawId } : null)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0F1633]/80 hover:bg-[#1A234E] text-[#E5C98D] border border-[#E5C98D]/30 hover:border-[#E5C98D]/60 font-sans-ui text-xs sm:text-sm font-medium transition-all duration-200"
        >
          <span>Send this to someone</span>
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Revealed Tarot Card Reading Modal */}
      <AnimatePresence>
        {drawn && (
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
                    {drawn.positionName}
                    {drawn.card.numeral ? ` • ${drawn.card.numeral}` : ''}
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
                  {drawn.card.archetype}
                </span>
                <h2 className="font-cormorant text-4xl sm:text-5xl text-[#F8F6F0] font-normal">
                  {drawn.card.name}
                </h2>

                {/* The orientation is shown because the meaning below is the one
                    for the orientation drawn. Leaving it out would present a
                    reversed reading under an apparently upright card. */}
                <span
                  className={`inline-flex items-center gap-1.5 mt-3 px-3 py-0.5 rounded-full text-[11px] font-sans-ui uppercase tracking-widest border ${
                    isReversed
                      ? 'bg-[#3A2246]/60 border-[#C89BE5]/35 text-[#D8B4FE]'
                      : 'bg-[#E5C98D]/10 border-[#E5C98D]/25 text-[#E5C98D]'
                  }`}
                >
                  <ArrowUpRight
                    className={`w-3 h-3 ${isReversed ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  {isReversed ? 'Reversed' : 'Upright'}
                </span>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  {drawn.card.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-3 py-0.5 rounded-full bg-[#E5C98D]/10 border border-[#E5C98D]/25 text-[#E5C98D] text-[11px] font-sans-ui"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Wisdom Content */}
              <div className="space-y-4 mb-8">
                {/* The traditional meaning for the orientation drawn. It comes
                    from the deck, not the model, so it is shown immediately. */}
                <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                  <h4 className="text-xs font-sans-ui uppercase tracking-wider text-[#E5C98D] mb-1.5 font-medium">
                    Cosmic Meaning
                  </h4>
                  <p className="font-cormorant text-lg sm:text-xl text-[#EDE8DD] leading-relaxed">
                    {drawn.meaning}
                  </p>
                </div>

                {isInterpreting && (
                  <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                    <h4 className="text-xs font-sans-ui uppercase tracking-wider text-indigo-300 mb-3 font-medium">
                      Reading your card
                    </h4>
                    <div className="space-y-2.5 animate-pulse" aria-hidden="true">
                      <div className="h-3 rounded-full bg-white/10 w-full" />
                      <div className="h-3 rounded-full bg-white/10 w-11/12" />
                      <div className="h-3 rounded-full bg-white/10 w-8/12" />
                    </div>
                  </div>
                )}

                {readingError && (
                  <div className="bg-[#2A1830]/60 rounded-2xl p-5 border border-[#E7B4B4]/25 text-center">
                    <p className="font-sans-ui text-sm text-[#E7B4B4] mb-3">{readingError}</p>
                    <button
                      onClick={() => {
                        if (drawId) void runInterpret(drawId, drawToken.current);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[#BAC7E0] text-xs font-sans-ui transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {/* Safe to press repeatedly: the server returns the
                          reading it already wrote rather than a new one. */}
                      <span>Ask again</span>
                    </button>
                  </div>
                )}

                {reading && (
                  <>
                    <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                      <h4 className="text-xs font-sans-ui uppercase tracking-wider text-indigo-300 mb-1.5 font-medium">
                        {reading.title}
                      </h4>
                      <p className="font-cormorant text-lg sm:text-xl text-[#EDE8DD] leading-relaxed mb-3">
                        {reading.summary}
                      </p>
                      <p className="text-sm font-sans-ui text-[#BAC7E0] leading-relaxed">
                        {reading.interpretation}
                      </p>
                    </div>

                    <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5">
                      <h4 className="text-xs font-sans-ui uppercase tracking-wider text-indigo-300 mb-1.5 font-medium">
                        Guidance for Today
                      </h4>
                      <p className="text-sm font-sans-ui text-[#BAC7E0] leading-relaxed">
                        {reading.guidance}
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-[#17204A]/60 to-[#101736]/60 rounded-2xl p-5 border border-[#E5C98D]/20 text-center">
                      <span className="text-[11px] font-sans-ui uppercase tracking-widest text-[#E5C98D]/80 block mb-1">
                        A Question to Sit With
                      </span>
                      <p className="font-cormorant italic text-lg sm:text-xl text-[#F7F4EC]">
                        {reading.reflectionQuestion}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {/* Not every card has an element, and an empty "Aligned with"
                    reads as missing data rather than as a card without one. */}
                {drawn.card.element ? (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#E5C98D]" />
                    Aligned with {drawn.card.element}
                  </span>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => onOpenShare(drawId ? { kind: 'tarot', drawId } : null)}
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
