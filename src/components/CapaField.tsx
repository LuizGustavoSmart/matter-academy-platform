import { Field, Input, Select } from './ui';
import { SignedImage } from './SignedImage';
import { useFaixaCapas } from '../lib/faixaCapas';
import { FAIXA_OPTIONS } from '../lib/faixa';

/** Estado pendente do campo — ou um arquivo novo, ou uma capa-modelo escolhida, ou nada (mantém a atual). */
export type CapaPending = { file: File | null; modeloUrl: string | null };
export const CAPA_PENDING_EMPTY: CapaPending = { file: null, modeloUrl: null };

/** Resolve a URL final a partir do pendente — usada no submit do formulário. */
export function resolveCapaPending(pending: CapaPending, existingUrl: string | null): string | null {
  if (pending.modeloUrl) return pending.modeloUrl;
  return existingUrl;
}

export type CapaModeloOption = { value: string; label: string; url: string };

/**
 * Campo de capa com upload de arquivo OU seleção de uma imagem-modelo já
 * cadastrada em "Modelos" — mostrado como lista suspensa ao lado do preview.
 * Ao selecionar um modelo, nenhum upload é feito: a mesma imagem já
 * hospedada é reaproveitada diretamente.
 *
 * Por padrão usa os modelos por faixa (capa de curso/aula); passe `modelos`
 * para reaproveitar o mesmo campo com outra fonte de modelos (ex.: capas de
 * turma).
 */
export function CapaField({ id, label, hint, existingUrl, value, onChange, modelos }: {
  id: string; label: string; hint?: string; existingUrl: string | null;
  value: CapaPending; onChange: (v: CapaPending) => void;
  modelos?: CapaModeloOption[];
}) {
  const faixaCapas = useFaixaCapas();
  const modelosDisponiveis = modelos ?? FAIXA_OPTIONS.filter((o) => faixaCapas[o.value]).map((o) => ({ value: o.value, label: o.label, url: faixaCapas[o.value]! }));
  const previewPath = value.file ? null : (value.modeloUrl ?? existingUrl);

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="flex items-start gap-3">
        <div className="w-16 h-9 rounded-md bg-black overflow-hidden flex-shrink-0 border border-line grid place-items-center">
          {value.file ? (
            <img src={URL.createObjectURL(value.file)} className="w-full h-full object-cover" alt="" />
          ) : previewPath ? (
            <SignedImage bucket="capas" path={previewPath} className="w-full h-full object-cover" />
          ) : (
            <span className="text-fg-3 text-[9px] text-center px-1">Sem capa</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <Input id={id} type="file" accept="image/*" className="!py-2"
            onChange={(e) => onChange({ file: e.target.files?.[0] ?? null, modeloUrl: null })} />
          <Select
            value={value.modeloUrl ?? ''}
            onChange={(e) => onChange({ file: null, modeloUrl: e.target.value || null })}
            className="!py-1.5 !text-xs"
          >
            <option value="">Ou selecione uma imagem-modelo…</option>
            {modelosDisponiveis.length === 0 ? (
              <option value="" disabled>Nenhum modelo cadastrado ainda</option>
            ) : modelosDisponiveis.map((o) => <option key={o.value} value={o.url}>{o.label}</option>)}
          </Select>
        </div>
      </div>
    </Field>
  );
}
