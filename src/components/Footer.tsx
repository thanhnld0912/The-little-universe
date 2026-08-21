import React from 'react';

interface FooterProps {
  onOpenModal: (type: 'privacy' | 'terms' | 'support' | 'contact') => void;
  onNavigateHome: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenModal, onNavigateHome }) => {
  return (
    <footer className="w-full mt-auto border-t border-white/5 bg-[#070A14]/90 py-10 sm:py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <button
          id="footer-brand-btn"
          onClick={onNavigateHome}
          className="group text-left focus:outline-none"
        >
          <span className="font-cormorant text-2xl font-medium tracking-tight text-[#E8DFD1] group-hover:text-[#E5C98D] transition-colors">
            The Little Universe
          </span>
        </button>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#8E9BB0] font-sans-ui tracking-wide">
          <button
            id="footer-privacy-btn"
            onClick={() => onOpenModal('privacy')}
            className="hover:text-white transition-colors"
          >
            Privacy
          </button>
          <button
            id="footer-terms-btn"
            onClick={() => onOpenModal('terms')}
            className="hover:text-white transition-colors"
          >
            Terms
          </button>
          <button
            id="footer-support-btn"
            onClick={() => onOpenModal('support')}
            className="hover:text-white transition-colors"
          >
            Support
          </button>
          <button
            id="footer-contact-btn"
            onClick={() => onOpenModal('contact')}
            className="hover:text-white transition-colors"
          >
            Contact
          </button>
        </div>

        {/* Copyright */}
        <div className="text-xs text-[#6B7892] font-sans-ui text-center md:text-right">
          © 2024 The Little Universe. All celestial bodies aligned.
        </div>
      </div>
    </footer>
  );
};
