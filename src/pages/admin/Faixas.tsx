import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadCapa } from '../../lib/storage';
import { invalidateFaixaCapasCache } from '../../lib/faixaCapas';
import { invalidateTurmaCapasCache, TURMA_CAPA_OPTIONS } from '../../lib/turmaCapas';
import { Card, Input, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS } from '../../lib/faixa';

type FaixaCapa = { faixa: string; capa_url: string | null };
type TurmaCapa = { tipo: string; capa_url: string | null };

export default function AdminFaixas() {
  const toast = useToast();
  const [capas, setCapas] = useState<Record<string, string | null>>({});
  const [turmaCapas, setTurmaCapas] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadingTurma, setUploadingTurma] = useState<string | null>(null);

  const load = async () => {
    // faixa_capas/turma_capas ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data }, { data: dataTurma }] = await Promise.all([
      sb.from('faixa_capas').select('faixa,capa_url'),
      sb.from('turma_capas').select('tipo,capa_url'),
    ]);
    const map: Record<string, string | null> = {};
    ((data ?? []) as FaixaCapa[]).forEach((r) => { map[r.faixa] = r.capa_url; });
    setCapas(map);
    const mapTurma: Record<string, string | null> = {};
    ((dataTurma ?? []) as TurmaCapa[]).forEach((r) => { mapTurma[r.tipo] = r.capa_url; });
    setTurmaCapas(mapTurma);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onUpload = async (faixa: string, file: File) => {
    setUploading(faixa);
    try {
      const up = await uploadCapa(file, 'faixas');
      // faixa_capas ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('faixa_capas').upsert({ faixa, capa_url: up.path, updated_at: new Date().toISOString() }, { onConflict: 'faixa' });
      if (error) throw error;
      invalidateFaixaCapasCache();
      toast.success('Capa da faixa atualizada.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const onUploadTurma = async (tipo: string, file: File) => {
    setUploadingTurma(tipo);
    try {
      const up = await uploadCapa(file, 'turmas');
      // turma_capas ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('turma_capas').upsert({ tipo, capa_url: up.path, updated_at: new Date().toISOString() }, { onConflict: 'tipo' });
      if (error) throw error;
      invalidateTurmaCapasCache();
      toast.success('Capa-modelo de turma atualizada.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingTurma(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Modelos"
        subtitle="Capas padrão de faixas e turmas. As de faixa são aplicadas automaticamente a cursos/aulas sem capa própria; as de turma ficam disponíveis para escolher na hora de criar ou editar uma turma."
      />

      <h3 className="mb-1">Capas de faixa</h3>
      <p className="text-fg-3 text-sm mb-4">Usada automaticamente por cursos e aulas sem capa própria.</p>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Card key={i} className="p-4 h-56 animate-pulse" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FAIXA_OPTIONS.map((o) => (
            <Card key={o.value} className="p-4">
              <p className="text-fg font-medium mb-3">{o.label}</p>
              <div className="w-full h-32 rounded-lg bg-panel-2 border border-line overflow-hidden mb-3 grid place-items-center">
                {capas[o.value] ? (
                  <SignedImage bucket="capas" path={capas[o.value]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-fg-3 text-xs">Sem capa</span>
                )}
              </div>
              <label className="flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-fg-2 hover:bg-panel-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                {uploading === o.value ? 'Enviando…' : capas[o.value] ? 'Substituir imagem' : 'Enviar imagem'}
                <Input type="file" accept="image/*" className="hidden" disabled={uploading === o.value}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(o.value, f); e.target.value = ''; }} />
              </label>
            </Card>
          ))}
        </div>
      )}

      <h3 className="mt-8 mb-1">Capas de turma</h3>
      <p className="text-fg-3 text-sm mb-4">
        Modelos disponíveis para escolher ao criar ou editar uma turma — não são aplicados automaticamente.
      </p>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Card key={i} className="p-4 h-56 animate-pulse" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TURMA_CAPA_OPTIONS.map((o) => (
            <Card key={o.value} className="p-4">
              <p className="text-fg font-medium mb-3">{o.label}</p>
              <div className="w-full h-32 rounded-lg bg-panel-2 border border-line overflow-hidden mb-3 grid place-items-center">
                {turmaCapas[o.value] ? (
                  <SignedImage bucket="capas" path={turmaCapas[o.value]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-fg-3 text-xs">Sem capa</span>
                )}
              </div>
              <label className="flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-fg-2 hover:bg-panel-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                {uploadingTurma === o.value ? 'Enviando…' : turmaCapas[o.value] ? 'Substituir imagem' : 'Enviar imagem'}
                <Input type="file" accept="image/*" className="hidden" disabled={uploadingTurma === o.value}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadTurma(o.value, f); e.target.value = ''; }} />
              </label>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
