import { supabase } from './supabase';

async function uploadToBucket(bucket: string, file: File, folder: string) {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, nome: file.name };
}

export async function uploadAtividadeFile(file: File, folder: string) {
  return uploadToBucket('atividades', file, folder);
}

export async function uploadComunidadeFile(file: File, folder: string) {
  return uploadToBucket('comunidade', file, folder);
}
