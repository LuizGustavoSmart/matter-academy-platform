import { supabase } from './supabase';

export async function uploadAtividadeFile(file: File, folder: string) {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('atividades').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('atividades').getPublicUrl(path);
  return { url: data.publicUrl, nome: file.name };
}
