import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase storage is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "digitalvetri-files";

export function storageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Upload a file buffer and return its public URL.
 * Paths are namespaced by kind: proposals/, questionnaires/, exports/, imports/
 */
export async function uploadFile(
  path: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, data, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}
