import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Share2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const shareUrl = window.location.href;
  const quoteText = `"Today may be quieter than you expect, but pay attention to the small moments. The universe is speaking in whispers." — The Little Universe`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(quoteText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'The Little Universe',
          text: 'A little magic for your day. Discover your celestial energy and oracle wisdom.',
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md cosmic-glass rounded-3xl p-6 sm:p-8 border border-[#E5C98D]/30 shadow-[0_0_50px_rgba(229,201,141,0.15)] bg-[#0B1028]/95"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#1A234E] border border-[#E5C98D]/30 mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-[#E5C98D]" />
          </div>
          <h3 className="font-cormorant text-2xl sm:text-3xl text-[#F8F6F0] font-normal mb-1">
            Share the Magic
          </h3>
          <p className="font-sans-ui text-xs text-[#9EACCA]">
            Send a little starlight and reassurance to someone you care about.
          </p>
        </div>

        {/* Celestial Preview Card */}
        <div className="bg-gradient-to-br from-[#121A3F] to-[#0A0F26] rounded-2xl p-5 border border-[#E5C98D]/25 mb-6 text-left shadow-inner">
          <div className="flex items-center justify-between text-[10px] text-[#E5C98D] font-cinzel tracking-wider uppercase mb-2">
            <span>The Little Universe</span>
            <span>Daily Starlight</span>
          </div>
          <p className="font-cormorant italic text-base text-[#EDE8DD] leading-relaxed mb-3">
            "Today may be quieter than you expect, but pay attention to the small moments. The universe is speaking in whispers."
          </p>
          <div className="flex items-center justify-between text-[11px] text-[#8E9DB7] font-sans-ui pt-2 border-t border-white/5">
            <span>Energy: Quietly Curious (87%)</span>
            <span>✨ Hopeful</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans-ui text-[#CBD5E1] hover:text-white transition-all"
          >
            <span className="truncate pr-2">{shareUrl}</span>
            <span className="shrink-0 flex items-center gap-1 text-[#E5C98D] font-medium">
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyQuote}
              className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-[#CBD5E1] text-xs font-sans-ui border border-white/10 transition-colors"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Quote</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] text-xs font-sans-ui font-medium transition-colors shadow-md"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share App</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
