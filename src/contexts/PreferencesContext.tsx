import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark' | 'hybrid';
export type FontScale = 'default' | 'large';

export type NotificationPreferences = {
  email_enabled: boolean;
  sound_enabled: boolean;
  activities: boolean;
  deadlines: boolean;
  answers: boolean;
  announcements: boolean;
  community: boolean;
  administrative: boolean;
};

export type PrivacyPreferences = {
  profile_visible: boolean;
  show_company: boolean;
  show_role: boolean;
};

export type UserPreferences = {
  language: string;
  timezone: string;
  theme: ThemeMode;
  font_scale: FontScale;
  high_contrast: boolean;
  reduced_motion: boolean;
  focus_emphasis: boolean;
  notification_preferences: NotificationPreferences;
  privacy_preferences: PrivacyPreferences;
};

const THEME_KEY = 'ma_theme';
const PREFERENCES_KEY = 'ma_preferences';

const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  email_enabled: true,
  sound_enabled: false,
  activities: true,
  deadlines: true,
  answers: true,
  announcements: true,
  community: true,
  administrative: true,
};

const PRIVACY_DEFAULTS: PrivacyPreferences = {
  profile_visible: true,
  show_company: true,
  show_role: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  theme: 'dark',
  font_scale: 'default',
  high_contrast: false,
  reduced_motion: false,
  focus_emphasis: false,
  notification_preferences: NOTIFICATION_DEFAULTS,
  privacy_preferences: PRIVACY_DEFAULTS,
};

function storedTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'hybrid' ? value : 'dark';
}

function preferencesKey(userId: string) {
  return `${PREFERENCES_KEY}:${userId}`;
}

function storedPreferences(userId: string): Partial<UserPreferences> | null {
  try {
    const value = localStorage.getItem(preferencesKey(userId));
    return value ? JSON.parse(value) as Partial<UserPreferences> : null;
  } catch {
    return null;
  }
}

function storePreferences(userId: string, preferences: UserPreferences) {
  localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences));
}

function normalize(row?: Partial<UserPreferences> | null): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...row,
    theme: row?.theme === 'light' || row?.theme === 'hybrid' || row?.theme === 'dark' ? row.theme : storedTheme(),
    notification_preferences: { ...NOTIFICATION_DEFAULTS, ...(row?.notification_preferences ?? {}) },
    privacy_preferences: { ...PRIVACY_DEFAULTS, ...(row?.privacy_preferences ?? {}) },
  };
}

function applyToDocument(prefs: UserPreferences) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.style.colorScheme = prefs.theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = prefs.theme;
  root.lang = prefs.language;
  root.classList.toggle('ma-font-large', prefs.font_scale === 'large');
  root.classList.toggle('ma-high-contrast', prefs.high_contrast);
  root.classList.toggle('ma-reduced-motion', prefs.reduced_motion);
  root.classList.toggle('ma-focus-emphasis', prefs.focus_emphasis);
  localStorage.setItem(THEME_KEY, prefs.theme);
}

type PreferencesContextValue = {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => normalize({ theme: storedTheme() }));
  const [loading, setLoading] = useState(false);

  useEffect(() => applyToDocument(preferences), [preferences]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const localAtRequestStart = storedPreferences(profile.id);
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('language,timezone,theme,font_scale,high_contrast,reduced_motion,focus_emphasis,notification_preferences,privacy_preferences')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (active) {
        setPreferences((current) => {
          const latestLocal = storedPreferences(profile.id);
          const localChangedWhileLoading = JSON.stringify(latestLocal) !== JSON.stringify(localAtRequestStart);
          const remote = data as Partial<UserPreferences> | null;
          // Uma conta sem preferências próprias nunca herda o tema global deixado
          // no navegador por outro usuário: sua primeira entrada começa no escuro.
          const hasOwnPreferences = Boolean(latestLocal || remote);
          const next = error || localChangedWhileLoading
            ? normalize(latestLocal ? { ...current, ...latestLocal } : DEFAULT_PREFERENCES)
            : normalize(hasOwnPreferences
              ? { ...DEFAULT_PREFERENCES, ...latestLocal, ...remote }
              : DEFAULT_PREFERENCES);
          storePreferences(profile.id, next);
          return next;
        });
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profile]);

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    loading,
    updatePreferences: async (patch) => {
      if (!profile) return;
      const next = normalize({
        ...preferences,
        ...patch,
        notification_preferences: patch.notification_preferences ?? preferences.notification_preferences,
        privacy_preferences: patch.privacy_preferences ?? preferences.privacy_preferences,
      });
      const commit = () => {
        applyToDocument(next);
        setPreferences(next);
        storePreferences(profile.id, next);
      };
      const transitionDocument = document as Document & {
        startViewTransition?: (callback: () => void) => unknown;
      };
      const reduceMotion = preferences.reduced_motion
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (patch.theme && transitionDocument.startViewTransition && !reduceMotion) {
        transitionDocument.startViewTransition(commit);
      } else {
        commit();
      }
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: profile.id,
        ...next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      // O armazenamento local mantém o preview funcional quando a migração
      // de user_preferences ainda não está disponível no Supabase remoto.
      if (error) return;
    },
  }), [loading, preferences, profile]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider');
  return value;
}
