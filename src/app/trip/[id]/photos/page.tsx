

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Camera, Download, Image as ImageIcon, Info, Loader2, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface TripPhoto {
  id: string;
  trip_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface TripPhotoView extends TripPhoto {
  signedUrl: string | null;
}

const BUCKET = 'trip-photos';
const MAX_SIZE = 15 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(-80);
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export default function TripPhotosPage() {
  const supabase = createClient();
  const { id: tripId } = useParams<{ id: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<TripPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, string>>({});

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex] ?? null;

  const load = async () => {
    setLoading(true);
    setError(null);

    const [{ data: authData }, { data, error: fetchError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('trip_photos').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);

    const uid = authData.user?.id ?? null;
    setUserId(uid);

    if (fetchError) {
      setError('Impossibile caricare le foto del viaggio.');
      setPhotos([]);
      setLoading(false);
      return;
    }

    const baseRows = (data ?? []) as TripPhoto[];

    const uploaderIds = Array.from(new Set(baseRows.map(row => row.uploaded_by)));
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', uploaderIds);

      const map: Record<string, string> = {};
      for (const profile of profiles ?? []) {
        map[profile.id] = profile.display_name || profile.email || 'Partecipante';
      }
      setProfilesById(map);
    } else {
      setProfilesById({});
    }

    const withSignedUrls = await Promise.all(
      baseRows.map(async (row) => {
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 60 * 60 * 6);

        return {
          ...row,
          signedUrl: signedData?.signedUrl ?? null,
        } satisfies TripPhotoView;
      })
    );

    setPhotos(withSignedUrls);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;

    setUploading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;

    if (!uid) {
      setUploading(false);
      setError('Devi effettuare l’accesso per caricare foto.');
      return;
    }

    const uploadErrors: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        uploadErrors.push(`${file.name}: formato non supportato`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        uploadErrors.push(`${file.name}: supera 15MB`);
        continue;
      }

      const cleanName = sanitizeFileName(file.name || 'foto.jpg') || 'foto.jpg';
      const random = Math.random().toString(36).slice(2, 8);
      const path = `${tripId}/${uid}/${Date.now()}-${random}-${cleanName}`;

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

      const { error: insertError } = await supabase.from('trip_photos').insert({
        trip_id: tripId,
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

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    await load();
  };

  const onFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await uploadFiles(files);
  };

  const deletePhoto = async (photo: TripPhotoView) => {
    if (!confirm('Vuoi eliminare questa foto?')) return;

    setError(null);

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    if (storageError) {
      setError('Errore nella rimozione del file.');
      return;
    }

    const { error: dbError } = await supabase.from('trip_photos').delete().eq('id', photo.id);
    if (dbError) {
      setError('Errore nella rimozione del riferimento.');
      return;
    }

    setSelectedIndex(null);
    setShowDetails(false);
    await load();
  };

  const handleSaveToDevice = async (photo: TripPhotoView) => {
    if (!photo.signedUrl) return;

    try {
      const response = await fetch(photo.signedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = photo.file_name || `trip-photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Impossibile salvare la foto sul dispositivo.');
    }
  };

  const selectedUploader = useMemo(() => {
    if (!selectedPhoto) return '';
    if (selectedPhoto.uploaded_by === userId) return 'Tu';
    return profilesById[selectedPhoto.uploaded_by] || 'Partecipante';
  }, [profilesById, selectedPhoto, userId]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          href={`/trip/${tripId}`}
          className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Galleria
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFilePick}
              disabled={uploading}
            />
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Scatta
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFilePick}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Foto</h1>
      <p className="text-sm text-slate-500 mb-5">Galleria condivisa del viaggio. Tocca una foto per aprirla a schermo intero.</p>

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="py-12 text-slate-400 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Caricamento foto...
        </div>
      ) : photos.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          <ImageIcon size={24} className="mx-auto mb-2 text-slate-300" />
          Nessuna foto caricata.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => {
                setSelectedIndex(index);
                setShowDetails(false);
              }}
              className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.file_name || 'Foto viaggio'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon size={18} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedPhoto && selectedPhoto.signedUrl && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            type="button"
            onClick={() => {
              setSelectedIndex(null);
              setShowDetails(false);
            }}
            className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>

          <button
            type="button"
            onClick={() => setShowDetails(prev => !prev)}
            className="absolute top-3 left-3 z-20 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
            aria-label="Mostra dettagli"
          >
            <Info size={18} />
          </button>

          <button
            type="button"
            onClick={() => setShowDetails(prev => !prev)}
            className="w-full h-full flex items-center justify-center"
          >
            <img
              src={selectedPhoto.signedUrl}
              alt={selectedPhoto.file_name || 'Foto viaggio'}
              className="max-w-full max-h-full object-contain"
            />
          </button>

          {showDetails && (
            <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none">
              <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-4 text-xs text-white/90">
                Caricata da: {selectedUploader}
              </div>

              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4 pointer-events-auto">
                <div className="flex items-center justify-between gap-2 text-white text-xs mb-3">
                  <span className="truncate">{selectedPhoto.file_name || 'Foto viaggio'}</span>
                  <span className="text-white/70">{formatBytes(selectedPhoto.size_bytes)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveToDevice(selectedPhoto)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-900 px-3 py-2 text-xs font-semibold"
                  >
                    <Download size={14} /> Salva sul dispositivo
                  </button>

                  {userId === selectedPhoto.uploaded_by && (
                    <button
                      type="button"
                      onClick={() => deletePhoto(selectedPhoto)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 text-white px-3 py-2 text-xs font-semibold"
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
