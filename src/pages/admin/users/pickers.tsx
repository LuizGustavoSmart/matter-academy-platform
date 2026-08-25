import { supabase } from '../../../lib/supabase';
import { Checkbox, Switch } from '../../../components/ui';

export type Turma = { id: string; nome: string };
export type CursoInfo = { id: string; titulo: string };
export type TurmaSelection = { turma_id: string; curso_ids: string[]; embaixador_curso_ids?: string[]; staff_curso_ids?: string[] };

/** Carrega os cursos de cada turma via curso_turmas. */
export async function loadCoursesByTurma(): Promise<Record<string, CursoInfo[]>> {
  const [{ data: cts }, { data: cs }] = await Promise.all([
    supabase.from('curso_turmas').select('turma_id,curso_id'),
    supabase.from('cursos').select('id,titulo'),
  ]);
  const cursoMap = new Map((cs ?? []).map((c) => [c.id, c]));
  const byTurma: Record<string, CursoInfo[]> = {};
  (cts ?? []).forEach((ct) => {
    const curso = cursoMap.get(ct.curso_id);
    if (!curso) return;
    (byTurma[ct.turma_id] ??= []).push(curso);
  });
  return byTurma;
}

/** Seletor aninhado Turma › Cursos, usado na criação/edição e na importação. */
export function TurmaCoursePicker({
  turmas, coursesByTurma, value, onChange, showCourses, showEmbaixadorToggle = false, showStaffToggle = false,
}: {
  turmas: Turma[];
  coursesByTurma: Record<string, CursoInfo[]>;
  value: TurmaSelection[];
  onChange: (v: TurmaSelection[]) => void;
  showCourses: boolean;
  showEmbaixadorToggle?: boolean;
  /** Para professor/monitor: alterna, por curso, entre "dá aula" (staff) e "aluno normal" (participante). */
  showStaffToggle?: boolean;
}) {
  const isTurmaSelected = (tid: string) => value.some((v) => v.turma_id === tid);
  const getCursoIds = (tid: string) => value.find((v) => v.turma_id === tid)?.curso_ids ?? [];
  const isEmbaixadorCurso = (tid: string, cid: string) => !!value.find((v) => v.turma_id === tid)?.embaixador_curso_ids?.includes(cid);
  const isStaffCurso = (tid: string, cid: string) => !!value.find((v) => v.turma_id === tid)?.staff_curso_ids?.includes(cid);

  const toggleTurma = (tid: string) => {
    if (isTurmaSelected(tid)) onChange(value.filter((v) => v.turma_id !== tid));
    else onChange([...value, { turma_id: tid, curso_ids: [], embaixador_curso_ids: [], staff_curso_ids: [] }]);
  };
  const toggleCurso = (tid: string, cid: string) => {
    onChange(value.map((v) => {
      if (v.turma_id !== tid) return v;
      const selecionando = !v.curso_ids.includes(cid);
      const curso_ids = selecionando ? [...v.curso_ids, cid] : v.curso_ids.filter((c) => c !== cid);
      // Ao desmarcar o curso, remove também a marcação de embaixador/staff nele.
      const embaixador_curso_ids = selecionando
        ? (showEmbaixadorToggle ? [...(v.embaixador_curso_ids ?? []), cid] : v.embaixador_curso_ids)
        : (v.embaixador_curso_ids ?? []).filter((c) => c !== cid);
      const staff_curso_ids = selecionando
        ? (showStaffToggle ? [...(v.staff_curso_ids ?? []), cid] : v.staff_curso_ids)
        : (v.staff_curso_ids ?? []).filter((c) => c !== cid);
      return { ...v, curso_ids, embaixador_curso_ids, staff_curso_ids };
    }));
  };
  const toggleEmbaixadorCurso = (tid: string, cid: string) => {
    onChange(value.map((v) => {
      if (v.turma_id !== tid) return v;
      const current = v.embaixador_curso_ids ?? [];
      const embaixador_curso_ids = current.includes(cid) ? current.filter((c) => c !== cid) : [...current, cid];
      return { ...v, embaixador_curso_ids };
    }));
  };
  const toggleStaffCurso = (tid: string, cid: string) => {
    onChange(value.map((v) => {
      if (v.turma_id !== tid) return v;
      const current = v.staff_curso_ids ?? [];
      const staff_curso_ids = current.includes(cid) ? current.filter((c) => c !== cid) : [...current, cid];
      return { ...v, staff_curso_ids };
    }));
  };

  if (turmas.length === 0) {
    return <p className="text-fg-3 text-sm py-2">Nenhuma turma criada ainda.</p>;
  }

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin border border-line rounded-lg p-2.5 bg-panel-3/30">
      {turmas.map((t) => {
        const selected = isTurmaSelected(t.id);
        const courses = coursesByTurma[t.id] ?? [];
        const selectedCursoIds = getCursoIds(t.id);
        const coursesVisible = selected && (showCourses || showStaffToggle);
        const missingCourse = coursesVisible && selectedCursoIds.length === 0;
        return (
          <div key={t.id} className={selected ? 'rounded-md bg-panel-2/60 p-1.5 -mx-0.5' : ''}>
            <div className="flex items-center gap-2 flex-wrap">
              <Checkbox checked={selected} onChange={() => toggleTurma(t.id)} label={<span className="text-fg font-medium">{t.nome}</span>} />
              {missingCourse && <span className="text-danger text-xs">selecione ao menos 1 curso</span>}
            </div>
            {coursesVisible && (
              <div className="ml-6 mt-1.5 space-y-1.5 pb-1">
                {courses.length === 0 ? (
                  <p className="text-fg-3 text-xs italic">Nenhum curso vinculado a esta turma.</p>
                ) : courses.map((c) => {
                  const cursoSelecionado = selectedCursoIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap">
                      <Checkbox
                        checked={cursoSelecionado}
                        onChange={() => toggleCurso(t.id, c.id)}
                        label={<span className="text-fg-2 text-[13px]">{c.titulo}</span>}
                      />
                      {cursoSelecionado && showEmbaixadorToggle && (
                        <Switch checked={isEmbaixadorCurso(t.id, c.id)} onChange={() => toggleEmbaixadorCurso(t.id, c.id)}
                          label={<span className="text-xs whitespace-nowrap">{isEmbaixadorCurso(t.id, c.id) ? 'Embaixador' : 'Aluno normal'}</span>} />
                      )}
                      {cursoSelecionado && showStaffToggle && (
                        <Switch checked={isStaffCurso(t.id, c.id)} onChange={() => toggleStaffCurso(t.id, c.id)}
                          label={<span className="text-xs whitespace-nowrap">{isStaffCurso(t.id, c.id) ? 'Dá aula' : 'Aluno normal'}</span>} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
