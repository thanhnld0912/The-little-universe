import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  fetchShare,
  type SharedContent,
  type SharedMessageContent,
  type SharedTarotContent,
  type DailyPrediction,
  type WeeklyPrediction,
} from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';

interface SharedViewProps {
  slug: string;
  /** Leaves the shared page and enters the app proper. */
  onEnterApp: () => void;
}

/**
 * Narrowing for the snapshot.
 *
 * `content` arrives as `unknown` because the shape depends on `kind`, and the
 * server is free to have been deployed before this build. Checking the one
 * field each renderer leads with means an unexpected shape shows the fallback
 * rather than a card of blanks — a blank card looks like a bug in the sender's
 * message, which is the worst way for this to fail.
 */
function hasString<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  );
}

const Panel: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="bg-[#111736]/70 rounded-2xl p-5 border border-white/5 text-left">
    <h4 className="text-xs font-sans-ui uppercase tracking-wider text-[#E5C98D] mb-1.5 font-medium">
      {label}
    </h4>
    {children}
  </div>
);

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm font-sans-ui text-[#BAC7E0] leading-relaxed">{children}</p>
);

function renderContent(shared: SharedContent): React.ReactNode {
  const { kind, content } = shared;

  if (kind === 'secret') {
    // The one kind whose words were written by a person. It is given the most
    // room and no decoration, because it is not a reading.
    return (
      <p className="font-cormorant italic text-2xl sm:text-3xl text-[#F7F4EC] leading-relaxed text-center px-2">
        {shared.note}
      </p>
    );
  }

  if (kind === 'daily' && hasString(content, 'prediction')) {
    const daily = content as unknown as DailyPrediction;
    return (
      <div className="space-y-4">
        <p className="font-cormorant italic text-xl sm:text-2xl text-[#F7F4EC] leading-relaxed text-center">
          “{daily.prediction}”
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-0.5 rounded-full bg-[#E5C98D]/10 border border-[#E5C98D]/25 text-[#E5C98D] text-[11px] font-sans-ui">
            {daily.energy} · {daily.energyScore}%
          </span>
          <span className="px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#BAC7E0] text-[11px] font-sans-ui">
            {daily.luckyColor} · {daily.luckyNumber}
          </span>
        </div>
        {daily.cosmicQuote && (
          <Panel label="Cosmic Note">
            <Body>{daily.cosmicQuote}</Body>
          </Panel>
        )}
      </div>
    );
  }

  if (kind === 'weekly' && hasString(content, 'summary')) {
    const weekly = content as unknown as WeeklyPrediction;
    const brightest = weekly.days.find((day) => day.isPeak);
    return (
      <div className="space-y-4">
        <p className="font-cormorant italic text-xl sm:text-2xl text-[#F7F4EC] leading-relaxed text-center">
          {weekly.summary}
        </p>
        <p className="font-sans-ui text-[11px] tracking-[0.2em] text-[#93A1BC] uppercase text-center">
          {weekly.weekStart} — {weekly.weekEnd}
        </p>
        {brightest && (
          <Panel label={`Brightest day · ${brightest.day}`}>
            <Body>{brightest.prediction}</Body>
          </Panel>
        )}
      </div>
    );
  }

  if (kind === 'tarot' && hasString(content, 'meaning')) {
    const tarot = content as unknown as SharedTarotContent;
    const isReversed = tarot.orientation === 'reversed';
    return (
      <div className="space-y-4">
        <div className="text-center">
          <span className="text-xs font-sans-ui tracking-widest text-indigo-300 uppercase block mb-1">
            {tarot.card.archetype}
          </span>
          <h3 className="font-cormorant text-3xl sm:text-4xl text-[#F8F6F0]">{tarot.card.name}</h3>
          {/* Shown for the same reason as in the app: the meaning below is the
              one for the orientation drawn. */}
          <span
            className={`inline-flex items-center gap-1.5 mt-3 px-3 py-0.5 rounded-full text-[11px] font-sans-ui uppercase tracking-widest border ${
              isReversed
                ? 'bg-[#3A2246]/60 border-[#C89BE5]/35 text-[#D8B4FE]'
                : 'bg-[#E5C98D]/10 border-[#E5C98D]/25 text-[#E5C98D]'
            }`}
          >
            <ArrowUpRight className={`w-3 h-3 ${isReversed ? 'rotate-180' : ''}`} aria-hidden="true" />
            {isReversed ? 'Reversed' : 'Upright'}
          </span>
        </div>
        <Panel label="Cosmic Meaning">
          <p className="font-cormorant text-lg text-[#EDE8DD] leading-relaxed">{tarot.meaning}</p>
        </Panel>
        <Panel label={tarot.reading.title}>
          <Body>{tarot.reading.interpretation}</Body>
        </Panel>
        <div className="bg-gradient-to-r from-[#17204A]/60 to-[#101736]/60 rounded-2xl p-5 border border-[#E5C98D]/20 text-center">
          <span className="text-[11px] font-sans-ui uppercase tracking-widest text-[#E5C98D]/80 block mb-1">
            A Question to Sit With
          </span>
          <p className="font-cormorant italic text-lg text-[#F7F4EC]">
            {tarot.reading.reflectionQuestion}
          </p>
        </div>
      </div>
    );
  }

  if (kind === 'message' && hasString(content, 'whisper')) {
    const message = content as unknown as SharedMessageContent;
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-cormorant text-3xl sm:text-4xl text-[#F8F6F0]">{message.title}</h3>
          <p className="font-sans-ui text-xs text-[#9EACCA] mt-1">{message.subtitle}</p>
          <p className="font-sans-ui text-[11px] tracking-[0.2em] text-[#E5C98D]/80 uppercase mt-2">
            {message.celestialSign}
          </p>
        </div>
        <p className="font-cormorant italic text-xl sm:text-2xl text-[#F7F4EC] leading-relaxed text-center">
          “{message.whisper}”
        </p>
        <Panel label="An Affirmation">
          <p className="font-cormorant text-lg text-[#EDE8DD] leading-relaxed">
            {message.affirmation}
          </p>
        </Panel>
      </div>
    );
  }

  // An unrecognised shape. Better an honest sentence than a card of blanks.
  return (
    <p className="font-sans-ui text-sm text-[#9EACCA] text-center">
      This link holds something this version of the app cannot show yet.
    </p>
  );
}

const HEADINGS: Record<SharedContent['kind'], string> = {
  secret: 'Someone wrote this for you',
  daily: 'Someone shared their reading',
  weekly: 'Someone shared their week',
  tarot: 'Someone shared their card',
  message: 'Someone shared their message',
};

/**
 * The page a recipient lands on.
 *
 * Rendered instead of the app, not inside it: someone arriving from a link has
 * not chosen to use this site, and the first thing they see should be what was
 * sent to them rather than a navigation bar.
 */
export const SharedView: React.FC<SharedViewProps> = ({ slug, onEnterApp }) => {
  const { data, error, isLoading } = useAsyncData<SharedContent>(() => fetchShare(slug));

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl cosmic-glass rounded-3xl p-6 sm:p-9 border border-[#E5C98D]/30 shadow-[0_0_60px_rgba(229,201,141,0.15)] bg-[#0C122C]/95"
      >
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-full bg-[#1A234E] border border-[#E5C98D]/30 mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-[#E5C98D]" />
          </div>
          <span className="font-sans-ui text-[11px] tracking-[0.25em] text-[#93A1BC] uppercase block">
            The Little Universe
          </span>
          {data && (
            <h1 className="font-cormorant text-3xl sm:text-4xl text-[#F8F6F0] mt-2">
              {HEADINGS[data.kind]}
            </h1>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3 animate-pulse" aria-hidden="true">
            <div className="h-4 rounded-full bg-white/10 w-full" />
            <div className="h-4 rounded-full bg-white/10 w-10/12 mx-auto" />
            <div className="h-4 rounded-full bg-white/10 w-8/12 mx-auto" />
          </div>
        )}

        {error && (
          <p className="font-sans-ui text-sm text-[#E7B4B4] text-center">
            {/* A wrong, expired or mistyped link is the common case, so it is
                said plainly rather than dressed as an error. */}
            {error}
          </p>
        )}

        {data && renderContent(data)}

        <div className="mt-8 pt-5 border-t border-white/10 flex flex-col items-center gap-3">
          <p className="font-sans-ui text-xs text-[#8E9DB7] text-center">
            Your own sky looks different. Have a look.
          </p>
          <button
            onClick={onEnterApp}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-medium text-xs sm:text-sm transition-colors"
          >
            <span>Open The Little Universe</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
