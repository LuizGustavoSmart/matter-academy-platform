import { supabase } from './supabase';

async function uploadToBucket(bucket: string, file: File, folder: string) {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return { path, nome: file.name };
}

export async function uploadAtividadeFile(file: File, folder: string) {
  return uploadToBucket('atividades', file, folder);
}

export async function uploadComunidadeFile(file: File, folder: string) {
  return uploadToBucket('comunidade', file, folder);
}

export async function uploadDuvidaFile(file: File, folder: string) {
  return uploadToBucket('duvidas', file, folder);
}

export async function uploadAulaCapa(file: File, folder: string) {
  return uploadToBucket('aulas', file, folder);
}

export async function uploadCapa(file: File, folder: string) {
  return uploadToBucket('capas', file, folder);
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
