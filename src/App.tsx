import React, { useEffect, useState } from 'react';
import { ActiveTab } from './types';
import { CosmicBackground } from './components/CosmicBackground';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { TodayView } from './components/TodayView';
import { ThisWeekView } from './components/ThisWeekView';
import { TarotView } from './components/TarotView';
import { YourMessageView } from './components/YourMessageView';
import { SharedView } from './components/SharedView';
import { ShareModal } from './components/ShareModal';
import { InfoModal } from './components/InfoModal';
import type { ShareTarget } from './services/api';
import { motion, AnimatePresence } from 'motion/react';

/**
 * `/s/<slug>` is the only client-side route this app has.
 *
 * Matched here rather than with a router, because one route does not justify a
 * routing dependency. The pattern is the slug's own format, so a path that is
 * not a share falls through to the app instead of rendering a broken page.
 *
 * Vercel rewrites `/s/*` to index.html; without that rewrite this never runs,
 * because the request 404s before any JavaScript loads.
 */
function slugFromLocation(): string | null {
  const match = /^\/s\/([A-Za-z0-9_-]{16,43})\/?$/.exec(window.location.pathname);
  return match?.[1] ?? null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [infoModalType, setInfoModalType] = useState<'privacy' | 'terms' | 'support' | 'contact' | null>(null);
  const [sharedSlug, setSharedSlug] = useState<string | null>(slugFromLocation);

  // Back and forward must work: someone who opened a link, entered the app and
  // pressed Back expects the message again, not the home screen.
  useEffect(() => {
    const onPopState = () => setSharedSlug(slugFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Each view says what it is offering; `null` means "nothing open to share". */
  const openShare = (target: ShareTarget | null) => {
    setShareTarget(target);
    setShareModalOpen(true);
  };

  const handleEnterApp = () => {
    // Replaces the share URL so a refresh does not reopen it, while leaving the
    // link itself valid for whoever else holds it.
    window.history.pushState({}, '', '/');
    setSharedSlug(null);
  };

  // A recipient sees what was sent to them, not the app around it. They did not
  // choose to come here, and a navigation bar is not the first thing they need.
  if (sharedSlug) {
    return (
      <div className="relative min-h-screen bg-[#070913] text-[#E2E8F0] overflow-x-hidden selection:bg-[#E5C98D]/25 selection:text-[#E5C98D]">
        <CosmicBackground />
        <SharedView slug={sharedSlug} onEnterApp={handleEnterApp} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#070913] text-[#E2E8F0] flex flex-col justify-between selection:bg-[#E5C98D]/25 selection:text-[#E5C98D] overflow-x-hidden">
      {/* Dynamic Starry Night Sky Canvas */}
      <CosmicBackground />

      {/* Persistent Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        // The header is available everywhere, including where nothing is open
        // to share, so it offers a secret message rather than a reading.
        onOpenShare={() => openShare(null)}
      />

      {/* Main View Transition Container */}
      <main className="flex-1 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <HomeView onNavigate={handleNavigate} />
            </motion.div>
          )}

          {activeTab === 'today' && (
            <motion.div
              key="today-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <TodayView
                onRevealMessage={() => handleNavigate('message')}
                onOpenShare={() => openShare({ kind: 'daily' })}
              />
            </motion.div>
          )}

          {activeTab === 'week' && (
            <motion.div
              key="week-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <ThisWeekView onOpenShare={() => openShare({ kind: 'weekly' })} />
            </motion.div>
          )}

          {activeTab === 'tarot' && (
            <motion.div
              key="tarot-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Tarot and messages pass their own target: the id belongs to
                  their state, so only they know what is open. */}
              <TarotView onOpenShare={openShare} />
            </motion.div>
          )}

          {activeTab === 'message' && (
            <motion.div
              key="message-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <YourMessageView onOpenShare={openShare} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer across all views */}
      <Footer
        onOpenModal={(type) => setInfoModalType(type)}
        onNavigateHome={() => handleNavigate('home')}
      />

      {/* Share Dialog */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        target={shareTarget}
      />

      {/* Information Dialogs (Privacy, Terms, Support, Contact) */}
      <InfoModal
        type={infoModalType}
        onClose={() => setInfoModalType(null)}
      />
    </div>
  );
}
