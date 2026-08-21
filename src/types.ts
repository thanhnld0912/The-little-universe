export type ActiveTab = 'home' | 'today' | 'week' | 'tarot' | 'message';

export type MoodType = 'quiet' | 'romantic' | 'hopeful' | 'restless' | 'peaceful' | 'mystical';

export interface DayForecast {
  id: string;
  day: string;
  shortName: string;
  type: string;
  tagline: string;
  isPeak?: boolean;
  batteryLevel: number;
  highlightTitle?: string;
  highlightQuote?: string;
  tags?: string[];
  element?: string;
  gemstone?: string;
  cosmicAdvice?: string;
}

export interface TarotCard {
  id: string;
  cardIndex: 'CARD I' | 'CARD II' | 'CARD III';
  name: string;
  numeral: string;
  archetype: string;
  keywords: string[];
  element: string;
  meaning: string;
  guidance: string;
  affirmation: string;
  visualType: 'moon' | 'phases' | 'astrolabe';
}

export interface UniverseMessageResult {
  id: string;
  title: string;
  subtitle: string;
  dateStr: string;
  celestialSign: string;
  userPrompt?: string;
  mood: MoodType;
  whisper: string;
  affirmation: string;
  actionGuidance: string;
  luckyNumber: string;
  cosmicEnergy: string;
}
