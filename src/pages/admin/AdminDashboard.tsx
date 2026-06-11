import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Layers, BookOpen, PlayCircle,
  UserCheck, UserX, Clock, HelpCircle,
  ArrowRight, TrendingUp, GraduationCap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui';

/* ── Tipos ─────────────────────────────────────────────────────── */
type RoleCount = { admin: number; student: number; professor: number; monitor: number };
type StatusCount = { active: number; pending: number; blocked: number };
type RecentUser = { id: string; email: string; role: string; status: string; created_at: string };
type TurmaRow  = { id: string; nome: string; alunos: number; cursos: number };

type Stats = {
  roles: RoleCount;
  status: StatusCount;
  turmas: number;
  cursos: number;
  aulas: number;
  duvidasAbertas: number;
};

/* ── Helpers ────────────────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  student: 'Aluno', professor: 'Professor', monitor: 'Monitor', admin: 'Admin',
};

function dateBR(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/* ══════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [turmas,      setTurmas]      = useState<TurmaRow[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        { data: profiles },
        { data: turmasList },
        { data: cursosList },
        { data: aulasList },
        { data: uts },
        { data: cts },
        { data: duvidas },
      ] = await Promise.all([
        supabase.from('profiles').select('id,email,role,status,created_at').order('created_at', { ascending: false }),
        supabase.from('turmas').select('id,nome'),
        supabase.from('cursos').select('id'),
        supabase.from('aulas').select('id'),
        supabase.from('user_turmas').select('user_id,turma_id'),
        supabase.from('curso_turmas').select('turma_id'),
        supabase.from('community_posts').select('id').eq('tipo', 'duvida').eq('status', 'aberta'),
      ]);

      const ps = profiles ?? [];

      /* Contagem por papel */
      const roles: RoleCount = { admin: 0, student: 0, professor: 0, monitor: 0 };
      const status: StatusCount = { active: 0, pending: 0, blocked: 0 };
      ps.forEach((p: any) => {
        if (p.role in roles) (roles as any)[p.role]++;
        if (p.status in status) (status as any)[p.status]++;
      });

      setStats({
        roles,
        status,
        turmas:         (turmasList ?? []).length,
        cursos:         (cursosList  ?? []).length,
        aulas:          (aulasList   ?? []).length,
        duvidasAbertas: (duvidas     ?? []).length,
      });

      /* Turmas com contagem de membros e cursos */
      const alunosPerTurma: Record<string, number> = {};
      const cursosPerTurma: Record<string, number> = {};
      (uts ?? []).forEach((r: any) => { alunosPerTurma[r.turma_id] = (alunosPerTurma[r.turma_id] ?? 0) + 1; });
      (cts ?? []).forEach((r: any) => { cursosPerTurma[r.turma_id] = (cursosPerTurma[r.turma_id] ?? 0) + 1; });
      setTurmas(
        (turmasList ?? []).map((t: any) => ({
          id: t.id, nome: t.nome,
          alunos: alunosPerTurma[t.id] ?? 0,
          cursos: cursosPerTurma[t.id] ?? 0,
        })).slice(0, 5),
      );

      /* Últimos 6 usuários */
      setRecentUsers(ps.slice(0, 6) as RecentUser[]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="mb-6">Gestão Operacional</h1>
        <p className="meta">Carregando...</p>
      </div>
    );
  }

  const s = stats!;
  const totalUsers = s.roles.student + s.roles.professor + s.roles.monitor + s.roles.admin;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="mb-1">Gestão Operacional</h1>
        <p className="meta">Visão geral da plataforma</p>
      </div>

      {/* ── Métricas principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Usuários */}
        <Link to="/admin/usuarios">
          <div className="bg-[#0d0d0d] border border-[#1c1f26] hover:border-[#434d5e] rounded-lg p-4 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center">
                <Users className="w-4 h-4 text-[#cbfb00]" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#434d5e] group-hover:text-[#cbfb00] transition-colors" />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{totalUsers}</p>
            <p className="text-xs text-[#8b929e] uppercase tracking-wider">Usuários</p>
            <div className="mt-2 flex gap-2 flex-wrap">
              <span className="text-[10px] text-[#d6deed]">{s.roles.student} alunos</span>
              <span className="text-[10px] text-[#8b929e]">·</span>
              <span className="text-[10px] text-[#d6deed]">{s.roles.professor + s.roles.monitor} staff</span>
            </div>
          </div>
        </Link>

        {/* Turmas */}
        <Link to="/admin/turmas">
          <div className="bg-[#0d0d0d] border border-[#1c1f26] hover:border-[#434d5e] rounded-lg p-4 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center">
                <Layers className="w-4 h-4 text-[#cbfb00]" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#434d5e] group-hover:text-[#cbfb00] transition-colors" />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{s.turmas}</p>
            <p className="text-xs text-[#8b929e] uppercase tracking-wider">Turmas</p>
          </div>
        </Link>

        {/* Cursos */}
        <Link to="/admin/cursos">
          <div className="bg-[#0d0d0d] border border-[#1c1f26] hover:border-[#434d5e] rounded-lg p-4 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center">
                <BookOpen className="w-4 h-4 text-[#cbfb00]" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#434d5e] group-hover:text-[#cbfb00] transition-colors" />
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{s.cursos}</p>
            <p className="text-xs text-[#8b929e] uppercase tracking-wider">Cursos</p>
            <p className="mt-2 text-[10px] text-[#d6deed]">{s.aulas} aulas no total</p>
          </div>
        </Link>

        {/* Dúvidas abertas */}
        <div className={`border rounded-lg p-4 transition-colors ${
          s.duvidasAbertas > 0
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-[#0d0d0d] border-[#1c1f26]'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-8 h-8 rounded-md grid place-items-center ${
              s.duvidasAbertas > 0
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-[#cbfb00]/10 border border-[#cbfb00]/20'
            }`}>
              <HelpCircle className={`w-4 h-4 ${s.duvidasAbertas > 0 ? 'text-amber-400' : 'text-[#cbfb00]'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold mb-0.5 ${s.duvidasAbertas > 0 ? 'text-amber-400' : 'text-white'}`}>
            {s.duvidasAbertas}
          </p>
          <p className={`text-xs uppercase tracking-wider ${s.duvidasAbertas > 0 ? 'text-amber-400/70' : 'text-[#8b929e]'}`}>
            Dúvidas abertas
          </p>
        </div>
      </div>

      {/* ── Status dos usuários + Staff ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Status */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#cbfb00]" />
            <h3 className="!mb-0 text-base">Status dos usuários</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Ativos',     value: s.status.active,  color: '#cbfb00', icon: UserCheck },
              { label: 'Pendentes',  value: s.status.pending, color: '#f59e0b', icon: Clock },
              { label: 'Bloqueados', value: s.status.blocked, color: '#f87171', icon: UserX },
            ].map(({ label, value, color, icon: Icon }) => {
              const pct = totalUsers ? Math.round((value / totalUsers) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-sm text-[#d6deed]">{label}</span>
                    </div>
                    <span className="text-sm font-medium text-white">{value}</span>
                  </div>
                  <div className="h-1.5 bg-[#1c1f26] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Staff breakdown */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4 text-[#cbfb00]" />
            <h3 className="!mb-0 text-base">Composição por papel</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Alunos',      value: s.roles.student,   color: 'text-white',        bg: 'bg-[#1c1f26]' },
              { label: 'Professores', value: s.roles.professor, color: 'text-yellow-400',   bg: 'bg-yellow-400/10' },
              { label: 'Monitores',   value: s.roles.monitor,   color: 'text-purple-400',   bg: 'bg-purple-400/10' },
              { label: 'Admins',      value: s.roles.admin,     color: 'text-[#cbfb00]',    bg: 'bg-[#cbfb00]/10' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-lg p-3`}>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-[#8b929e] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Turmas + Usuários recentes ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Turmas */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#cbfb00]" />
              <h3 className="!mb-0 text-base">Turmas</h3>
            </div>
            <Link to="/admin/turmas" className="text-xs text-[#cbfb00] hover:underline inline-flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {turmas.length === 0 ? (
            <p className="meta text-sm">Nenhuma turma criada</p>
          ) : (
            <div className="space-y-2">
              {turmas.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/turmas/${t.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[#111] transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#cbfb00]/40 flex-shrink-0" />
                    <span className="text-sm text-[#d6deed] group-hover:text-white transition-colors truncate">
                      {t.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-xs text-[#434d5e]">
                      <span className="text-[#8b929e]">{t.alunos}</span> membros
                    </span>
                    <span className="text-xs text-[#434d5e]">
                      <span className="text-[#8b929e]">{t.cursos}</span> cursos
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Usuários recentes */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#cbfb00]" />
              <h3 className="!mb-0 text-base">Usuários recentes</h3>
            </div>
            <Link to="/admin/usuarios" className="text-xs text-[#cbfb00] hover:underline inline-flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="meta text-sm">Nenhum usuário cadastrado</p>
          ) : (
            <div className="space-y-1">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[#111] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#1c1f26] grid place-items-center flex-shrink-0">
                      <span className="text-[10px] text-[#d6deed] font-bold">
                        {u.email.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate max-w-[160px]">{u.email}</p>
                      <p className="text-[10px] text-[#434d5e]">{ROLE_LABEL[u.role] ?? u.role}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2 text-right">
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      u.status === 'active'  ? 'bg-[#cbfb00]/10 text-[#cbfb00]' :
                      u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                               'bg-red-500/10 text-red-400'
                    }`}>
                      {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                    </span>
                    <p className="text-[10px] text-[#434d5e] mt-0.5">{dateBR(u.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Atalhos rápidos ── */}
      <div>
        <h3 className="mb-3">Atalhos rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/admin/usuarios', label: 'Gerenciar Usuários',  icon: Users,      desc: 'Convidar e editar' },
            { to: '/admin/turmas',   label: 'Gerenciar Turmas',    icon: Layers,     desc: 'Criar e organizar' },
            { to: '/admin/cursos',   label: 'Gerenciar Cursos',    icon: BookOpen,   desc: 'Conteúdo e cursos' },
            { to: '/admin/aulas',    label: 'Gerenciar Aulas',     icon: PlayCircle, desc: 'Vídeos e materiais' },
          ].map(({ to, label, icon: Icon, desc }) => (
            <Link key={to} to={to}>
              <div className="bg-[#0d0d0d] border border-[#1c1f26] hover:border-[#cbfb00]/30 rounded-lg p-4 transition-colors group">
                <div className="w-8 h-8 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center mb-3">
                  <Icon className="w-4 h-4 text-[#cbfb00]" />
                </div>
                <p className="text-sm font-medium text-white group-hover:text-[#cbfb00] transition-colors">{label}</p>
                <p className="text-xs text-[#434d5e] mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
