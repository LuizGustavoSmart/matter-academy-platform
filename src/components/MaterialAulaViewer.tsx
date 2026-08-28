import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Button } from './ui';
import { getSignedUrl } from '../lib/storage';

/**
 * O Chrome bloqueia PDF embutido em iframe/blob apontando pra URL assinada do
 * Storage ("Esta página foi bloqueada pelo Chrome") — o Storage serve o
 * arquivo com cabeçalhos que o Chrome interpreta como download automático
 * disparado de dentro do iframe, mesmo com o conteúdo já baixado como blob.
 * Abrir numa aba nova é uma navegação de nível superior (não um iframe), então
 * não sofre esse bloqueio e usa o leitor de PDF nativo do navegador — que já
 * tem paginação, zoom e tela cheia prontos, sem cobrir o menu da plataforma
 * (é uma aba separada).
 */
export default function MaterialAulaViewer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    getSignedUrl('materiais', path).then((u) => { if (active) setUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [path]);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand grid place-items-center flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Material da aula</p>
          <p className="text-xs text-fg-3">PDF desta aula</p>
        </div>
      </div>
      <Button
        variant="primary" icon={<ExternalLink className="w-4 h-4" />}
        disabled={!url}
        onClick={() => url && window.open(url, '_blank', 'noopener')}
      >
        Abrir material
      </Button>
    </div>
  );
}
