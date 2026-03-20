'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DiaryAttachmentRow {
  id: string;
  trip_id: string;
  diary_entry_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface DiaryAttachmentView extends DiaryAttachmentRow {
  signedUrl: string | null;
}

interface DiaryAttachmentsProps {
  tripId: string;
  diaryEntryId: string;
}

const BUCKET = 'trip-diary';
const MAX_SIZE = 10 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(-80);
}

export default function DiaryAttachments({ tripId, diaryEntryId }: DiaryAttachmentsProps) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<DiaryAttachmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);

    const { data, error: fetchError } = await supabase
      .from('diary_attachments')
      .select('*')
      .eq('diary_entry_id', diaryEntryId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setRows([]);
      setError('Impossibile caricare le foto.');
      setLoading(false);
      return;
    }

    const baseRows = (data ?? []) as DiaryAttachmentRow[];

    const signed = await Promise.all(
      baseRows.map(async (r) => {
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(r.storage_path, 60 * 60 * 6);

        return {
          ...r,
          signedUrl: signedData?.signedUrl ?? null,
        } satisfies DiaryAttachmentView;
      })
    );

    setRows(signed);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [diaryEntryId]);

  const onPickFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;

    if (!uid) {
      setError('Devi essere autenticato per caricare immagini.');
      setUploading(false);
      return;
    }

    const uploadErrors: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        uploadErrors.push(`${file.name}: formato non supportato`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        uploadErrors.push(`${file.name}: supera 10MB`);
        continue;
      }

      const cleanName = sanitizeFileName(file.name || 'diary.jpg') || 'diary.jpg';
      const random = Math.random().toString(36).slice(2, 8);
      const path = `${tripId}/${diaryEntryId}/${uid}/${Date.now()}-${random}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        uploadErrors.push(`${file.name}: upload fallito`);
        continue;
      }

      const { error: insertError } = await supabase.from('diary_attachments').insert({
        trip_id: tripId,
        diary_entry_id: diaryEntryId,
        uploaded_by: uid,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        uploadErrors.push(`${file.name}: salvataggio metadati fallito`);
      }
    }

    if (uploadErrors.length > 0) {
      setError(uploadErrors.join(' · '));
    }

    if (inputRef.current) inputRef.current.value = '';

    setUploading(false);
    await load();
  };

  const removeAttachment = async (row: DiaryAttachmentView) => {
    const ok = confirm('Rimuovere questa foto dal diario?');
    if (!ok) return;

    setError(null);

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (storageError) {
      setError('Errore nella rimozione del file.');
      return;
    }

    const { error: dbError } = await supabase.from('diary_attachments').delete().eq('id', row.id);
    if (dbError) {
      setError('Errore nella rimozione del riferimento.');
      return;
    }

    await load();
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">Foto diario</p>

        <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          {uploading ? 'Caricamento...' : 'Carica'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPickFiles}
            disabled={uploading}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Caricamento immagini...
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">Nessuna foto caricata.</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {rows.map((row) => (
            <div key={row.id} className="relative">
              <a
                href={row.signedUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
              >
                {row.signedUrl ? (
                  <img
                    src={row.signedUrl}
                    alt={row.file_name ?? 'Foto diario'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <ImageIcon size={16} />
                  </div>
                )}
              </a>

              {userId && row.uploaded_by === userId && (
                <button
                  type="button"
                  onClick={() => removeAttachment(row)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-red-600 flex items-center justify-center"
                  title="Rimuovi"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
