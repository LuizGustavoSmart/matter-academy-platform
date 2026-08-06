import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, ProgressBar, Skeleton } from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';

type CourseCard = { id: string; titulo: string; descricao: string | null; total: number; done: number };

export default function AulasIndex() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      const { data: ctRows } = turmaIds.length
        ? await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds)
        : { data: [] };
      const cursoIds = [...new Set([
        ...(ut ?? []).filter((r) => r.curso_id).map((r) => r.curso_id as string),
        ...(ctRows ?? []).map((r) => r.curso_id),
      ])];

      const { data: cs } = cursoIds.length ? await supabase.from('cursos').select('id,titulo,descricao').in('id', cursoIds) : { data: [] };
      if ((cs ?? []).length > 0) {
        const ids = (cs ?? []).map((c) => c.id);
        // lessons_public é uma view não tipada no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: as } = await (supabase as any).from('lessons_public').select('id,curso_id').in('curso_id', ids);
        const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
        const doneSet = new Set((ps ?? []).map((p) => p.aula_id));
        const counts: Record<string, { total: number; done: number }> = {};
        (as ?? []).forEach((a: { id: string; curso_id: string }) => {
          if (!counts[a.curso_id]) counts[a.curso_id] = { total: 0, done: 0 };
          counts[a.curso_id].total++;
          if (doneSet.has(a.id)) counts[a.curso_id].done++;
        });
        setCourses((cs ?? []).map((c) => ({ ...c, total: counts[c.id]?.total ?? 0, done: counts[c.id]?.done ?? 0 })));
      } else {
        setCourses([]);
      }
      setLoading(false);
    };
    load();
  }, [profile]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="mb-0.5">Meus cursos</h1>
          <p className="text-fg-3 text-sm">Continue de onde parou e acompanhe seu progresso.</p>
        </div>
        <span className="text-fg-3 text-xs">{courses.length} curso(s)</span>
      </header>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      ) : courses.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Nenhum curso liberado" description="Suas turmas ainda não têm cursos vinculados." />
      ) : (
        <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="visible">
          {courses.map((c) => {
            const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <motion.div key={c.id} variants={staggerItem}>
                <Link to={`/curso/${c.id}`} className="group">
                  <Card hoverable className="p-5 h-full flex flex-col hover:border-brand/40 transition-colors">
                    <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><BookOpen className="w-5 h-5 text-brand" /></span>
                    <h3 className="mb-1.5 group-hover:text-fg transition-colors line-clamp-1">{c.titulo}</h3>
                    <p className="text-fg-3 text-sm mb-4 line-clamp-2 flex-1">{c.descricao || 'Sem descrição'}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-fg-2">{c.done}/{c.total} aulas</span><span className="text-brand font-medium">{pct}%</span></div>
                      <ProgressBar value={pct} />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
