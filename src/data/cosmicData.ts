import { MoodType } from '../types';

export const MOOD_CONFIG: Record<
  MoodType,
  { label: string; icon: string; promptPlaceholder: string; color: string }
> = {
  quiet: {
    label: 'Quiet',
    icon: '🌙',
    promptPlaceholder: 'I am reflecting on quiet changes, slowing down my thoughts...',
    color: 'from-indigo-900/40 to-slate-900/40',
  },
  romantic: {
    label: 'Romantic',
    icon: '💖',
    promptPlaceholder: 'Someone or something is fluttering in my heart...',
    color: 'from-rose-950/40 to-indigo-950/40',
  },
  hopeful: {
    label: 'Hopeful',
    icon: '✨',
    promptPlaceholder: 'I feel a gentle spark of new beginnings on the horizon...',
    color: 'from-amber-950/40 to-indigo-950/40',
  },
  restless: {
    label: 'Restless',
    icon: '🌪',
    promptPlaceholder: 'My mind has been racing with ideas, decisions, or nervous energy...',
    color: 'from-cyan-950/40 to-slate-950/40',
  },
  peaceful: {
    label: 'Peaceful',
    icon: '🌊',
    promptPlaceholder: 'I feel grounded and calm, looking for an aligned blessing...',
    color: 'from-teal-950/40 to-slate-950/40',
  },
  mystical: {
    label: 'Mystical',
    icon: '🔮',
    promptPlaceholder: 'Looking for a deeper celestial sign or synchronicities...',
    color: 'from-purple-950/40 to-indigo-950/40',
  },
};

