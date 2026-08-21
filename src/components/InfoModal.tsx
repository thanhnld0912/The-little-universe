import React from 'react';
import { X, Sparkles, Shield, FileText, HelpCircle, Mail } from 'lucide-react';
import { motion } from 'motion/react';

interface InfoModalProps {
  type: 'privacy' | 'terms' | 'support' | 'contact' | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const contentMap = {
    privacy: {
      title: 'Celestial Privacy Sanctuary',
      icon: <Shield className="w-5 h-5 text-[#E5C98D]" />,
      desc: 'Your sacred space is strictly private.',
      body: [
        'At The Little Universe, we believe your personal reflections, dreams, and cosmic queries belong solely to you.',
        'We do not sell, track, or commercialize your thoughts. All card pulls and intention prompts exist purely to provide comfort, gentle perspective, and mindfulness.',
        'Your local readings are securely processed directly in your client session with maximum tranquility and respect.',
      ],
    },
    terms: {
      title: 'Cosmic Guidelines & Terms',
      icon: <FileText className="w-5 h-5 text-[#E5C98D]" />,
      desc: 'Harmony and peaceful intention for every voyager.',
      body: [
        'The Little Universe is an artistic, mindfulness, and contemplative sanctuary intended to inspire personal reflection, curiosity, and emotional calm.',
        'Readings, forecasts, and tarot cards are poetic metaphors and spiritual reflections—not medical, legal, or financial counsel.',
        'May you use this portal to nurture gentle awareness and positive connection in your daily life.',
      ],
    },
    support: {
      title: 'Cosmic Support & Sanctuary Help',
      icon: <HelpCircle className="w-5 h-5 text-[#E5C98D]" />,
      desc: 'Here whenever you need gentle guidance navigating the cosmos.',
      body: [
        'Need help interpreting a weekly forecast or navigating a card draw? We are always here to ensure your experience feels effortless and peaceful.',
        'Feel free to explore our daily reflections each morning at sunrise when the celestial energies re-align.',
        'If you experience any visual discrepancies or device compatibility concerns, our guardians will gladly assist.',
      ],
    },
    contact: {
      title: 'Contact the Universe Guardians',
      icon: <Mail className="w-5 h-5 text-[#E5C98D]" />,
      desc: 'We would love to hear how the universe has touched your day.',
      body: [
        'Have feedback, a synchronicity story, or a partnership inquiry for The Little Universe sanctuary?',
        'Reach our celestial keepers anytime at: contact@thelittleuniverse.space',
        'We respond with starlight, warmth, and heartfelt appreciation.',
      ],
    },
  };

  const current = contentMap[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg cosmic-glass rounded-3xl p-6 sm:p-8 border border-[#E5C98D]/30 shadow-[0_0_50px_rgba(229,201,141,0.15)] bg-[#0C122C]/95"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-400/20">
            {current.icon}
          </div>
          <div>
            <h3 className="font-cormorant text-2xl sm:text-3xl text-[#F8F6F0] font-normal">
              {current.title}
            </h3>
            <p className="text-xs font-sans-ui text-[#9EACCA]">{current.desc}</p>
          </div>
        </div>

        <div className="space-y-3.5 my-6 text-sm font-sans-ui text-[#CBD5E1] leading-relaxed bg-[#0F1635]/60 rounded-2xl p-5 border border-white/5">
          {current.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#E5C98D] hover:bg-[#F2DBA2] text-[#0A0E22] font-medium text-xs font-sans-ui transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
