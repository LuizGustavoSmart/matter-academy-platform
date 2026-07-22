import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  HelpCircle,
  Inbox,
  RefreshCw,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useAuth, type Profile } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { supabase } from '../lib/supabase';
import { cn, IconButton, Skeleton } from './ui';

type NotificationKind = 'activity' | 'question' | 'profile';
type NotificationTab = 'all' | 'unread';

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  timestamp: string | null;
  href: string;
};

const READ_STORAGE_PREFIX = 'ma_notification_read:';
const MAX_SAVED_READ_IDS = 500;

const KIND_STYLE: Record<NotificationKind, { icon: typeof Bell; className: string }> = {
  activity: { icon: CalendarClock, className: 'bg-brand/10 text-brand' },
  question: { icon: HelpCircle, className: 'bg-warn/10 text-warn' },
  profile: { icon: UserRoundCheck, className: 'bg-info/10 text-info' },
};

function readStorageKey(userId: string) {
  return `${READ_STORAGE_PREFIX}${userId}`;
}

function readSavedIds(userId: string): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(readStorageKey(userId)) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(readStorageKey(userId), JSON.stringify([...ids].slice(-MAX_SAVED_READ_IDS)));
  } catch {
    // A leitura continua funcionando quando o armazenamento estiver indisponível.
  }
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function relativeLabel(value: string | null) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return 'agora';
  if (elapsedMinutes < 60) return `há ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `há ${elapsedHours} h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `há ${elapsedDays} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function profileName(profile: { nome: string | null; sobrenome: string | null; email: string }) {
  return [profile.nome, profile.sobrenome].filter(Boolean).join(' ') || profile.email;
}

function playNotificationTone() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(720, now);
    oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
    oscillator.addEventListener('ended', () => void audio.close(), { once: true });
  } catch {
    // O painel segue funcional em navegadores que bloqueiam áudio programático.
  }
}

async function fetchNotificationItems(profile: Profile): Promise<NotificationItem[]> {
  if (profile.role === 'admin') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,nome,sobrenome,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(16);

    if (error) throw new Error(error.message);
    return (data ?? []).map((pendingProfile) => ({
      id: `profile:${pendingProfile.id}`,
      kind: 'profile' as const,
      title: 'Cadastro aguardando ativação',
      description: profileName(pendingProfile),
      timestamp: pendingProfile.created_at,
      href: '/admin/usuarios',
    }));
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('user_turmas')
    .select('turma_id')
    .eq('user_id', profile.id);

  if (membershipError) throw new Error(membershipError.message);
  const turmaIds = [...new Set((memberships ?? []).map((membership) => membership.turma_id))];
  if (turmaIds.length === 0) return [];

  const isStaff = profile.role === 'professor' || profile.role === 'monitor';
  const activityRequest = supabase
    .from('atividades')
    .select('id,titulo,prazo,created_at')
    .in('turma_id', turmaIds)
    .gte('prazo', new Date().toISOString())
    .order('prazo', { ascending: true })
    .limit(16);

  const questionRequest = isStaff
    ? supabase
      .from('duvidas')
      .select('id,titulo,created_at,resolved_at')
      .in('turma_id', turmaIds)
      .eq('status', 'aberta')
      .order('created_at', { ascending: false })
      .limit(16)
    : supabase
      .from('duvidas')
      .select('id,titulo,created_at,resolved_at')
      .eq('aluno_id', profile.id)
      .eq('status', 'resolvida')
      .order('resolved_at', { ascending: false })
      .limit(16);

  const [activityResult, questionResult] = await Promise.all([
    activityRequest,
    questionRequest,
  ]);

  if (activityResult.error) throw new Error(activityResult.error.message);
  if (questionResult.error) throw new Error(questionResult.error.message);

  const activities: NotificationItem[] = (activityResult.data ?? []).map((activity) => ({
    id: `activity:${activity.id}`,
    kind: 'activity',
    title: activity.titulo,
    description: activity.prazo ? `Prazo em ${dateLabel(activity.prazo)}` : 'Atividade disponível',
    timestamp: activity.created_at,
    href: `/atividade/${activity.id}`,
  }));

  const questions: NotificationItem[] = (questionResult.data ?? []).map((question) => ({
    id: `question:${question.id}`,
    kind: 'question',
    title: question.titulo,
    description: isStaff ? 'Dúvida aberta aguardando resposta' : 'Sua dúvida recebeu uma resposta',
    timestamp: isStaff ? question.created_at : question.resolved_at ?? question.created_at,
    href: `/duvidas/${question.id}`,
  }));

  return [...activities, ...questions].sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
    return rightTime - leftTime;
  });
}

function emptyMessage(role: Profile['role'], tab: NotificationTab) {
  if (tab === 'unread') return 'Você está em dia. Nenhuma notificação não lida.';
  if (role === 'admin') return 'Nenhum cadastro está aguardando ativação.';
  if (role === 'professor' || role === 'monitor') return 'Nenhuma atividade futura ou dúvida aberta no momento.';
  return 'Nenhuma atividade futura ou resposta nova no momento.';
}

export type NotificationBellProps = {
  className?: string;
  compact?: boolean;
};

export function NotificationBell({ className, compact = false }: NotificationBellProps) {
  const { profile } = useAuth();
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const requestIdRef = useRef(0);
  const lastLoadedAtRef = useRef(0);
  const lastChimedUnreadRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (background = false) => {
    if (!profile) return;
    const requestId = ++requestIdRef.current;
    lastLoadedAtRef.current = Date.now();
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchNotificationItems(profile);
      if (requestId === requestIdRef.current) setItems(nextItems);
    } catch {
      if (requestId === requestIdRef.current) {
        setError('Não foi possível carregar as notificações.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      setItems([]);
      setReadIds(new Set());
      setOpen(false);
      return;
    }
    setReadIds(readSavedIds(profile.id));
    void loadNotifications();
  }, [profile, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnResize = () => setOpen(false);
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  useEffect(() => {
    if (open && Date.now() - lastLoadedAtRef.current > 60_000) void loadNotifications(true);
  }, [open, loadNotifications]);

  const enabledItems = useMemo(() => items.filter((item) => {
    const enabled = preferences.notification_preferences;
    if (item.kind === 'activity') return enabled.activities || enabled.deadlines;
    if (item.kind === 'question') return enabled.answers;
    return enabled.administrative;
  }), [items, preferences.notification_preferences]);
  const unreadCount = useMemo(
    () => enabledItems.reduce((total, item) => total + (readIds.has(item.id) ? 0 : 1), 0),
    [enabledItems, readIds],
  );
  const visibleItems = useMemo(
    () => activeTab === 'all' ? enabledItems : enabledItems.filter((item) => !readIds.has(item.id)),
    [activeTab, enabledItems, readIds],
  );

  const persistReadIds = useCallback((next: Set<string>) => {
    setReadIds(next);
    if (profile) saveReadIds(profile.id, next);
  }, [profile]);

  const markOneAsRead = (id: string) => {
    if (readIds.has(id)) return;
    persistReadIds(new Set([...readIds, id]));
  };

  const markAllAsRead = () => {
    persistReadIds(new Set([...readIds, ...enabledItems.map((item) => item.id)]));
  };

  const openNotification = (item: NotificationItem) => {
    markOneAsRead(item.id);
    setOpen(false);
    navigate(item.href);
  };

  const togglePanel = () => {
    const opening = !open;
    if (opening) {
      const isDesktop = window.matchMedia('(min-width: 640px)').matches;
      setDesktop(isDesktop);
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) });
      if (preferences.notification_preferences.sound_enabled && unreadCount > lastChimedUnreadRef.current) {
        playNotificationTone();
        lastChimedUnreadRef.current = unreadCount;
      }
    }
    setOpen(opening);
  };

  useEffect(() => {
    if (unreadCount < lastChimedUnreadRef.current) lastChimedUnreadRef.current = unreadCount;
  }, [unreadCount]);

  if (!profile) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <IconButton
        label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
        size={compact ? 'sm' : 'md'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'relative rounded-xl border border-transparent hover:border-line',
          open && 'border-line bg-panel-2 text-fg',
        )}
        onClick={togglePanel}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-canvas bg-brand px-1 text-[9px] font-bold leading-none text-brand-ink tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </IconButton>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                aria-hidden
                className="ma-scrim fixed inset-0 z-[74] sm:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setOpen(false)}
              />
              <motion.section
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-label="Central de notificações"
                style={desktop && pos ? { top: pos.top, right: pos.right } : undefined}
                className={cn(
                  'ma-popover fixed z-[75] flex flex-col overflow-hidden rounded-2xl',
                  desktop
                    ? 'w-[380px] max-h-[min(620px,calc(100vh-5rem))]'
                    : 'inset-x-3 top-16 max-h-[calc(100dvh-5rem)]',
                )}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
              <div className="border-b border-line px-4 pb-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Notificações</h2>
                    <p className="mt-0.5 text-xs text-fg-3">
                      {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'aviso novo' : 'avisos novos'}` : 'Você está em dia'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      label="Atualizar notificações"
                      size="sm"
                      disabled={refreshing}
                      onClick={() => void loadNotifications(true)}
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                    </IconButton>
                    <IconButton label="Fechar notificações" size="sm" onClick={() => setOpen(false)}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div role="tablist" aria-label="Filtrar notificações" className="flex rounded-lg bg-panel-2 p-0.5">
                    {(['all', 'unread'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          activeTab === tab ? 'bg-panel text-fg shadow-sm' : 'text-fg-3 hover:text-fg-2',
                        )}
                      >
                        {tab === 'all' ? 'Todas' : `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={unreadCount === 0}
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-3 transition-colors hover:text-brand disabled:pointer-events-none disabled:opacity-40"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marcar lidas
                  </button>
                </div>
              </div>

              <div className="min-h-[210px] flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <div className="space-y-1 p-2" aria-label="Carregando notificações">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex gap-3 rounded-xl p-3">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="grid min-h-[210px] place-items-center px-8 py-10 text-center">
                    <div>
                      <RefreshCw className="mx-auto h-6 w-6 text-fg-3" />
                      <p className="mt-3 text-sm font-medium text-fg">{error}</p>
                      <button type="button" onClick={() => void loadNotifications()} className="mt-2 text-xs font-medium text-brand hover:underline">
                        Tentar novamente
                      </button>
                    </div>
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="grid min-h-[210px] place-items-center px-8 py-10 text-center">
                    <div>
                      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-panel-2 text-fg-3">
                        <Inbox className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-sm font-medium text-fg">Tudo tranquilo por aqui</p>
                      <p className="mt-1 text-xs leading-relaxed text-fg-3">{emptyMessage(profile.role, activeTab)}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="p-2">
                    {visibleItems.map((item) => {
                      const isUnread = !readIds.has(item.id);
                      const KindIcon = KIND_STYLE[item.kind].icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openNotification(item)}
                            className="group relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-panel-2"
                          >
                            {isUnread && <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand" aria-label="Não lida" />}
                            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', KIND_STYLE[item.kind].className)}>
                              <KindIcon className="h-[17px] w-[17px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-sm text-fg', isUnread ? 'font-semibold' : 'font-medium')}>
                                {item.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-fg-3">{item.description}</span>
                              {item.timestamp && <span className="mt-1 block text-[10px] font-medium text-fg-3/80">{relativeLabel(item.timestamp)}</span>}
                            </span>
                            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-fg-3 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.section>
          </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

export default NotificationBell;
