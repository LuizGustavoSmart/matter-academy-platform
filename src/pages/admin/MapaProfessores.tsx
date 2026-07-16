import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Empty } from '../../components/ui';

type StaffRole = 'professor' | 'monitor';
type Staff = { id: string; email: string; nome: string | null; role: StaffRole };
type TurmaRow = { id: string; nome: string; staff: Staff[] };

const ROLE_LABEL: Record<StaffRole, string> = { professor: 'Professor', monitor: 'Monitor' };
const ROLE_TONE: Record<StaffRole, 'warn' | 'success'> = { professor: 'warn', monitor: 'success' };

export default function MapaProfessores() {
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: uts }] = await Promise.all([
        supabase.from('turmas').select('id,nome').order('nome'),
        supabase.from('user_turmas').select('turma_id,user_id'),
      ]);

      const userIds = [...new Set((uts ?? []).map((r: any) => r.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id,email,nome,role').in('id', userIds).in('role', ['professor', 'monitor'])
        : { data: [] };
      const staffMap = new Map((profiles ?? []).map((p: any) => [p.id, p as Staff]));

      const byTurma: Record<string, Staff[]> = {};
      (uts ?? []).forEach((r: any) => {
        const s = staffMap.get(r.user_id);
        if (!s) return;
        (byTurma[r.turma_id] ??= []).push(s);
      });

      const rows: TurmaRow[] = (ts ?? []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        staff: [...new Map((byTurma[t.id] ?? []).map((s) => [s.id, s])).values()]
          .sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email)),
      }));

      setTurmas(rows);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1>Mapa de Professores</h1>
        <p className="meta mt-1">Professores e monitores alocados em cada turma</p>
      </div>

      {loading ? <p className="meta">Carregando...</p> : turmas.length === 0 ? (
        <Empty icon={<GraduationCap className="w-8 h-8" />} title="Nenhuma turma criada" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <Link to={`/admin/turmas/${t.id}`} className="text-white font-medium hover:text-[#cbfb00] transition-colors truncate">
                  {t.nome}
                </Link>
                <Badge className="flex-shrink-0">{t.staff.length} alocado{t.staff.length !== 1 ? 's' : ''}</Badge>
              </div>
              {t.staff.length === 0 ? (
                <p className="text-[#434d5e] text-sm italic">Nenhum professor ou monitor alocado</p>
              ) : (
                <div className="space-y-2">
                  {t.staff.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[#d6deed] truncate">{s.nome || s.email}</span>
                      <Badge tone={ROLE_TONE[s.role]}>{ROLE_LABEL[s.role]}</Badge>
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
