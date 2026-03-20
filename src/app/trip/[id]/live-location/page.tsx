'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, LocateFixed, Loader2, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, TripLiveLocation, TripRole } from '@/lib/types';
import { distanceMeters, formatRelativeTime } from '@/lib/utils';

interface MemberProfile {
  display_name: string | null;
  email: string;
}

interface TripMemberLite {
  user_id: string;
  role: TripRole;
  profiles: MemberProfile | null;
}

const EMERGENCY_OPTIONS = [
  { label: 'Europa (112)', value: '112' },
  { label: 'USA/Canada (911)', value: '911' },
  { label: 'Regno Unito (999)', value: '999' },
  { label: 'Australia (000)', value: '000' },
  { label: 'Giappone (110)', value: '110' },
] as const;

const UPDATE_INTERVAL_MS = 20_000;
const DISTANCE_THRESHOLD_M = 30;
const RETENTION_HOURS = 24;

function addHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function memberLabel(member: TripMemberLite): string {
  return member.profiles?.display_name || member.profiles?.email || 'Utente';
}

function fallbackUserLabel(userId: string): string {
  return `Utente ${userId.slice(0, 6)}`;
}

function guessEmergencyNumber(destination: string | null | undefined): string {
  const text = (destination ?? '').toLowerCase();
  if (text.includes('usa') || text.includes('stati uniti') || text.includes('new york') || text.includes('los angeles') || text.includes('canada') || text.includes('toronto')) {
    return '911';
  }
  if (text.includes('uk') || text.includes('regno unito') || text.includes('londra') || text.includes('england')) {
    return '999';
  }
  if (text.includes('australia') || text.includes('sydney') || text.includes('melbourne')) {
    return '000';
  }
  if (text.includes('giappone') || text.includes('tokyo') || text.includes('osaka') || text.includes('japan')) {
    return '110';
  }
  return '112';
}

export default function LiveLocationPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMemberLite[]>([]);
  const [locations, setLocations] = useState<TripLiveLocation[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<TripLiveLocation | null>(null);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyNumber, setEmergencyNumber] = useState('112');

  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  const upsertLocation = useCallback(async (
    payload: Partial<TripLiveLocation> & { sharing_enabled: boolean },
    userId: string
  ) => {
    await supabase.from('trip_live_locations').upsert({
      trip_id: tripId,
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...payload,
    }, { onConflict: 'trip_id,user_id' });
  }, [supabase, tripId]);

  const sendPosition = useCallback(async (
    pos: GeolocationPosition,
    userId: string,
    force = false
  ) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const now = Date.now();

    const last = lastCoordsRef.current;
    const movedEnough = !last || distanceMeters(last.lat, last.lon, lat, lon) >= DISTANCE_THRESHOLD_M;
    const timeEnough = now - lastSentAtRef.current >= UPDATE_INTERVAL_MS;

    if (!force && !(movedEnough && timeEnough)) return;

    await upsertLocation({
      lat,
      lon,
      accuracy_m: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      sharing_enabled: true,
      last_shared_at: new Date().toISOString(),
      expires_at: addHoursIso(RETENTION_HOURS),
    }, userId);

    lastCoordsRef.current = { lat, lon };
    lastSentAtRef.current = now;
  }, [upsertLocation]);

  const startWatch = useCallback(async (userId: string) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocalizzazione non disponibile su questo dispositivo/browser.');
      return;
    }

    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await sendPosition(pos, userId, true);
        } catch {
          setError('Impossibile inviare la posizione iniziale.');
        }
      },
      () => setError('Permesso posizione negato o non disponibile.'),
      { enableHighAccuracy: false, maximumAge: 10_000, timeout: 15_000 }
    );

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await sendPosition(pos, userId);
        } catch {
          setError('Errore durante l’aggiornamento posizione.');
        }
      },
      () => setError('Permesso posizione negato o GPS non disponibile.'),
      { enableHighAccuracy: false, maximumAge: 20_000, timeout: 20_000 }
    );

    watchIdRef.current = id;
    setTracking(true);
  }, [sendPosition]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: userRes }, { data: tripData }, { data: membersData }, { data: locData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
      supabase
        .from('trip_members')
        .select('user_id, role')
        .eq('trip_id', tripId),
      supabase
        .from('trip_live_locations')
        .select('*')
        .eq('trip_id', tripId)
        .gt('expires_at', new Date().toISOString()),
    ]);

    const uid = userRes.user?.id ?? null;
    setMyUserId(uid);
    setTrip(tripData ?? null);

    const memberRows = (membersData as Array<{ user_id: string; role: TripRole }> | null) ?? [];
    let mappedMembers: TripMemberLite[] = [];

    if (memberRows.length > 0) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      const profileMap = new Map<string, MemberProfile>();
      (profilesData ?? []).forEach((p) => {
        profileMap.set(p.id as string, {
          display_name: (p.display_name as string | null) ?? null,
          email: (p.email as string) ?? '',
        });
      });

      mappedMembers = memberRows.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profiles: profileMap.get(m.user_id) ?? null,
      }));
    }

    setMembers(mappedMembers);

    const locs = (locData as TripLiveLocation[] | null) ?? [];
    setLocations(locs.filter(l => l.sharing_enabled && l.lat != null && l.lon != null));

    if (uid) {
      const mine = locs.find(l => l.user_id === uid) ?? null;
      setMyLocation(mine);
      setSharingEnabled(Boolean(mine?.sharing_enabled));
    }

    setLoading(false);
  }, [supabase, tripId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!trip) return;
    setEmergencyNumber(guessEmergencyNumber(trip.destination));
  }, [trip]);

  useEffect(() => {
    const channel = supabase
      .channel(`trip-live-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_live_locations',
        filter: `trip_id=eq.${tripId}`,
      }, () => {
        loadAll();
      })
      .subscribe();

    return () => {
      stopWatch();
      supabase.removeChannel(channel);
    };
  }, [loadAll, stopWatch, supabase, tripId]);

  useEffect(() => {
    if (!myUserId) return;
    if (!sharingEnabled) {
      stopWatch();
      return;
    }
    startWatch(myUserId);
  }, [myUserId, sharingEnabled, startWatch, stopWatch]);

  const toggleSharing = async () => {
    if (!myUserId) return;
    const next = !sharingEnabled;
    setSaving(true);
    setError(null);

    try {
      if (!next) {
        stopWatch();
        await upsertLocation({
          sharing_enabled: false,
          lat: null,
          lon: null,
          accuracy_m: null,
          last_shared_at: null,
          expires_at: null,
        }, myUserId);
      } else {
        await upsertLocation({
          sharing_enabled: true,
          expires_at: addHoursIso(RETENTION_HOURS),
        }, myUserId);
      }
      setSharingEnabled(next);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    if (members.length === 0) {
      return locations.map((loc) => ({
        member: null,
        loc,
        userId: loc.user_id,
      }));
    }

    return members.map((m) => {
      const loc = locations.find(l => l.user_id === m.user_id) ?? null;
      return { member: m, loc, userId: m.user_id };
    });
  }, [members, locations]);

  const myRole = useMemo(() => {
    if (!myUserId) return null;
    return members.find(m => m.user_id === myUserId)?.role ?? null;
  }, [members, myUserId]);

  const canManageAll = myRole === 'owner' || myRole === 'editor';
  const visibleMembersCount = members.length;

  const mapCenter = useMemo(() => {
    if (locations.length === 0) return null;
    const firstWithCoords = locations.find(r => r.lat != null && r.lon != null);
    if (!firstWithCoords || firstWithCoords.lat == null || firstWithCoords.lon == null) return null;
    return { lat: firstWithCoords.lat, lon: firstWithCoords.lon };
  }, [locations]);

  const stopAllSharing = async () => {
    if (!canManageAll) return;
    if (!confirm('Disattivare la condivisione posizione per tutti i membri?')) return;
    setSaving(true);
    try {
      await supabase.from('trip_live_locations').delete().eq('trip_id', tripId);
      if (myUserId) setSharingEnabled(false);
      stopWatch();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-sand-200" />)}</div>
      </div>
    );
  }

  if (!trip) return <div className="p-10 text-center text-gray-500">Viaggio non trovato.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/trip/${tripId}`}
        aria-label="Torna al viaggio"
        title="Torna al viaggio"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
          <LocateFixed size={18} className="text-cyan-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live location</h1>
          <p className="text-sm text-gray-500">Condividi la tua posizione con i membri del viaggio</p>
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={toggleSharing}
          disabled={saving}
          className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${sharingEnabled ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'} disabled:opacity-60`}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          {sharingEnabled ? 'Condivisione attiva' : 'Attiva condivisione'}
        </button>
        {canManageAll && (
          <button
            onClick={stopAllSharing}
            disabled={saving}
            className="mt-2 text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2 disabled:opacity-60"
          >
            Ferma posizione per tutti
          </button>
        )}
        <p className="text-xs text-slate-500 mt-1.5">
          Visibile a {visibleMembersCount} {visibleMembersCount === 1 ? 'membro' : 'membri'} di questo gruppo.
        </p>
      </div>

      <div className="card p-2 mb-4 overflow-hidden">
        {mapCenter ? (
          <iframe
            title="Mappa posizioni live"
            className="w-full h-52 rounded-xl border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lon - 0.03}%2C${mapCenter.lat - 0.02}%2C${mapCenter.lon + 0.03}%2C${mapCenter.lat + 0.02}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lon}`}
          />
        ) : (
          <div className="h-52 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
            Nessuna posizione attiva da mostrare in mappa
          </div>
        )}
      </div>

      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">Sicurezza</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <select
            value={emergencyNumber}
            onChange={(e) => setEmergencyNumber(e.target.value)}
            className="input"
          >
            {EMERGENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <a
            href={`tel:${emergencyNumber}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" aria-hidden="true">
              <path d="M640-520v-80h80v80h-80Zm0-160v-200h80v200h-80Zm158 560q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12ZM241-600l66-66-17-94h-89q5 41 14 81t26 79Zm358 358q39 17 79.5 27t81.5 13v-88l-94-19-67 67ZM241-600Zm358 358Z"/>
            </svg>
            SOS {emergencyNumber}
          </a>
        </div>
      </div>

      {error && (
        <div className="card p-3 mb-4 border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="card p-2 sm:p-3">
        <div className="divide-y divide-slate-100">
          {rows.map(({ member, loc, userId }) => (
            <div key={userId} className="py-2 px-1 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-800 truncate">
                <span className="font-semibold">{member ? memberLabel(member) : fallbackUserLabel(userId)}</span>
                <span className="text-slate-500"> · {loc?.last_shared_at ? `Aggiornato ${formatRelativeTime(loc.last_shared_at)}` : 'Off'}</span>
              </p>
              {loc?.lat != null && loc.lon != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=16/${loc.lat}/${loc.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-primary-700 hover:text-primary-800 whitespace-nowrap"
                >
                  Mappa
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {tracking && (
        <p className="text-[11px] text-emerald-700 mt-4 font-semibold">Tracking attivo</p>
      )}
      {myLocation?.last_shared_at && (
        <p className="text-[11px] text-slate-500 mt-1">Ultimo invio: {formatRelativeTime(myLocation.last_shared_at)}</p>
      )}
    </div>
  );
}
