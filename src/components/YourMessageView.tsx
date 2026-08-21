import React, { useState } from 'react';
import { MoodType, UniverseMessageResult } from '../types';
import { MOOD_CONFIG, PRESET_UNIVERSE_MESSAGES } from '../data/cosmicData';
import { Sparkles, Mail, Send, RotateCcw, Copy, Check, Compass, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface YourMessageViewProps {
  onOpenShare: () => void;
}

type MessageStage = 'input' | 'envelope' | 'revealed';

export const YourMessageView: React.FC<YourMessageViewProps> = ({ onOpenShare }) => {
  const [stage, setStage] = useState<MessageStage>('input');
  const [prompt, setPrompt] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType>('quiet');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageResult, setMessageResult] = useState<UniverseMessageResult | null>(null);
  const [copied, setCopied] = useState(false);

  const charLimit = 200;

  const handleCreateMessage = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Create personalized message based on mood & prompt
      const basePreset = PRESET_UNIVERSE_MESSAGES[selectedMood];
      const customResult: UniverseMessageResult = {
        ...basePreset,
        userPrompt: prompt.trim() || undefined,
      };
      setMessageResult(customResult);
      setIsGenerating(false);
      setStage('envelope'); // Transition to Image 13 envelope screen
    }, 600);
  };

  const handleOpenEnvelope = () => {
    setStage('revealed');
  };

  const handleReset = () => {
    setStage('input');
    setPrompt('');
    setSelectedMood('quiet');
    setMessageResult(null);
  };

  const handleCopyMessage = () => {
    if (!messageResult) return;
    const text = `🌌 The Little Universe — A Message For You\n${messageResult.title}\n\n"${messageResult.whisper}"\n\nAffirmation: "${messageResult.affirmation}"\nGuidance: ${messageResult.actionGuidance}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10 sm:py-14 z-10">
      <AnimatePresence mode="wait">
        {/* STAGE 1: INPUT FORM (Image 11) */}
        {stage === 'input' && (
          <motion.div
            key="input-stage"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-2xl mx-auto flex flex-col items-center"
          >
            {/* Header */}
            <div className="text-center mb-8 sm:mb-10">
              <span className="font-sans-ui text-[11px] tracking-[0.25em] text-[#93A1BC] uppercase mb-2 block">
                A MESSAGE FOR YOU
              </span>
              <h1 className="font-cormorant text-3xl sm:text-4xl md:text-5xl text-[#F8F6F0] font-normal leading-tight mb-3">
                The universe wrote something just for you.
              </h1>
              <p className="font-sans-ui text-sm sm:text-base text-[#9EACCA] font-light max-w-lg mx-auto">
                Cast your thoughts into the cosmos and receive a message uniquely aligned with your current energy.
              </p>
            </div>

            {/* Input Card Container */}
            <div className="w-full cosmic-glass rounded-3xl p-6 sm:p-8 border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              {/* Textarea */}
              <div className="relative mb-6">
                <textarea
                  id="user-thoughts-input"
                  value={prompt}
                  onChange={(e) => {
                    if (e.target.value.length <= charLimit) {
                      setPrompt(e.target.value);
                    }
                  }}
                  placeholder="Tell me what's on your mind..."
                  rows={4}
                  className="w-full bg-[#0A0E24]/80 text-[#EDE8DD] placeholder-[#64748B] rounded-2xl p-4 border border-white/10 focus:border-[#E5C98D]/60 focus:outline-none focus:ring-1 focus:ring-[#E5C98D]/40 font-sans-ui text-sm sm:text-base resize-none transition-all"
                />
                <span className="absolute bottom-3 right-4 text-xs font-sans-ui text-[#64748B]">
                  {prompt.length}/{charLimit}
                </span>
              </div>

              {/* Set The Mood Section */}
              <div className="mb-8">
                <span className="font-sans-ui text-[11px] tracking-[0.2em] text-[#8E9DB7] uppercase block mb-3.5 font-medium">
                  SET THE MOOD
                </span>

                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {(Object.keys(MOOD_CONFIG) as MoodType[]).map((moodKey) => {
                    const mood = MOOD_CONFIG[moodKey];
                    const isSelected = selectedMood === moodKey;
                    return (
                      <button
                        key={moodKey}
                        type="button"
                        onClick={() => setSelectedMood(moodKey)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-sans-ui transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#E5C98D] text-[#0A0E22] font-semibold shadow-[0_0_15px_rgba(229,201,141,0.3)]'
                            : 'bg-[#101738]/80 text-[#BAC7E0] hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span>{mood.icon}</span>
                        <span>{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit CTA */}
              <button
                id="create-my-message-btn"
                onClick={handleCreateMessage}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-sans-ui font-medium text-sm sm:text-base transition-all duration-200 shadow-[0_4px_20px_rgba(229,201,141,0.25)] cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 text-[#0A0E22] animate-spin" />
                    <span>Listening to the stars...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#0A0E22]" />
                    <span>Create my message</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STAGE 2: ENVELOPE WAITING (Image 13) */}
        {stage === 'envelope' && (
          <motion.div
            key="envelope-stage"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-lg mx-auto flex flex-col items-center text-center py-6"
          >
            <h1 className="font-cormorant text-3xl sm:text-4xl md:text-5xl text-[#F8F6F0] font-normal leading-tight mb-10">
              There is something waiting for you.
            </h1>

            {/* Glowing Envelope Container matching Image 13 */}
            <div className="relative w-full aspect-[4/3] max-w-[420px] cosmic-glass rounded-3xl border border-indigo-400/25 p-8 flex flex-col items-center justify-center mb-8 shadow-[0_0_60px_rgba(79,70,229,0.15)] group">
              {/* Outer atmospheric aura */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

              {/* Glowing Envelope Icon */}
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mb-6"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#141C40] border border-[#E5C98D]/40 flex items-center justify-center shadow-[0_0_35px_rgba(229,201,141,0.25)]">
                  <Mail className="w-10 h-10 sm:w-12 sm:h-12 text-[#E5C98D]" strokeWidth={1.5} />
                </div>

                {/* Star twinkle near envelope */}
                <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-[#FFF4D0] animate-pulse" />
              </motion.div>

              {/* Open the envelope Button */}
              <button
                id="open-envelope-btn"
                onClick={handleOpenEnvelope}
                className="relative z-10 flex items-center gap-2 px-8 py-3 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-sans-ui font-medium text-sm transition-all duration-200 transform hover:-translate-y-0.5 shadow-[0_4px_25px_rgba(229,201,141,0.3)]"
              >
                <span>Open the envelope</span>
              </button>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#8E9DB7] hover:text-white transition-colors"
            >
              ← Edit your thoughts
            </button>
          </motion.div>
        )}

        {/* STAGE 3: REVEALED CELESTIAL LETTER */}
        {stage === 'revealed' && messageResult && (
          <motion.div
            key="revealed-stage"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.6, type: 'spring', damping: 25 }}
            className="w-full max-w-2xl mx-auto flex flex-col items-center"
          >
            {/* Sealed Universe Letter parchment */}
            <div className="w-full cosmic-glass rounded-3xl p-6 sm:p-10 border border-[#E5C98D]/40 shadow-[0_0_60px_rgba(229,201,141,0.15)] bg-gradient-to-b from-[#0F1638]/95 via-[#0A0F28]/95 to-[#070A1C]/95 mb-8 relative">
              {/* Decorative Header */}
              <div className="flex items-center justify-between border-b border-[#E5C98D]/20 pb-4 mb-6 text-xs text-[#BAC7E0] font-sans-ui">
                <span className="flex items-center gap-1.5 text-[#E5C98D]">
                  <Sparkles className="w-3.5 h-3.5" />
                  {messageResult.celestialSign}
                </span>
                <span>{messageResult.dateStr}</span>
              </div>

              {/* Letter Title */}
              <div className="text-center mb-6">
                <span className="text-[11px] font-sans-ui uppercase tracking-[0.25em] text-[#93A1BC] block mb-1">
                  A Celestial Dispatch
                </span>
                <h2 className="font-cormorant text-3xl sm:text-4xl text-[#F8F6F0] font-normal mb-2">
                  {messageResult.title}
                </h2>
                <p className="font-cormorant italic text-sm sm:text-base text-[#BAC7E0]">
                  {messageResult.subtitle}
                </p>
              </div>

              {/* User Prompt reflection (if typed) */}
              {messageResult.userPrompt && (
                <div className="bg-[#121A40]/60 rounded-xl p-3.5 border border-white/5 text-xs text-[#9EACCA] italic mb-6">
                  <span className="not-italic text-[#E5C98D] block text-[10px] uppercase font-sans-ui font-semibold mb-0.5">
                    Your Inscribed Thought:
                  </span>
                  "{messageResult.userPrompt}"
                </div>
              )}

              {/* The Core Whisper */}
              <div className="my-6 py-2">
                <p className="font-cormorant text-xl sm:text-2xl text-[#EDE8DD] leading-relaxed font-normal text-left">
                  {messageResult.whisper}
                </p>
              </div>

              {/* Affirmation Box */}
              <div className="bg-gradient-to-r from-[#1A2352]/70 via-[#141C42]/70 to-[#0F1635]/70 rounded-2xl p-5 border border-[#E5C98D]/30 text-center mb-6">
                <span className="text-[10px] font-sans-ui uppercase tracking-widest text-[#E5C98D] block mb-1 font-semibold">
                  Today's Living Affirmation
                </span>
                <p className="font-cormorant italic text-lg sm:text-xl text-[#F8F6F0]">
                  "{messageResult.affirmation}"
                </p>
              </div>

              {/* Gentle Action & Lucky Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans-ui text-[#BAC7E0] bg-[#0C122C]/70 rounded-2xl p-4 border border-white/5 mb-6">
                <div>
                  <span className="text-[#E5C98D] block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Gentle Ritual
                  </span>
                  <p className="leading-relaxed">{messageResult.actionGuidance}</p>
                </div>
                <div>
                  <span className="text-[#E5C98D] block font-semibold mb-1 uppercase tracking-wider text-[10px]">
                    Cosmic Frequency
                  </span>
                  <p>{messageResult.cosmicEnergy}</p>
                  <p className="mt-1 text-slate-400">Lucky Portal Number: <strong className="text-white">{messageResult.luckyNumber}</strong></p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                <button
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1.5 text-xs text-[#CBD5E1] hover:text-white px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#E5C98D]" />
                      <span>Copy Letter</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={onOpenShare}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#E5C98D]" />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] text-xs font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ask Another</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
