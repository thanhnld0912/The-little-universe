import React, { useState } from 'react';
import { ActiveTab } from './types';
import { CosmicBackground } from './components/CosmicBackground';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { TodayView } from './components/TodayView';
import { ThisWeekView } from './components/ThisWeekView';
import { TarotView } from './components/TarotView';
import { YourMessageView } from './components/YourMessageView';
import { ShareModal } from './components/ShareModal';
import { InfoModal } from './components/InfoModal';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<'privacy' | 'terms' | 'support' | 'contact' | null>(null);

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-[#070913] text-[#E2E8F0] flex flex-col justify-between selection:bg-[#E5C98D]/25 selection:text-[#E5C98D] overflow-x-hidden">
      {/* Dynamic Starry Night Sky Canvas */}
      <CosmicBackground />

      {/* Persistent Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        onOpenShare={() => setShareModalOpen(true)}
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
                onOpenShare={() => setShareModalOpen(true)}
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
              <ThisWeekView onOpenShare={() => setShareModalOpen(true)} />
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
              <TarotView onOpenShare={() => setShareModalOpen(true)} />
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
              <YourMessageView onOpenShare={() => setShareModalOpen(true)} />
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
      />

      {/* Information Dialogs (Privacy, Terms, Support, Contact) */}
      <InfoModal
        type={infoModalType}
        onClose={() => setInfoModalType(null)}
      />
    </div>
  );
}
