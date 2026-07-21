import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Avatar, EmptyState, Skeleton } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';

type StaffRole = 'professor' | 'monitor';
type Staff = { id: string; email: string; nome: string | null; role: StaffRole };
type TurmaRow = { id: string; nome: string; staff: Staff[] };

const ROLE_LABEL: Record<StaffRole, string> = { professor: 'Professor', monitor: 'Monitor' };
const ROLE_TONE: Record<StaffRole, 'warn' | 'info'> = { professor: 'warn', monitor: 'info' };

export default function MapaProfessores() {
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: uts }] = await Promise.all([
        supabase.from('turmas').select('id,nome').order('nome'),
        supabase.from('user_turmas').select('turma_id,user_id'),
      ]);
      const userIds = [...new Set((uts ?? []).map((r) => r.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id,email,nome,role').in('id', userIds).in('role', ['professor', 'monitor'])
        : { data: [] };
      const staffMap = new Map((profiles ?? []).map((p) => [p.id, p as Staff]));
      const byTurma: Record<string, Staff[]> = {};
      (uts ?? []).forEach((r) => { const s = staffMap.get(r.user_id); if (s) (byTurma[r.turma_id] ??= []).push(s); });
      const rows: TurmaRow[] = (ts ?? []).map((t) => ({
        id: t.id, nome: t.nome,
        staff: [...new Map((byTurma[t.id] ?? []).map((s) => [s.id, s])).values()].sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email)),
      }));
      setTurmas(rows);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Mapa de professores" subtitle="Professores e monitores alocados em cada turma." />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : turmas.length === 0 ? (
        <EmptyState icon={<GraduationCap className="w-8 h-8" />} title="Nenhuma turma criada" description="Crie turmas e aloque professores ou monitores." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <Link to={`/admin/turmas/${t.id}`} className="text-fg font-medium hover:text-brand transition-colors truncate">{t.nome}</Link>
                <Badge tone="outline" className="flex-shrink-0">{t.staff.length} alocado{t.staff.length !== 1 ? 's' : ''}</Badge>
              </div>
              {t.staff.length === 0 ? (
                <p className="text-fg-3 text-sm italic">Nenhum professor ou monitor alocado.</p>
              ) : (
                <div className="space-y-2.5">
                  {t.staff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={s.nome} email={s.email} size={28} />
                        <span className="text-sm text-fg-2 truncate">{s.nome || s.email}</span>
                      </span>
                      <Badge tone={ROLE_TONE[s.role]} dot>{ROLE_LABEL[s.role]}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
