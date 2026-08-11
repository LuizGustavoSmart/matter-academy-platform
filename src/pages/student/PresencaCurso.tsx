import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../layouts/AppShell';
import CursoPresencaTab from '../admin/CursoPresencaTab';

/**
 * Presença para professor/monitor. A tela de curso do admin
 * (/admin/turmas/:turmaId/cursos/:cursoId) é restrita a admin, então o
 * professor chega na MESMA aba por esta rota. Quem pode de fato lançar é
 * decidido pela RLS (`can_manage_presenca`); o guard aqui é só de navegação.
 */
export default function PresencaCurso() {
  const { turmaId, cursoId } = useParams<{ turmaId: string; cursoId: string }>();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';

  const [turmaNome, setTurmaNome] = useState('');
  const [cursoTitulo, setCursoTitulo] = useState('');

  useEffect(() => {
    if (!turmaId || !cursoId || !isStaff) return;
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from('turmas').select('nome').eq('id', turmaId).maybeSingle(),
        supabase.from('cursos').select('titulo').eq('id', cursoId).maybeSingle(),
      ]);
      setTurmaNome(t?.nome ?? '');
      setCursoTitulo(c?.titulo ?? '');
    })();
  }, [turmaId, cursoId, isStaff]);

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Atividades', to: '/atividades' }, { label: `${turmaNome} ${cursoTitulo}`.trim() || '…', to: `/atividades/${turmaId}/${cursoId}` }, { label: 'Presença' }]}
        title="Presença"
        subtitle={`${turmaNome} ${cursoTitulo}`.trim() || undefined}
      />
      <CursoPresencaTab turmaId={turmaId!} cursoId={cursoId!} />
    </div>
  );
}
