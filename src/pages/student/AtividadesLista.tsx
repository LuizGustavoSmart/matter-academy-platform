import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Badge, Empty, Toast } from '../../components/ui';
import CriarAtividadeModal from './CriarAtividadeModal';

type Atividade = {
  id: string; titulo: string; prazo: string | null; nota_maxima: number;
};
type Envio = { atividade_id: string; enviado_em: string | null; nota: number | null; corrigido_em: string | null };

function statusOf(a: Atividade, envio: Envio | undefined): { label: string; tone: 'default' | 'success' | 'warn' | 'danger' } {
  if (envio?.corrigido_em) return { label: 'Corrigida', tone: 'success' };
  if (envio?.enviado_em) return { label: 'Enviada', tone: 'default' };
  if (a.prazo && new Date(a.prazo) < new Date()) return { label: 'Atrasada', tone: 'danger' };
  return { label: 'Não enviada', tone: 'warn' };
}

export default function AtividadesLista() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [turmaNome, setTurmaNome] = useState('');
  const [cursoTitulo, setCursoTitulo] = useState('');
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [envios, setEnvios] = useState<Record<string, Envio>>({});
  const [pendMap, setPendMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: as }] = await Promise.all([
      supabase.from('turmas').select('nome').eq('id', turmaId!).maybeSingle(),
      supabase.from('cursos').select('titulo').eq('id', cursoId!).maybeSingle(),
      supabase.from('atividades').select('id,titulo,prazo,nota_maxima').eq('turma_id', turmaId!).eq('curso_id', cursoId!).order('created_at', { ascending: false }),
    ]);
    setTurmaNome(t?.nome ?? '');
    setCursoTitulo(c?.titulo ?? '');
    setAtividades(as ?? []);

    const atividadeIds = (as ?? []).map((a) => a.id);
    if (atividadeIds.length) {
      if (isProfessor) {
        const { data: es } = await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').in('atividade_id', atividadeIds);
        const pend: Record<string, number> = {};
        (es ?? []).forEach((e: any) => {
          if (e.enviado_em && e.nota === null) pend[e.atividade_id] = (pend[e.atividade_id] ?? 0) + 1;
        });
        setPendMap(pend);
      } else if (profile) {
        const { data: es } = await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').in('atividade_id', atividadeIds).eq('aluno_id', profile.id);
        const map: Record<string, Envio> = {};
        (es ?? []).forEach((e: any) => { map[e.atividade_id] = e; });
        setEnvios(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId, profile]);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-[#d6deed] mb-6 flex-wrap">
        <button onClick={() => nav('/atividades')} className="hover:text-white transition-colors">Atividades</button>
        <ChevronRight className="w-4 h-4 text-[#434d5e]" />
        <span className="text-white">{turmaNome} {cursoTitulo}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1>{turmaNome} {cursoTitulo}</h1>
          <p className="meta mt-1">{isProfessor ? 'Atividades desta turma' : 'Suas atividades'}</p>
        </div>
        {isProfessor && (
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Criar atividade</Button>
        )}
      </div>

      {loading ? <p className="meta">Carregando...</p> :
        atividades.length === 0 ? (
          <Empty icon={<ClipboardList className="w-10 h-10" />} title="Nenhuma atividade" description={isProfessor ? 'Crie a primeira atividade desta turma' : 'Aguarde o professor publicar atividades'} />
        ) : (
          <Card>
            <ul>
              {atividades.map((a) => {
                const envio = envios[a.id];
                const s = statusOf(a, envio);
                const notaLabel = envio?.corrigido_em ? `${envio.nota}/${a.nota_maxima}` : `-/${a.nota_maxima}`;
                const prazoLabel = a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR') : '-';
                const pend = pendMap[a.id] ?? 0;
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-4 px-4 py-3 border-b border-[#1c1f26] last:border-0 hover:bg-[#111] cursor-pointer"
                    onClick={() => nav(`/atividade/${a.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.titulo}</p>
                      <p className="meta">Prazo: {prazoLabel}</p>
                    </div>
                    {!isProfessor && <Badge tone={s.tone}>{s.label}</Badge>}
                    {!isProfessor && <span className="text-sm text-[#cbfb00] font-medium w-16 text-right">{notaLabel}</span>}
                    {isProfessor && pend > 0 && <Badge tone="warn">{pend} pendente{pend > 1 ? 's' : ''}</Badge>}
                    <ChevronRight className="w-4 h-4 text-[#434d5e] flex-shrink-0" />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      <CriarAtividadeModal
        open={createOpen}
        turmaId={turmaId!}
        cursoId={cursoId!}
        onClose={() => setCreateOpen(false)}
        onDone={() => { setCreateOpen(false); setToast('Atividade criada'); load(); }}
      />
      <Toast message={toast} tone="success" />
    </div>
  );
}
