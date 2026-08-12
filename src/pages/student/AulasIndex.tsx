import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton, cn } from '../../components/ui';
import { staggerContainer, staggerItem } from '../../components/ui/motion';
import { SignedImage } from '../../components/SignedImage';
import { ordemDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type CourseCard = { id: string; titulo: string; descricao: string | null; total: number; done: number; capaUrl: string | null; faixa: string | null; matriculado: boolean };
const AULAS_POR_FAIXA = 12;

export default function AulasIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
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
      const enrolledCursoIds = new Set((ut ?? []).filter((r) => r.curso_id).map((r) => r.curso_id as string));
      const cursoIds = [...new Set([...enrolledCursoIds, ...(ctRows ?? []).map((r) => r.curso_id)])];

      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cs } = cursoIds.length ? await (supabase as any).from('cursos').select('id,titulo,descricao,capa_url,faixa').in('id', cursoIds) : { data: [] };
      if ((cs ?? []).length > 0) {
        const ids = (cs ?? []).map((c: { id: string }) => c.id);
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
        setCourses((cs ?? [])
          .map((c: { id: string; titulo: string; descricao: string | null; capa_url: string | null; faixa: string | null }) => ({
            ...c, capaUrl: c.capa_url, total: counts[c.id]?.total ?? 0, done: counts[c.id]?.done ?? 0, matriculado: enrolledCursoIds.has(c.id),
          }))
          .sort((a: CourseCard, b: CourseCard) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa)));
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
            const total = Math.max(AULAS_POR_FAIXA, c.total);
            const pct = total ? Math.round((c.done / total) * 100) : 0;
            const capa = resolveCapaUrl(c.capaUrl, c.faixa, faixaCapas);
            const CardInner = (
              <Card hoverable={c.matriculado} className={cn('p-0 overflow-hidden transition-colors', c.matriculado && 'hover:border-brand/40')}>
                <div className="relative h-44">
                  {capa ? (
                    <>
                      <SignedImage bucket="capas" path={capa} className={cn('absolute inset-0 w-full h-full object-cover', !c.matriculado && 'grayscale opacity-40')} alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-brand/10 grid place-items-center"><BookOpen className="w-8 h-8 text-brand" /></div>
                  )}
                  {c.matriculado ? (
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-2">
                      <div className="flex justify-between text-xs"><span className="text-white/85">{c.done}/{total} aulas</span><span className="text-white font-medium">{pct}%</span></div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4 text-white/80" /><span className="text-white/90 text-xs font-semibold uppercase tracking-wider">Bloqueada</span>
                    </div>
                  )}
                  {c.matriculado && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                      <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="p-4 pt-3">
                  <h3 className="mb-1 group-hover:text-fg transition-colors line-clamp-1">{c.titulo}</h3>
                  <p className="text-fg-3 text-sm line-clamp-1">{c.descricao || 'Sem descrição'}</p>
                </div>
              </Card>
            );
            return (
              <motion.div key={c.id} variants={staggerItem}>
                {c.matriculado ? <Link to={`/curso/${c.id}`} className="group">{CardInner}</Link> : <div className="cursor-default">{CardInner}</div>}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
