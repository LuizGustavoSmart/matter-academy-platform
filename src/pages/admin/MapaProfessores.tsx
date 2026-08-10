import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, GraduationCap, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Avatar, EmptyState, Skeleton } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';

type Professor = { id: string; email: string; nome: string | null };
type CursoTurma = { turma_id: string; curso_id: string; professor_id: string | null; data_inicio: string | null };
type Turma = { id: string; nome: string };
type Curso = { id: string; titulo: string };

type ProfessorRow = {
  professor: Professor;
  dataInicio: string | null;
  turmasAtivas: number;
  cursos: { turmaId: string; turmaNome: string; cursoTitulo: string; dataInicio: string | null; alunos: number }[];
};

function dateOnlyBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function MapaProfessores() {
  const [rows, setRows] = useState<ProfessorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // curso_turmas.professor_id/data_inicio ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: profs }, { data: cts }, { data: turmas }, { data: cursos }, { data: uts }] = await Promise.all([
        supabase.from('profiles').select('id,email,nome').eq('role', 'professor').order('nome'),
        sb.from('curso_turmas').select('turma_id,curso_id,professor_id,data_inicio'),
        supabase.from('turmas').select('id,nome'),
        supabase.from('cursos').select('id,titulo'),
        supabase.from('user_turmas').select('user_id,turma_id,curso_id'),
      ]);

      const turmaMap = new Map(((turmas ?? []) as Turma[]).map((t) => [t.id, t.nome]));
      const cursoMap = new Map(((cursos ?? []) as Curso[]).map((c) => [c.id, c.titulo]));

      const userIds = [...new Set((uts ?? []).map((r: { user_id: string }) => r.user_id))];
      const { data: allProfiles } = userIds.length
        ? await supabase.from('profiles').select('id,role').in('id', userIds)
        : { data: [] };
      const studentIds = new Set((allProfiles ?? []).filter((p) => p.role === 'student').map((p) => p.id));

      const alunosCountMap: Record<string, number> = {};
      (uts ?? []).forEach((r: { user_id: string; turma_id: string; curso_id: string | null }) => {
        if (!r.curso_id || !studentIds.has(r.user_id)) return;
        const key = `${r.turma_id}_${r.curso_id}`;
        alunosCountMap[key] = (alunosCountMap[key] ?? 0) + 1;
      });

      const result: ProfessorRow[] = ((profs ?? []) as Professor[]).map((p) => {
        const own = ((cts ?? []) as CursoTurma[]).filter((ct) => ct.professor_id === p.id);
        const datasValidas = own.map((ct) => ct.data_inicio).filter(Boolean) as string[];
        const dataInicio = datasValidas.length ? datasValidas.sort()[0] : null;
        const turmasAtivas = new Set(own.map((ct) => ct.turma_id)).size;
        const cursosDoProfessor = own.map((ct) => ({
          turmaId: ct.turma_id,
          turmaNome: turmaMap.get(ct.turma_id) ?? '—',
          cursoTitulo: cursoMap.get(ct.curso_id) ?? '—',
          dataInicio: ct.data_inicio,
          alunos: alunosCountMap[`${ct.turma_id}_${ct.curso_id}`] ?? 0,
        })).sort((a, b) => a.turmaNome.localeCompare(b.turmaNome));
        return { professor: p, dataInicio, turmasAtivas, cursos: cursosDoProfessor };
      });

      setRows(result);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Mapa de professores" subtitle="Professores alocados, turmas e cursos que estão ministrando." />

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<GraduationCap className="w-8 h-8" />} title="Nenhum professor cadastrado" description="Cadastre professores em Usuários." />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {rows.map((r) => {
              const isOpen = expanded === r.professor.id;
              return (
                <li key={r.professor.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.professor.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-panel-2/40 transition-colors text-left"
                  >
                    <Avatar name={r.professor.nome} email={r.professor.email} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm font-medium truncate">{r.professor.nome || r.professor.email}</p>
                      <p className="text-fg-3 text-xs mt-0.5 truncate">Data de início: {dateOnlyBR(r.dataInicio)}</p>
                    </div>
                    <Badge tone="outline" className="flex-shrink-0">{r.turmasAtivas} turma{r.turmasAtivas !== 1 ? 's' : ''} ativa{r.turmasAtivas !== 1 ? 's' : ''}</Badge>
                    <ChevronDown className={`w-4 h-4 text-fg-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="bg-panel-2/30 border-t border-line px-4 py-3">
                      {r.cursos.length === 0 ? (
                        <p className="text-fg-3 text-sm italic">Nenhuma turma/curso alocado para este professor.</p>
                      ) : (
                        <ul className="space-y-2">
                          {r.cursos.map((c, i) => (
                            <li key={`${c.turmaId}-${i}`} className="flex items-center gap-4 rounded-lg border border-line bg-panel p-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-fg text-sm font-medium truncate">{c.cursoTitulo}</p>
                                <Link to={`/admin/turmas/${c.turmaId}`} className="text-fg-3 text-xs hover:text-brand transition-colors truncate">{c.turmaNome}</Link>
                              </div>
                              <span className="text-fg-3 text-xs flex-shrink-0">Início: {dateOnlyBR(c.dataInicio)}</span>
                              <span className="flex items-center gap-1.5 text-fg-2 text-sm flex-shrink-0"><Users className="w-3.5 h-3.5" />{c.alunos}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
