import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Empty, ProgressBar } from '../../components/ui';

type CourseCard = {
  id: string;
  titulo: string;
  descricao: string;
  total: number;
  done: number;
};

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      const { data: cs } = await supabase.from('cursos').select('id,titulo,descricao');
      const cursoIds = (cs ?? []).map((c) => c.id);
      const { data: as } = await supabase.from('aulas').select('id,curso_id').in('curso_id', cursoIds.length ? cursoIds : ['00000000-0000-0000-0000-000000000000']);
      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      const doneSet = new Set((ps ?? []).map((p) => p.aula_id));
      const counts: Record<string, { total: number; done: number }> = {};
      (as ?? []).forEach((a) => {
        if (!counts[a.curso_id]) counts[a.curso_id] = { total: 0, done: 0 };
        counts[a.curso_id].total++;
        if (doneSet.has(a.id)) counts[a.curso_id].done++;
      });
      setCourses((cs ?? []).map((c) => ({
        ...c,
        total: counts[c.id]?.total ?? 0,
        done: counts[c.id]?.done ?? 0,
      })));
      setLoading(false);
    };
    load();
  }, [profile]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Meus cursos</h1>
        <p className="text-[#d6deed]">Continue de onde parou e acompanhe seu progresso.</p>
      </div>

      {loading ? <p className="meta">Carregando...</p> :
        courses.length === 0 ? <Empty icon={<BookOpen className="w-10 h-10" />} title="Nenhum curso disponível" description="Aguarde o administrador liberar conteúdo para suas turmas" /> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <Link key={c.id} to={`/curso/${c.id}`} className="group">
                  <Card className="p-6 h-full flex flex-col transition-colors hover:border-[#cbfb00]/40">
                    <div className="w-11 h-11 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center mb-4">
                      <BookOpen className="w-5 h-5 text-[#cbfb00]" />
                    </div>
                    <h3 className="mb-2 group-hover:text-white transition-colors">{c.titulo}</h3>
                    <p className="text-sm mb-6 line-clamp-2 flex-1">{c.descricao || 'Sem descrição'}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#d6deed]">{c.done}/{c.total} aulas</span>
                        <span className="text-[#cbfb00] font-medium">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} />
                    </div>
                    <div className="mt-5 inline-flex items-center gap-1 text-sm text-[#cbfb00] font-medium">
                      {c.done === 0 ? 'Começar' : pct === 100 ? 'Revisar' : 'Continuar'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
