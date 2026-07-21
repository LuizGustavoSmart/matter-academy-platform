import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users, Layers, BookOpen, PlayCircle, UserCheck, UserX, Clock, HelpCircle,
  ArrowRight, TrendingUp, GraduationCap, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, StatTile, Badge, Avatar, Skeleton, SkeletonText, EmptyState, cn } from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';
import { PageHeader } from '../../layouts/AppShell';
import { ROLE_LABEL, statusLabel, fullName } from '../../lib/users';

type RoleCount = { admin: number; student: number; professor: number; monitor: number };
type StatusCount = { active: number; pending: number; blocked: number };
type RecentUser = { id: string; email: string; nome: string | null; sobrenome: string | null; role: string; status: string; created_at: string };
type TurmaRow = { id: string; nome: string; alunos: number; cursos: number };
type Stats = { roles: RoleCount; status: StatusCount; turmas: number; cursos: number; aulas: number; duvidasAbertas: number };

const dateBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        { data: profiles }, { data: turmasList }, { data: cursosList }, { data: aulasList },
        { data: uts }, { data: cts }, { data: duvidas },
      ] = await Promise.all([
        supabase.from('profiles').select('id,email,nome,sobrenome,role,status,created_at').order('created_at', { ascending: false }),
        supabase.from('turmas').select('id,nome'),
        supabase.from('cursos').select('id'),
        supabase.from('aulas').select('id'),
        supabase.from('user_turmas').select('user_id,turma_id'),
        supabase.from('curso_turmas').select('turma_id'),
        supabase.from('community_posts').select('id').eq('tipo', 'duvida').eq('status', 'aberta'),
      ]);
      const ps = profiles ?? [];
      const roles: RoleCount = { admin: 0, student: 0, professor: 0, monitor: 0 };
      const status: StatusCount = { active: 0, pending: 0, blocked: 0 };
      ps.forEach((p) => {
        if (p.role in roles) roles[p.role as keyof RoleCount]++;
        if (p.status in status) status[p.status as keyof StatusCount]++;
      });
      setStats({
        roles, status,
        turmas: (turmasList ?? []).length, cursos: (cursosList ?? []).length,
        aulas: (aulasList ?? []).length, duvidasAbertas: (duvidas ?? []).length,
      });
      const alunosPerTurma: Record<string, number> = {};
      const cursosPerTurma: Record<string, number> = {};
      (uts ?? []).forEach((r) => { alunosPerTurma[r.turma_id] = (alunosPerTurma[r.turma_id] ?? 0) + 1; });
      (cts ?? []).forEach((r) => { cursosPerTurma[r.turma_id] = (cursosPerTurma[r.turma_id] ?? 0) + 1; });
      setTurmas((turmasList ?? []).map((t) => ({ id: t.id, nome: t.nome, alunos: alunosPerTurma[t.id] ?? 0, cursos: cursosPerTurma[t.id] ?? 0 })).slice(0, 6));
      setRecentUsers(ps.slice(0, 6) as RecentUser[]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Gestão operacional" subtitle="Visão geral da plataforma" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <div className="grid md:grid-cols-2 gap-4">{[0, 1].map((i) => <Card key={i} className="p-5"><SkeletonText lines={4} /></Card>)}</div>
      </div>
    );
  }

  const s = stats!;
  const totalUsers = s.roles.student + s.roles.professor + s.roles.monitor + s.roles.admin;
  const hasPendencias = s.status.pending > 0 || s.status.blocked > 0 || s.duvidasAbertas > 0;

  return (
    <div>
      <PageHeader title="Gestão operacional" subtitle="Visão geral da plataforma e pendências." />

      {/* Pendências */}
      {hasPendencias && (
        <div className="flex flex-wrap gap-2 mb-5">
          {s.status.pending > 0 && (
            <Link to="/admin/usuarios" className="inline-flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] px-3 py-2 text-sm text-warn hover:bg-warn/10 transition-colors">
              <Clock className="w-4 h-4" /> <span className="text-fg font-medium tabular-nums">{s.status.pending}</span> usuário(s) pendente(s) de ativação <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            </Link>
          )}
          {s.duvidasAbertas > 0 && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/[0.06] px-3 py-2 text-sm text-info">
              <HelpCircle className="w-4 h-4" /> <span className="text-fg font-medium tabular-nums">{s.duvidasAbertas}</span> dúvida(s) aberta(s)
            </span>
          )}
          {s.status.blocked > 0 && (
            <Link to="/admin/usuarios" className="inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
              <UserX className="w-4 h-4" /> <span className="text-fg font-medium tabular-nums">{s.status.blocked}</span> bloqueado(s) <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            </Link>
          )}
        </div>
      )}

      {/* Métricas */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div variants={staggerItem}><Link to="/admin/usuarios"><StatTile label="Usuários" value={totalUsers} icon={<Users className="w-4 h-4" />} hint={`${s.roles.student} alunos · ${s.roles.professor + s.roles.monitor} staff`} /></Link></motion.div>
        <motion.div variants={staggerItem}><Link to="/admin/turmas"><StatTile label="Turmas" value={s.turmas} icon={<Layers className="w-4 h-4" />} /></Link></motion.div>
        <motion.div variants={staggerItem}><Link to="/admin/cursos"><StatTile label="Cursos" value={s.cursos} icon={<BookOpen className="w-4 h-4" />} hint={`${s.aulas} aulas no total`} /></Link></motion.div>
        <motion.div variants={staggerItem}><StatTile label="Dúvidas abertas" value={s.duvidasAbertas} tone={s.duvidasAbertas > 0 ? 'warn' : 'default'} icon={<HelpCircle className="w-4 h-4" />} /></motion.div>
      </motion.div>

      {/* Status + composição */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-brand" /><h2 className="text-base">Status dos usuários</h2></div>
          <div className="space-y-3.5">
            {([
              { label: 'Ativos', value: s.status.active, tone: 'ok' as const, Icon: UserCheck },
              { label: 'Pendentes', value: s.status.pending, tone: 'warn' as const, Icon: Clock },
              { label: 'Bloqueados', value: s.status.blocked, tone: 'danger' as const, Icon: UserX },
            ]).map(({ label, value, tone, Icon }) => {
              const pct = totalUsers ? Math.round((value / totalUsers) * 100) : 0;
              const color = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-danger';
              const bar = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-danger';
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('flex items-center gap-1.5 text-sm', 'text-fg-2')}><Icon className={cn('w-3.5 h-3.5', color)} />{label}</span>
                    <span className="text-sm font-medium text-fg tabular-nums">{value}</span>
                  </div>
                  <div className="h-1.5 bg-panel-3 rounded-full overflow-hidden"><div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-brand" /><h2 className="text-base">Composição por papel</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Alunos', value: s.roles.student, cls: 'text-fg' },
              { label: 'Professores', value: s.roles.professor, cls: 'text-warn' },
              { label: 'Monitores', value: s.roles.monitor, cls: 'text-info' },
              { label: 'Admins', value: s.roles.admin, cls: 'text-brand' },
            ]).map(({ label, value, cls }) => (
              <div key={label} className="rounded-lg border border-line bg-panel-2/40 p-3">
                <p className={cn('text-xl font-display font-semibold tabular-nums', cls)}>{value}</p>
                <p className="text-fg-3 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Turmas + recentes */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-brand" /><h2 className="text-base">Situação das turmas</h2></div>
            <Link to="/admin/turmas" className="text-xs text-brand hover:underline inline-flex items-center gap-1">Ver todas <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {turmas.length === 0 ? <EmptyState title="Nenhuma turma criada" className="py-8" /> : (
            <div className="space-y-0.5">
              {turmas.map((t) => (
                <Link key={t.id} to={`/admin/turmas/${t.id}`} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-panel-2/50 transition-colors group">
                  <span className="flex items-center gap-2.5 min-w-0"><span className="w-1.5 h-1.5 rounded-full bg-brand/50 flex-shrink-0" /><span className="text-sm text-fg-2 group-hover:text-fg truncate">{t.nome}</span></span>
                  <span className="flex items-center gap-3 flex-shrink-0 ml-2 text-xs text-fg-3"><span><span className="text-fg-2">{t.alunos}</span> membros</span><span><span className="text-fg-2">{t.cursos}</span> cursos</span></span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-brand" /><h2 className="text-base">Usuários recentes</h2></div>
            <Link to="/admin/usuarios" className="text-xs text-brand hover:underline inline-flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {recentUsers.length === 0 ? <EmptyState title="Nenhum usuário cadastrado" className="py-8" /> : (
            <div className="space-y-0.5">
              {recentUsers.map((u) => {
                const name = fullName(u.nome, u.sobrenome) || u.email.split('@')[0];
                return (
                  <div key={u.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-panel-2/50 transition-colors">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={fullName(u.nome, u.sobrenome)} email={u.email} size={30} />
                      <span className="min-w-0"><span className="block text-sm text-fg truncate max-w-[170px]">{name}</span><span className="block text-fg-3 text-[11px]">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</span></span>
                    </span>
                    <span className="flex-shrink-0 ml-2 text-right">
                      <Badge tone={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warn' : 'danger'} dot>{statusLabel(u.status)}</Badge>
                      <p className="text-fg-3 text-[10px] mt-1">{dateBR(u.created_at)}</p>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Atalhos */}
      <section>
        <h2 className="text-base mb-3">Atalhos rápidos</h2>
        <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={staggerContainer} initial="hidden" animate="visible">
          {[
            { to: '/admin/usuarios', label: 'Usuários', icon: Users, desc: 'Convidar e editar' },
            { to: '/admin/turmas', label: 'Turmas', icon: Layers, desc: 'Criar e organizar' },
            { to: '/admin/cursos', label: 'Cursos', icon: BookOpen, desc: 'Conteúdo e cursos' },
            { to: '/admin/aulas', label: 'Aulas', icon: PlayCircle, desc: 'Vídeos e materiais' },
          ].map(({ to, label, icon: Icon, desc }) => (
            <motion.div key={to} variants={staggerItem}>
              <Link to={to} className="group">
                <Card hoverable className="p-4 hover:border-brand/30 transition-colors h-full">
                  <span className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><Icon className="w-4 h-4 text-brand" /></span>
                  <p className="text-sm font-medium text-fg group-hover:text-brand transition-colors">{label}</p>
                  <p className="text-fg-3 text-xs mt-0.5">{desc}</p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
