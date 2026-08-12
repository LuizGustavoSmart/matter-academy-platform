import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadCapa } from '../../lib/storage';
import { invalidateFaixaCapasCache } from '../../lib/faixaCapas';
import { Card, Input, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS } from '../../lib/faixa';

type FaixaCapa = { faixa: string; capa_url: string | null };

export default function AdminFaixas() {
  const toast = useToast();
  const [capas, setCapas] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    // faixa_capas ainda não está no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('faixa_capas').select('faixa,capa_url');
    const map: Record<string, string | null> = {};
    ((data ?? []) as FaixaCapa[]).forEach((r) => { map[r.faixa] = r.capa_url; });
    setCapas(map);
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

  return (
    <div>
      <PageHeader
        title="Faixas"
        subtitle="Capa padrão de cada faixa. Cursos e aulas sem capa própria usam automaticamente a imagem da faixa correspondente."
      />

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
    </div>
  );
}
