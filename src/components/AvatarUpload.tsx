import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, useToast } from './ui';

/** Redimensiona e comprime a imagem para um data URL leve (256px, JPEG). */
async function toCompressedDataUrl(file: File, max = 256): Promise<string> {
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function AvatarUpload({ size = 44 }: { size?: number }) {
  const { profile, refresh } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) { toast.error?.('Selecione um arquivo de imagem.'); return; }
    setBusy(true);
    try {
      const dataUrl = await toCompressedDataUrl(file);
      const { error } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', profile.id);
      if (error) throw error;
      await refresh();
      toast.success?.('Foto atualizada!');
    } catch (e: any) {
      toast.error?.(e?.message || 'Não foi possível salvar a foto.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };



  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative rounded-full group"
        title="Alterar foto de perfil"
        aria-label="Alterar foto de perfil"
      >
        <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={size} />
        <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-fg">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
