import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Accessibility, Bell, Check, ChevronRight, Eye, Globe2, ImagePlus, Languages,
  LockKeyhole, Mail, Moon, Palette, PanelLeft, ShieldCheck, Sun, Trash2, UserRound, Volume2,
} from 'lucide-react';
import { PageHeader } from '../layouts/AppShell';
import { useAuth } from '../contexts/AuthContext';
import {
  NotificationPreferences, ThemeMode, UserPreferences, usePreferences,
} from '../contexts/PreferencesContext';
import { supabase } from '../lib/supabase';
import {
  Alert, Avatar, Button, Card, Field, Input, Select, Switch, useConfirm, useToast, cn,
} from '../components/ui';
import { maSpringOut, maTransitionFast } from '../components/ui/motion';

type SectionId = 'profile' | 'language' | 'appearance' | 'notifications' | 'accessibility' | 'security' | 'privacy';
type SectionGroup = 'Conta' | 'Preferências' | 'Proteção';

const SECTIONS: Array<{ id: SectionId; group: SectionGroup; label: string; description: string; icon: typeof UserRound }> = [
  { id: 'profile', group: 'Conta', label: 'Meu perfil', description: 'Nome, foto e informações profissionais', icon: UserRound },
  { id: 'language', group: 'Conta', label: 'Idioma e região', description: 'Idioma, datas e fuso horário', icon: Languages },
  { id: 'appearance', group: 'Preferências', label: 'Aparência', description: 'Tema visual do Matter Academy', icon: Palette },
  { id: 'notifications', group: 'Preferências', label: 'Notificações', description: 'Avisos que você deseja receber', icon: Bell },
  { id: 'accessibility', group: 'Preferências', label: 'Acessibilidade', description: 'Leitura, contraste, foco e movimento', icon: Accessibility },
  { id: 'security', group: 'Proteção', label: 'Senha e segurança', description: 'Credenciais e sessões conectadas', icon: LockKeyhole },
  { id: 'privacy', group: 'Proteção', label: 'Privacidade', description: 'Visibilidade e solicitações de dados', icon: ShieldCheck },
];

const SECTION_GROUPS: SectionGroup[] = ['Conta', 'Preferências', 'Proteção'];

export default function Settings() {
  const { profile } = useAuth();
  const [active, setActive] = useState<SectionId>('profile');
  const current = SECTIONS.find((section) => section.id === active)!;
  const CurrentIcon = current.icon;
  const displayName = [profile?.nome, profile?.sobrenome].filter(Boolean).join(' ') || profile?.email?.split('@')[0] || 'Sua conta';

  return (
    <div className={cn('mx-auto max-w-[1180px]', profile?.role !== 'admin' && 'px-4 py-8 sm:px-6')}>
      <PageHeader
        title="Configurações"
        subtitle="Ajuste sua conta e deixe o Matter Academy do seu jeito."
        className="mb-5"
      />

      <Card className="min-h-[640px] overflow-hidden border-line/90 bg-panel shadow-ma-1 lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="hidden min-h-full border-r border-line bg-panel-2/45 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <Avatar
              name={displayName}
              email={profile?.email}
              src={profile?.avatar_signed_url}
              size={38}
              className="ring-2 ring-panel"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-fg">{displayName}</p>
              <p className="mt-0.5 truncate text-[11px] text-fg-3">{profile?.email}</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4" aria-label="Configurações da conta">
            {SECTION_GROUPS.map((group, groupIndex) => (
              <div key={group} className={cn(groupIndex > 0 && 'mt-5')}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-3/80">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {SECTIONS.filter((section) => section.group === group).map((section) => {
                    const Icon = section.icon;
                    const selected = section.id === active;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActive(section.id)}
                        className={cn(
                          'group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left',
                          'transition-colors duration-150 ease-ma',
                          selected ? 'text-fg' : 'text-fg-2 hover:bg-panel/65 hover:text-fg',
                        )}
                        aria-current={selected ? 'page' : undefined}
                      >
                        {selected && (
                          <motion.span
                            layoutId="settings-active-item"
                            className="absolute inset-0 rounded-lg border border-line bg-panel shadow-ma-1"
                            transition={maSpringOut}
                            aria-hidden
                          />
                        )}
                        {selected && (
                          <motion.span
                            layoutId="settings-active-rail"
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand"
                            transition={maSpringOut}
                            aria-hidden
                          />
                        )}
                        <span className={cn(
                          'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors',
                          selected ? 'bg-brand/10 text-brand' : 'text-fg-3 group-hover:text-fg-2',
                        )}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="relative z-10 min-w-0 flex-1 truncate text-[13px] font-medium">{section.label}</span>
                        <ChevronRight className={cn(
                          'relative z-10 h-3.5 w-3.5 shrink-0 transition-[opacity,transform] duration-150',
                          selected ? 'translate-x-0 text-fg-3 opacity-100' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60',
                        )} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-line px-4 py-3.5">
            <p className="text-[11px] leading-relaxed text-fg-3">Preferências vinculadas à sua conta Matter Academy.</p>
          </div>
        </aside>

        <div className="border-b border-line bg-panel-2/35 p-3 lg:hidden">
          <label htmlFor="settings-section" className="sr-only">Seção das configurações</label>
          <div className="relative">
            <Select
              id="settings-section"
              value={active}
              onChange={(event) => setActive(event.target.value as SectionId)}
              className="!bg-panel !py-2.5 text-sm font-medium"
            >
              {SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
            </Select>
          </div>
        </div>

        <section className="min-w-0 bg-panel">
          <header className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-6 lg:px-7 lg:py-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/[0.08] text-brand">
              <CurrentIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px]">{current.label}</h2>
              <p className="mt-0.5 text-xs text-fg-3 sm:text-[13px]">{current.description}</p>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={maTransitionFast}
              >
                {active === 'profile' && <ProfileSettings />}
                {active === 'language' && <LanguageSettings />}
                {active === 'appearance' && <AppearanceSettings />}
                {active === 'notifications' && <NotificationSettings />}
                {active === 'accessibility' && <AccessibilitySettings />}
                {active === 'security' && <SecuritySettings />}
                {active === 'privacy' && <PrivacySettings />}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </Card>
    </div>
  );
}

function SettingsCard({ children, footer, className = '' }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn('overflow-hidden border-line/90 bg-panel shadow-none', className)}>
      <div className="p-4 sm:p-5 lg:p-6">{children}</div>
      {footer && <div className="flex justify-end border-t border-line bg-panel-2/45 px-4 py-3.5 sm:px-5 lg:px-6">{footer}</div>}
    </Card>
  );
}

function ProfileSettings() {
  const { profile, updateProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ nome: '', sobrenome: '', telefone: '', empresa: '', cargo: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      nome: profile.nome ?? '', sobrenome: profile.sobrenome ?? '', telefone: profile.telefone ?? '',
      empresa: profile.empresa ?? '', cargo: profile.cargo ?? '',
    });
  }, [profile]);

  const preview = useMemo(() => avatarFile ? URL.createObjectURL(avatarFile) : null, [avatarFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!profile) return null;

  const pickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 2 MB.');
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim()) {
      toast.error('Informe o nome que será exibido.');
      return;
    }
    setSaving(true);
    let nextAvatarPath = removeAvatar ? null : profile.avatar_url;
    try {
      if (avatarFile) {
        const ext = avatarFile.type === 'image/png' ? 'png' : avatarFile.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (error) throw error;
        nextAvatarPath = path;
      }
      await updateProfile({
        nome: form.nome.trim(), sobrenome: form.sobrenome.trim() || null,
        telefone: form.telefone.trim() || null, empresa: form.empresa.trim() || null,
        cargo: form.cargo.trim() || null, avatar_url: nextAvatarPath,
      });
      if ((avatarFile || removeAvatar) && profile.avatar_url && profile.avatar_url !== nextAvatarPath) {
        await supabase.storage.from('avatars').remove([profile.avatar_url]);
      }
      setAvatarFile(null);
      setRemoveAvatar(false);
      toast.success('Perfil atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <form onSubmit={save}>
      <SettingsCard footer={<Button type="submit" variant="primary" loading={saving}>Salvar alterações</Button>}>
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-panel-2/40 p-4 sm:flex-row sm:items-center sm:p-5">
          <Avatar
            name={`${form.nome} ${form.sobrenome}`}
            email={profile.email}
            src={removeAvatar ? null : preview ?? profile.avatar_signed_url}
            size={72}
            className="ring-4 ring-panel"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-3">
              <h3 className="text-sm">Foto de perfil</h3>
              <p className="mt-1 text-xs text-fg-3">Use uma imagem que ajude colegas e professores a reconhecer você.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                {profile.avatar_url || avatarFile ? 'Trocar foto' : 'Enviar foto'}
              </Button>
              {(profile.avatar_url || avatarFile) && !removeAvatar && (
                <Button type="button" size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => { setAvatarFile(null); setRemoveAvatar(true); }}>
                  Remover
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-fg-3">JPG, PNG ou WebP · máximo de 2 MB.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickAvatar} />
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm">Informações do perfil</h3>
          <p className="mt-1 text-xs text-fg-3">Estes dados formam sua identidade dentro da plataforma.</p>
        </div>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Nome de exibição" required><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} maxLength={80} /></Field>
          <Field label="Sobrenome"><Input value={form.sobrenome} onChange={(e) => update('sobrenome', e.target.value)} maxLength={80} /></Field>
          <Field label="Telefone" hint="Visível somente para você e administradores autorizados."><Input type="tel" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(11) 99999-9999" /></Field>
          <Field label="Empresa"><Input value={form.empresa} onChange={(e) => update('empresa', e.target.value)} placeholder="Empresa ou instituição" maxLength={120} /></Field>
          <Field label="Cargo ou função" className="sm:col-span-2"><Input value={form.cargo} onChange={(e) => update('cargo', e.target.value)} placeholder="Ex.: Professora, Analista, Estudante" maxLength={120} /></Field>
          <Field label="E-mail" hint="O e-mail de acesso não pode ser alterado por esta tela." className="sm:col-span-2"><Input value={profile.email} disabled /></Field>
        </div>
      </SettingsCard>
    </form>
  );
}

function LanguageSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const [draft, setDraft] = useState({ language: preferences.language, timezone: preferences.timezone });
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft({ language: preferences.language, timezone: preferences.timezone }), [preferences.language, preferences.timezone]);

  const save = async () => {
    setSaving(true);
    try { await updatePreferences(draft); toast.success('Idioma e região atualizados.'); }
    catch { toast.error('Não foi possível salvar as preferências.'); }
    finally { setSaving(false); }
  };

  return (
    <SettingsCard footer={<Button variant="primary" loading={saving} onClick={save}>Salvar preferências</Button>}>
      <div className="mb-5">
        <h3 className="text-sm">Localização</h3>
        <p className="mt-1 text-xs text-fg-3">Datas e horários seguem estas preferências.</p>
      </div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Idioma"><Select value={draft.language} onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}><option value="pt-BR">Português (Brasil)</option></Select></Field>
        <Field label="Fuso horário"><Select value={draft.timezone} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}><option value="America/Sao_Paulo">Brasília (GMT-3)</option><option value="America/Manaus">Manaus (GMT-4)</option><option value="America/Rio_Branco">Rio Branco (GMT-5)</option></Select></Field>
      </div>
      <Alert className="mt-5" title="Idioma da plataforma">A interface está disponível em português. Novos idiomas poderão usar esta mesma preferência.</Alert>
    </SettingsCard>
  );
}

const THEMES: Array<{ id: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Claro', description: 'Superfícies claras e contraste suave para ambientes iluminados.', icon: Sun },
  { id: 'dark', label: 'Escuro', description: 'Grafite profundo com o verde Matter em destaque.', icon: Moon },
  { id: 'hybrid', label: 'Híbrido', description: 'Menu escuro para orientação e área de trabalho clara.', icon: PanelLeft },
];

function AppearanceSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const choose = async (theme: ThemeMode) => {
    try { await updatePreferences({ theme }); toast.success(`Tema ${THEMES.find((item) => item.id === theme)?.label.toLowerCase()} aplicado.`); }
    catch { toast.error('Não foi possível salvar o tema.'); }
  };
  return (
    <SettingsCard>
      <div className="mb-5">
        <h3 className="text-sm">Tema da interface</h3>
        <p className="mt-1 text-xs text-fg-3">A mudança é aplicada na hora e fica salva neste dispositivo.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {THEMES.map((theme) => {
          const Icon = theme.icon;
          const selected = preferences.theme === theme.id;
          return (
            <motion.button
              key={theme.id}
              type="button"
              onClick={() => choose(theme.id)}
              className={cn(
                'group relative rounded-xl border p-2 text-left outline-none',
                'transition-[border-color,background-color,box-shadow] duration-150 ease-ma',
                selected
                  ? 'border-brand bg-brand/[0.035] shadow-[0_0_0_2px_rgb(var(--ma-brand-rgb)/0.14)]'
                  : 'border-line bg-panel hover:border-line-strong hover:bg-panel-2/25',
              )}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={maSpringOut}
              aria-pressed={selected}
              aria-label={`Usar tema ${theme.label}`}
            >
              <ThemePreview mode={theme.id} />
              <div className="flex items-start gap-2.5 px-1.5 pb-1.5 pt-2">
                <span className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors',
                  selected ? 'border-brand/20 bg-brand/10 text-brand' : 'border-line bg-panel-2 text-fg-3 group-hover:text-fg-2',
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-fg">{theme.label}</span>
                    <span className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
                      selected ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-panel',
                    )}>
                      {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-fg-3">{theme.description}</span>
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  return (
    <div data-theme-preview={mode} className="ma-theme-preview h-24 overflow-hidden rounded-lg border border-line bg-panel-2 p-1.5" aria-hidden>
      <div className={cn(
        'flex h-full overflow-hidden rounded-[6px] border border-line/80',
        mode === 'dark' ? 'bg-canvas' : 'bg-panel',
      )}>
        <div className={cn(
          'ma-theme-preview-sidebar w-[27%] shrink-0 border-r border-line/80 px-1.5 py-2',
          mode === 'light' ? 'bg-panel-2' : 'bg-canvas',
        )}>
          <span className="mb-2 block h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="mb-1 block h-1 w-full rounded-full bg-fg-3/25" />
          <span className="mb-1 block h-1 w-4/5 rounded-full bg-fg-3/20" />
          <span className="block h-1 w-3/5 rounded-full bg-fg-3/20" />
        </div>
        <div className={cn('ma-theme-preview-content min-w-0 flex-1 p-2', mode === 'dark' ? 'bg-canvas' : 'bg-panel')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="block h-1.5 w-2/5 rounded-full bg-fg-2/45" />
            <span className="block h-2 w-2 rounded-full bg-brand" />
          </div>
          <div className={cn(
            'h-[42px] rounded-md border border-line/80 p-2',
            mode === 'dark' ? 'bg-panel' : 'bg-panel-2/65',
          )}>
            <span className="mb-1.5 block h-1.5 w-3/5 rounded-full bg-fg-3/30" />
            <span className="mb-1 block h-1 w-full rounded-full bg-fg-3/20" />
            <span className="block h-1 w-4/5 rounded-full bg-fg-3/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATIONS: Array<{ key: keyof NotificationPreferences; title: string; description: string }> = [
  { key: 'activities', title: 'Atividades', description: 'Novas atividades, correções e devolutivas.' },
  { key: 'deadlines', title: 'Prazos', description: 'Lembretes de entregas e datas importantes.' },
  { key: 'answers', title: 'Respostas', description: 'Respostas em dúvidas e conversas acompanhadas.' },
  { key: 'announcements', title: 'Comunicados', description: 'Avisos de professores e da instituição.' },
  { key: 'community', title: 'Comunidade', description: 'Interações relevantes nas suas turmas.' },
  { key: 'administrative', title: 'Administração', description: 'Alterações de acesso, matrícula e segurança.' },
];

function NotificationSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const [draft, setDraft] = useState(preferences.notification_preferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(preferences.notification_preferences), [preferences.notification_preferences]);
  const save = async () => {
    setSaving(true);
    try { await updatePreferences({ notification_preferences: draft }); toast.success('Preferências de notificação atualizadas.'); }
    catch { toast.error('Não foi possível salvar as preferências.'); }
    finally { setSaving(false); }
  };
  return (
    <SettingsCard footer={<Button variant="primary" loading={saving} onClick={save}>Salvar preferências</Button>}>
      <div className="mb-4">
        <h3 className="text-sm">Avisos na plataforma</h3>
        <p className="mt-1 text-xs text-fg-3">Escolha quais atualizações merecem chamar sua atenção.</p>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2/35 p-3.5 transition-colors hover:border-line-strong">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-panel text-fg-2"><Mail className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-fg">Receber por e-mail</span><span className="mt-0.5 block text-[11px] leading-relaxed text-fg-3">Envia uma cópia para o e-mail da conta.</span></span>
          <Switch ariaLabel="Receber notificações por e-mail" checked={draft.email_enabled} onChange={(checked) => setDraft((current) => ({ ...current, email_enabled: checked }))} />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2/35 p-3.5 transition-colors hover:border-line-strong">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-panel text-fg-2"><Volume2 className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-fg">Som de novos avisos</span><span className="mt-0.5 block text-[11px] leading-relaxed text-fg-3">Usa um toque curto ao abrir novos avisos.</span></span>
          <Switch ariaLabel="Tocar som para novos avisos" checked={draft.sound_enabled} onChange={(checked) => setDraft((current) => ({ ...current, sound_enabled: checked }))} />
        </div>
      </div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-3/80">Tipos de aviso</p>
      <div className="divide-y divide-line">
        {NOTIFICATIONS.map((item) => <PreferenceRow key={item.key} title={item.title} description={item.description}><Switch ariaLabel={`Receber avisos de ${item.title.toLowerCase()}`} checked={draft[item.key]} onChange={(checked) => setDraft((current) => ({ ...current, [item.key]: checked }))} /></PreferenceRow>)}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-panel-2/35 px-3.5 py-3">
        <p className="text-[11px] leading-relaxed text-fg-3">Os mesmos filtros são respeitados pela central da plataforma e pelos e-mails.</p>
      </div>
    </SettingsCard>
  );
}

function AccessibilitySettings() {
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(preferences), [preferences]);
  const save = async () => {
    setSaving(true);
    const patch: Partial<UserPreferences> = { font_scale: draft.font_scale, high_contrast: draft.high_contrast, reduced_motion: draft.reduced_motion, focus_emphasis: draft.focus_emphasis };
    try { await updatePreferences(patch); toast.success('Preferências de acessibilidade atualizadas.'); }
    catch { toast.error('Não foi possível salvar as preferências.'); }
    finally { setSaving(false); }
  };
  return (
    <SettingsCard footer={<Button variant="primary" loading={saving} onClick={save}>Salvar preferências</Button>}>
      <div className="mb-5">
        <h3 className="text-sm">Leitura e navegação</h3>
        <p className="mt-1 text-xs text-fg-3">Ajustes pessoais para uma experiência mais confortável.</p>
      </div>
      <Field label="Tamanho do texto" className="mb-2 max-w-sm"><Select value={draft.font_scale} onChange={(e) => setDraft((current) => ({ ...current, font_scale: e.target.value as UserPreferences['font_scale'] }))}><option value="default">Padrão</option><option value="large">Ampliado</option></Select></Field>
      <div className="divide-y divide-line">
        <PreferenceRow title="Contraste reforçado" description="Realça textos, bordas e controles importantes."><Switch ariaLabel="Ativar contraste reforçado" checked={draft.high_contrast} onChange={(v) => setDraft((p) => ({ ...p, high_contrast: v }))} /></PreferenceRow>
        <PreferenceRow title="Reduzir movimento" description="Minimiza animações e transições da interface."><Switch ariaLabel="Reduzir movimento" checked={draft.reduced_motion} onChange={(v) => setDraft((p) => ({ ...p, reduced_motion: v }))} /></PreferenceRow>
        <PreferenceRow title="Foco de teclado destacado" description="Mostra um contorno mais forte durante a navegação por teclado."><Switch ariaLabel="Destacar foco de teclado" checked={draft.focus_emphasis} onChange={(v) => setDraft((p) => ({ ...p, focus_emphasis: v }))} /></PreferenceRow>
      </div>
    </SettingsCard>
  );
}

function SecuritySettings() {
  const { session } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { toast.error('A nova senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { toast.error('As senhas não coincidem.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) toast.error(error.message); else { setPassword(''); setConfirmPassword(''); toast.success('Senha atualizada com segurança.'); }
  };
  const signOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) toast.error(error.message); else toast.success('Outras sessões foram encerradas.');
  };
  return (
    <div className="space-y-4">
      <form onSubmit={changePassword}>
        <SettingsCard footer={<Button type="submit" variant="primary" loading={saving}>Alterar senha</Button>}>
          <div className="mb-5">
            <h3 className="text-sm">Nova senha</h3>
            <p className="mt-1 text-xs text-fg-3">Use uma combinação exclusiva para esta conta.</p>
          </div>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field label="Nova senha" required hint="Use pelo menos 8 caracteres."><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Confirmar nova senha" required><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field>
          </div>
          {session?.user.updated_at && <p className="mt-5 text-[11px] text-fg-3">Última atualização das credenciais: {new Date(session.user.updated_at).toLocaleString('pt-BR')}</p>}
        </SettingsCard>
      </form>
      <SettingsCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm">Sessões conectadas</h3>
            <p className="mt-1 text-xs text-fg-3">Encerre o acesso em outros navegadores e dispositivos.</p>
          </div>
          <Button onClick={signOutOthers}>Encerrar outras sessões</Button>
        </div>
      </SettingsCard>
    </div>
  );
}

function PrivacySettings() {
  const { profile } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(preferences.privacy_preferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(preferences.privacy_preferences), [preferences.privacy_preferences]);
  const save = async () => {
    setSaving(true);
    try { await updatePreferences({ privacy_preferences: draft }); toast.success('Preferências de privacidade atualizadas.'); }
    catch { toast.error('Não foi possível salvar as preferências.'); }
    finally { setSaving(false); }
  };
  const request = async (requestType: 'export' | 'deletion') => {
    if (!profile) return;
    if (requestType === 'deletion') {
      const ok = await confirm({ title: 'Solicitar exclusão da conta?', message: 'A solicitação será analisada pela administração antes da remoção definitiva.', confirmLabel: 'Solicitar exclusão', tone: 'danger', requireText: 'EXCLUIR' });
      if (!ok) return;
    }
    const { error } = await supabase.from('privacy_requests').insert({ user_id: profile.id, request_type: requestType });
    if (error) toast.error(error.message); else toast.success(requestType === 'export' ? 'Solicitação de exportação registrada.' : 'Solicitação de exclusão registrada.');
  };
  return (
    <div className="space-y-4">
      <SettingsCard footer={<Button variant="primary" loading={saving} onClick={save}>Salvar preferências</Button>}>
        <div className="mb-2 flex items-start gap-3 rounded-xl border border-line bg-panel-2/40 p-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand/[0.08] text-brand">
            <Eye className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Perfil básico visível</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-3">Nome e foto podem aparecer para participantes das suas turmas. Telefone e e-mail permanecem privados.</p>
          </div>
        </div>
        <div className="divide-y divide-line">
          <PreferenceRow title="Permitir perfil na turma" description="Exibe seu perfil básico a colegas e equipe pedagógica."><Switch ariaLabel="Permitir perfil na turma" checked={draft.profile_visible} onChange={(v) => setDraft((p) => ({ ...p, profile_visible: v }))} /></PreferenceRow>
          <PreferenceRow title="Mostrar empresa" description="Inclui sua empresa ou instituição no perfil básico."><Switch ariaLabel="Mostrar empresa no perfil" checked={draft.show_company} disabled={!draft.profile_visible} onChange={(v) => setDraft((p) => ({ ...p, show_company: v }))} /></PreferenceRow>
          <PreferenceRow title="Mostrar cargo ou função" description="Inclui sua função profissional no perfil básico."><Switch ariaLabel="Mostrar cargo ou função no perfil" checked={draft.show_role} disabled={!draft.profile_visible} onChange={(v) => setDraft((p) => ({ ...p, show_role: v }))} /></PreferenceRow>
        </div>
      </SettingsCard>
      <SettingsCard>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm">Exportar meus dados</h3>
              <p className="mt-1 text-xs text-fg-3">Solicite uma cópia das informações associadas à sua conta.</p>
            </div>
            <Button icon={<Globe2 className="h-4 w-4" />} onClick={() => request('export')}>Solicitar exportação</Button>
          </div>
          <div className="border-t border-line pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm">Excluir minha conta</h3>
                <p className="mt-1 text-xs text-fg-3">Envia uma solicitação para revisão administrativa.</p>
              </div>
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => request('deletion')}>Solicitar exclusão</Button>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

function PreferenceRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 px-1 py-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
