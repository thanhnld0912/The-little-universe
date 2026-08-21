import React from 'react';

// Central Glowing Cosmic Orb (Landing Screen - Image 3)
export const CosmicOrb: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer atmospheric aura */}
      <div className="absolute w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-600/10 to-transparent blur-3xl animate-orb-pulse pointer-events-none" />
      
      {/* Secondary soft ring halo */}
      <div className="absolute w-[320px] h-[320px] sm:w-[430px] sm:h-[430px] rounded-full border border-indigo-400/20 bg-indigo-950/20 shadow-[0_0_60px_rgba(79,70,229,0.15)] animate-pulse pointer-events-none" />

      {/* Main Celestial Circle matching screenshot */}
      <div className="relative w-[280px] h-[280px] sm:w-[390px] sm:h-[390px] rounded-full overflow-hidden shadow-[inset_0_0_80px_rgba(15,23,42,0.9),0_0_40px_rgba(99,102,241,0.2)] border border-indigo-400/30">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full object-cover"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="orbGradient" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#1B254B" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#111836" stopOpacity="0.95" />
              <stop offset="85%" stopColor="#0B0F24" stopOpacity="1" />
              <stop offset="100%" stopColor="#070A18" stopOpacity="1" />
            </radialGradient>
            
            <radialGradient id="nebulaGlow" cx="60%" cy="40%" r="40%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E5C98D" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#818CF8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#E5C98D" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Deep celestial interior */}
          <circle cx="200" cy="200" r="198" fill="url(#orbGradient)" />
          <circle cx="200" cy="200" r="198" fill="url(#nebulaGlow)" />

          {/* Celestial rings and sacred geometric lines */}
          <circle cx="200" cy="200" r="175" fill="none" stroke="url(#ringGrad)" strokeWidth="0.75" strokeDasharray="4 6" opacity="0.6" />
          <circle cx="200" cy="200" r="145" fill="none" stroke="#E5C98D" strokeWidth="0.5" opacity="0.35" />
          <circle cx="200" cy="200" r="105" fill="none" stroke="#818CF8" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.4" />

          {/* Constellation dots */}
          <g fill="#E5C98D" opacity="0.7">
            <circle cx="140" cy="120" r="1.5" />
            <circle cx="180" cy="100" r="1" />
            <circle cx="240" cy="110" r="2" />
            <circle cx="270" cy="160" r="1.2" />
            <circle cx="250" cy="230" r="1.8" />
            <circle cx="180" cy="270" r="1.5" />
            <circle cx="120" cy="240" r="1.2" />
            <circle cx="110" cy="170" r="2" />
            <circle cx="200" cy="190" r="2.5" />
          </g>

          {/* Delicate constellation connecting lines */}
          <g stroke="#E5C98D" strokeWidth="0.4" opacity="0.25">
            <line x1="140" y1="120" x2="180" y2="100" />
            <line x1="180" y1="100" x2="240" y2="110" />
            <line x1="240" y1="110" x2="270" y2="160" />
            <line x1="270" y1="160" x2="250" y2="230" />
            <line x1="250" y1="230" x2="180" y2="270" />
            <line x1="180" y1="270" x2="120" y2="240" />
            <line x1="120" y1="240" x2="110" y2="170" />
            <line x1="110" y1="170" x2="140" y2="120" />
            <line x1="200" y1="190" x2="240" y2="110" />
            <line x1="200" y1="190" x2="110" y2="170" />
          </g>

          {/* Central subtle shimmer star */}
          <g transform="translate(200, 190)">
            <path
              d="M0,-12 Q2,-2 12,0 Q2,2 0,12 Q-2,2 -12,0 Q-2,-2 0,-12 Z"
              fill="#FFF4D0"
              opacity="0.8"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

// Nebula Banner for Today Screen (Image 5)
export const NebulaBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full h-36 sm:h-44 rounded-2xl overflow-hidden border border-indigo-500/20 shadow-[0_4px_25px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Background space colors */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0C1024] via-[#141B3B] to-[#0A0D1E]" />

      {/* Nebula SVG Art with organic glowing stardust */}
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 180"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="dustBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <radialGradient id="nebulaCore" cx="55%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.4" />
            <stop offset="25%" stopColor="#C084FC" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#E5C98D" stopOpacity="0.2" />
            <stop offset="80%" stopColor="#6366F1" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Nebula dust cloud paths */}
        <path
          d="M 120,90 Q 200,30 310,70 T 480,95 Q 560,130 460,140 T 260,130 Q 140,140 120,90 Z"
          fill="url(#nebulaCore)"
          filter="url(#dustBlur)"
          opacity="0.85"
        />

        <path
          d="M 220,70 Q 320,40 420,80 T 510,110 Q 440,150 340,120 T 180,110 Z"
          fill="#D8B4FE"
          filter="url(#dustBlur)"
          opacity="0.35"
        />

        {/* Scattered Starlight Particles */}
        <g fill="#FFF">
          <circle cx="150" cy="50" r="0.8" opacity="0.6" />
          <circle cx="210" cy="110" r="1.2" opacity="0.8" />
          <circle cx="280" cy="65" r="1.5" opacity="0.9" fill="#E5C98D" />
          <circle cx="340" cy="95" r="2.2" opacity="1" fill="#FFFBEB" />
          <circle cx="390" cy="60" r="1.2" opacity="0.7" />
          <circle cx="430" cy="120" r="1.8" opacity="0.85" fill="#E5C98D" />
          <circle cx="490" cy="80" r="1.0" opacity="0.6" />
          <circle cx="530" cy="130" r="0.8" opacity="0.5" />
        </g>

        {/* Star Flare on main nucleus */}
        <g transform="translate(340, 95)" opacity="0.9">
          <line x1="-15" y1="0" x2="15" y2="0" stroke="#FFFBEB" strokeWidth="0.8" />
          <line x1="0" y1="-15" x2="0" y2="15" stroke="#FFFBEB" strokeWidth="0.8" />
          <circle cx="0" cy="0" r="3" fill="#FFFBEB" />
        </g>
      </svg>

      {/* Subtle overlay shimmer */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090D1C]/80 via-transparent to-[#090D1C]/40 pointer-events-none" />
    </div>
  );
};

// Tarot Card Back Art 1: Moon & Sacred Geometry (Matching Card I in Image 9)
export const TarotCardBackI: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-[#0D122B] rounded-2xl overflow-hidden border border-[#E5C98D]/40 p-3 flex flex-col items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      {/* Outer border trim */}
      <div className="absolute inset-1.5 rounded-xl border border-[#E5C98D]/25 pointer-events-none" />
      <div className="absolute inset-2.5 rounded-lg border border-[#E5C98D]/15 pointer-events-none" />

      {/* Top Header */}
      <div className="pt-2 text-center z-10">
        <span className="font-cinzel text-[10px] tracking-[0.25em] text-[#E5C98D]/70 uppercase">
          Tarot
        </span>
        <div className="text-[8px] font-sans-ui tracking-[0.15em] text-[#E5C98D]/50 uppercase">
          The Little Universe
        </div>
      </div>

      {/* Center Sacred Art */}
      <div className="relative my-auto flex items-center justify-center w-full px-4">
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px] h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="cardGlow1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="100" cy="130" r="75" fill="url(#cardGlow1)" />

          {/* Sacred Diamond & Circles */}
          <polygon points="100,20 180,130 100,240 20,130" fill="none" stroke="#E5C98D" strokeWidth="0.75" opacity="0.6" />
          <polygon points="100,35 165,130 100,225 35,130" fill="none" stroke="#E5C98D" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
          <circle cx="100" cy="130" r="55" fill="none" stroke="#E5C98D" strokeWidth="0.8" opacity="0.7" />
          <circle cx="100" cy="130" r="42" fill="none" stroke="#E5C98D" strokeWidth="0.5" opacity="0.5" />
          <circle cx="100" cy="130" r="30" fill="none" stroke="#818CF8" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.8" />

          {/* Radiating Ray Star */}
          <g stroke="#E5C98D" strokeWidth="0.5" opacity="0.45">
            <line x1="100" y1="50" x2="100" y2="210" />
            <line x1="20" y1="130" x2="180" y2="130" />
            <line x1="43" y1="73" x2="157" y2="187" />
            <line x1="43" y1="187" x2="157" y2="73" />
          </g>

          {/* Crescent Moon in Center */}
          <path
            d="M 92,108 A 22,22 0 1,0 114,146 A 17,17 0 1,1 92,108 Z"
            fill="#E5C98D"
            opacity="0.9"
          />

          {/* Little Stars & Constellation Details */}
          <g fill="#FFF4D0">
            <circle cx="100" cy="70" r="1.5" />
            <circle cx="100" cy="190" r="1.5" />
            <circle cx="40" cy="130" r="1.5" />
            <circle cx="160" cy="130" r="1.5" />
            <circle cx="118" cy="120" r="1.2" />
            <circle cx="110" cy="138" r="1" />
          </g>
        </svg>
      </div>

      {/* Bottom Label Container */}
      <div className="pb-3 w-full flex justify-center z-10">
        <div className="px-5 py-1.5 rounded-full bg-[#0A0E22]/90 border border-[#E5C98D]/40 text-[#E5C98D] font-cinzel text-xs tracking-widest uppercase shadow-md">
          CARD I
        </div>
      </div>
    </div>
  );
};

// Tarot Card Back Art 2: Moon Phases & Botanical (Matching Card II in Image 9)
export const TarotCardBackII: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-[#0B1028] rounded-2xl overflow-hidden border border-[#E5C98D]/40 p-3 flex flex-col items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-1.5 rounded-xl border border-[#E5C98D]/25 pointer-events-none" />
      <div className="absolute inset-2.5 rounded-lg border border-[#E5C98D]/15 pointer-events-none" />

      {/* Top Header */}
      <div className="pt-2 text-center z-10">
        <span className="font-cinzel text-[10px] tracking-[0.25em] text-[#E5C98D]/70 uppercase">
          Tarot
        </span>
        <div className="text-[8px] font-sans-ui tracking-[0.15em] text-[#E5C98D]/50 uppercase">
          The Little Universe
        </div>
      </div>

      {/* Center Lunar Phases Art */}
      <div className="relative my-auto flex items-center justify-center w-full px-4">
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px] h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Arch Frame */}
          <path
            d="M 30,220 L 30,80 A 70,70 0 0,1 170,80 L 170,220 Z"
            fill="none"
            stroke="#E5C98D"
            strokeWidth="0.75"
            opacity="0.5"
          />

          <circle cx="100" cy="130" r="60" fill="url(#moonGlow)" />

          {/* Central Realistic Full Moon Disc */}
          <circle cx="100" cy="130" r="28" fill="#D1D5DB" opacity="0.95" />
          {/* Moon craters / textures */}
          <g fill="#9CA3AF" opacity="0.6">
            <circle cx="94" cy="122" r="5" />
            <circle cx="108" cy="125" r="4" />
            <circle cx="98" cy="138" r="6" />
            <circle cx="112" cy="139" r="3" />
            <circle cx="89" cy="134" r="2.5" />
          </g>

          {/* Moon Phases Arc around full moon */}
          {/* New Moon */}
          <circle cx="100" cy="70" r="6" fill="none" stroke="#E5C98D" strokeWidth="0.8" />
          {/* Waxing Crescent */}
          <path d="M 138,82 A 6,6 0 1,0 144,92 A 4.5,4.5 0 1,1 138,82 Z" fill="#E5C98D" />
          {/* First Quarter */}
          <path d="M 160,130 A 6,6 0 0,0 160,118 Z" fill="#E5C98D" />
          {/* Waning Crescent */}
          <path d="M 62,82 A 6,6 0 1,1 56,92 A 4.5,4.5 0 1,0 62,82 Z" fill="#E5C98D" />
          {/* Third Quarter */}
          <path d="M 40,130 A 6,6 0 0,1 40,118 Z" fill="#E5C98D" />

          {/* Celestial Flora / Leaves below */}
          <g stroke="#E5C98D" strokeWidth="0.75" fill="none" opacity="0.65">
            <path d="M 100,165 Q 100,205 100,215" />
            <path d="M 100,180 Q 80,175 75,190" />
            <path d="M 100,180 Q 120,175 125,190" />
            <path d="M 100,195 Q 75,195 70,210" />
            <path d="M 100,195 Q 125,195 130,210" />
          </g>

          {/* Star sprinkles */}
          <g fill="#E5C98D" opacity="0.8">
            <circle cx="70" cy="55" r="1.2" />
            <circle cx="130" cy="55" r="1.2" />
            <circle cx="50" cy="170" r="1" />
            <circle cx="150" cy="170" r="1" />
          </g>
        </svg>
      </div>

      {/* Bottom Label Container */}
      <div className="pb-3 w-full flex justify-center z-10">
        <div className="px-5 py-1.5 rounded-full bg-[#0A0E22]/90 border border-[#E5C98D]/40 text-[#E5C98D] font-cinzel text-xs tracking-widest uppercase shadow-md">
          CARD II
        </div>
      </div>
    </div>
  );
};

// Tarot Card Back Art 3: Astrolabe & Zodiac Dial (Matching Card III in Image 9)
export const TarotCardBackIII: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-[#090E26] rounded-2xl overflow-hidden border border-[#E5C98D]/40 p-3 flex flex-col items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-1.5 rounded-xl border border-[#E5C98D]/25 pointer-events-none" />
      <div className="absolute inset-2.5 rounded-lg border border-[#E5C98D]/15 pointer-events-none" />

      {/* Top Header */}
      <div className="pt-2 text-center z-10">
        <span className="font-cinzel text-[10px] tracking-[0.25em] text-[#E5C98D]/70 uppercase">
          Tarot
        </span>
        <div className="text-[8px] font-sans-ui tracking-[0.15em] text-[#E5C98D]/50 uppercase">
          The Little Universe
        </div>
      </div>

      {/* Center Astrolabe / Zodiac Art */}
      <div className="relative my-auto flex items-center justify-center w-full px-4">
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px] h-auto" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="100" cy="130" r="75" fill="url(#sunGlow)" />

          {/* Concentric Astrolabe Rings */}
          <circle cx="100" cy="130" r="68" fill="none" stroke="#E5C98D" strokeWidth="0.8" opacity="0.8" />
          <circle cx="100" cy="130" r="58" fill="none" stroke="#E5C98D" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
          <circle cx="100" cy="130" r="46" fill="none" stroke="#E5C98D" strokeWidth="0.6" opacity="0.5" />
          <circle cx="100" cy="130" r="30" fill="none" stroke="#E5C98D" strokeWidth="0.8" opacity="0.8" />
          <circle cx="100" cy="130" r="16" fill="none" stroke="#E5C98D" strokeWidth="0.5" opacity="0.7" />

          {/* Astrolabe Pointer Crosshairs & 12 Division Rays */}
          <g stroke="#E5C98D" strokeWidth="0.5" opacity="0.45">
            <line x1="100" y1="62" x2="100" y2="198" />
            <line x1="32" y1="130" x2="168" y2="130" />
            <line x1="52" y1="82" x2="148" y2="178" />
            <line x1="52" y1="178" x2="148" y2="82" />
            <line x1="70" y1="66" x2="130" y2="194" />
            <line x1="70" y1="194" x2="130" y2="66" />
          </g>

          {/* Center Radiant Sun Face */}
          <circle cx="100" cy="130" r="10" fill="#E5C98D" opacity="0.9" />
          {/* Sun Rays */}
          <g stroke="#E5C98D" strokeWidth="0.75" opacity="0.8">
            <line x1="100" y1="116" x2="100" y2="119" />
            <line x1="100" y1="141" x2="100" y2="144" />
            <line x1="86" y1="130" x2="89" y2="130" />
            <line x1="111" y1="130" x2="114" y2="130" />
            <line x1="90" y1="120" x2="93" y2="123" />
            <line x1="107" y1="137" x2="110" y2="140" />
            <line x1="90" y1="140" x2="93" y2="137" />
            <line x1="107" y1="123" x2="110" y2="120" />
          </g>

          {/* Zodiac node markers */}
          <g fill="#FFFBEB" opacity="0.75">
            <circle cx="100" cy="68" r="1.5" />
            <circle cx="159" cy="96" r="1.5" />
            <circle cx="159" cy="164" r="1.5" />
            <circle cx="100" cy="192" r="1.5" />
            <circle cx="41" cy="164" r="1.5" />
            <circle cx="41" cy="96" r="1.5" />
          </g>
        </svg>
      </div>

      {/* Bottom Label Container */}
      <div className="pb-3 w-full flex justify-center z-10">
        <div className="px-5 py-1.5 rounded-full bg-[#0A0E22]/90 border border-[#E5C98D]/40 text-[#E5C98D] font-cinzel text-xs tracking-widest uppercase shadow-md">
          CARD III
        </div>
      </div>
    </div>
  );
};
