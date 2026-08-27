import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Share2, Send, Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { createShare, shareUrlFor, type ShareTarget } from '../services/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * What the view underneath is offering to share, or `null` when there is
   * nothing yet — the home screen, or a tarot card not drawn. A secret message
   * can always be written, so the modal is never empty.
   */
  target: ShareTarget | null;
}

const TARGET_LABEL: Record<string, string> = {
  daily: 'your reading for today',
  weekly: 'your week ahead',
  tarot: 'the card you drew',
  message: 'the message written for you',
};

const NOTE_LIMIT = 500;

const ShareModalContent: React.FC<{ onClose: () => void; target: ShareTarget | null }> = ({
  onClose,
  target,
}) => {
  const [writingSecret, setWritingSecret] = useState(false);
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async (what: ShareTarget) => {
    setIsCreating(true);
    setError(null);
    try {
      const created = await createShare(what);
      setLink(shareUrlFor(created.slug));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That link could not be created.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = () => {
    if (!link) return;
    if (navigator.share) {
      navigator
        .share({ title: 'The Little Universe', url: link })
        // A cancelled share is not a failure and must not surface as an error.
        .catch(() => {});
    } else {
      handleCopy();
    }
  };

  const trimmedNote = note.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md cosmic-glass rounded-3xl p-6 sm:p-8 border border-[#E5C98D]/30 shadow-[0_0_50px_rgba(229,201,141,0.15)] bg-[#0B1028]/95"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#1A234E] border border-[#E5C98D]/30 mx-auto flex items-center justify-center mb-3">
            {writingSecret ? (
              <Lock className="w-5 h-5 text-[#E5C98D]" />
            ) : (
              <Sparkles className="w-6 h-6 text-[#E5C98D]" />
            )}
          </div>
          <h3 className="font-cormorant text-2xl sm:text-3xl text-[#F8F6F0] font-normal mb-1">
            {link ? 'Your link is ready' : writingSecret ? 'Write something' : 'Share the Magic'}
          </h3>
          <p className="font-sans-ui text-xs text-[#9EACCA]">
            {link
              ? 'Anyone with this link can read it. Only people you send it to will have it.'
              : writingSecret
                ? 'They will see your words, and nothing about you.'
                : 'Send a little starlight to someone you care about.'}
          </p>
        </div>

        {/* --- the finished link ------------------------------------------- */}
        {link && (
          <div className="space-y-3">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans-ui text-[#CBD5E1] hover:text-white transition-all"
            >
              <span className="truncate pr-2">{link}</span>
              <span className="shrink-0 flex items-center gap-1 text-[#E5C98D] font-medium">
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </span>
            </button>

            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] text-xs font-sans-ui font-medium transition-colors shadow-md"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Send it</span>
            </button>
          </div>
        )}

        {/* --- writing a secret message ------------------------------------ */}
        {!link && writingSecret && (
          <div className="space-y-3">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
              rows={5}
              autoFocus
              placeholder="Something you would want to hear."
              className="w-full rounded-2xl bg-[#111736]/70 border border-white/10 focus:border-[#E5C98D]/40 outline-none p-4 font-cormorant text-lg text-[#EDE8DD] placeholder:text-[#5C6B8A] resize-none transition-colors"
            />
            <div className="flex items-center justify-between text-[11px] font-sans-ui text-[#8E9DB7]">
              <button
                onClick={() => setWritingSecret(false)}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              {/* Counts down only near the limit, so it is information rather
                  than a scold on every keystroke. */}
              <span>{note.length > NOTE_LIMIT - 100 ? `${NOTE_LIMIT - note.length} left` : ''}</span>
            </div>

            <button
              onClick={() => void create({ kind: 'secret', note: trimmedNote })}
              disabled={trimmedNote === '' || isCreating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0E22] text-xs font-sans-ui font-medium transition-colors shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Sealing…' : 'Make a link'}</span>
            </button>
          </div>
        )}

        {/* --- choosing what to share --------------------------------------- */}
        {!link && !writingSecret && (
          <div className="space-y-3">
            {target ? (
              <button
                onClick={() => void create(target)}
                disabled={isCreating}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-left transition-all"
              >
                <span>
                  <span className="block font-sans-ui text-sm text-[#EDE8DD]">Share {TARGET_LABEL[target.kind]}</span>
                  <span className="block font-sans-ui text-[11px] text-[#8E9DB7] mt-0.5">
                    They see what you saw, exactly as it was.
                  </span>
                </span>
                <Sparkles className="w-4 h-4 shrink-0 text-[#E5C98D]" />
              </button>
            ) : (
              <p className="text-center font-sans-ui text-xs text-[#8E9DB7] px-2 py-1">
                {/* Said plainly rather than showing a disabled button with no
                    explanation of what would enable it. */}
                There is no reading open to share right now — but you can still
                write something of your own.
              </p>
            )}

            <button
              onClick={() => setWritingSecret(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all"
            >
              <span>
                <span className="block font-sans-ui text-sm text-[#EDE8DD]">
                  Write a secret message
                </span>
                <span className="block font-sans-ui text-[11px] text-[#8E9DB7] mt-0.5">
                  Your own words, behind a private link.
                </span>
              </span>
              <Lock className="w-4 h-4 shrink-0 text-[#E5C98D]" />
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 font-sans-ui text-xs text-[#E7B4B4] text-center">{error}</p>
        )}
      </motion.div>
    </div>
  );
};

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, target }) => {
  if (!isOpen) return null;
  // Keyed on the target so reopening for a different reading starts fresh
  // rather than showing the link created for the previous one.
  return <ShareModalContent key={JSON.stringify(target)} onClose={onClose} target={target} />;
};
