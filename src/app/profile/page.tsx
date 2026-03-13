'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Save, Lock, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
      }
      setLoading(false);
    });
  }, [router]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) {
      setError('Errore durante il salvataggio.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('La password deve essere di almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono.');
      return;
    }
    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 2500);
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="card h-64 animate-pulse bg-sand-200" />
      </div>
    );
  }

  const initials = (profile?.display_name || profile?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Indietro
      </button>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center shadow-elevated">
          <span className="text-primary-900 font-extrabold text-2xl">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{profile?.display_name || profile?.email}</h1>
          <p className="text-sm text-gray-500">{profile?.email}</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User size={16} className="text-primary-700" /> Informazioni profilo
        </h2>
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nome visualizzato</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="input"
              placeholder="Come vuoi essere chiamato?"
            />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400" />
              <input
                type="email"
                value={profile?.email || ''}
                className="input pl-9 bg-sand-50 text-gray-400 cursor-not-allowed"
                disabled
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">L&apos;email non può essere modificata</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="btn-primary"
          >
            {saved ? (
              <><Check size={15} /> Salvato!</>
            ) : saving ? (
              <><Loader2 size={15} className="animate-spin" /> Salvataggio...</>
            ) : (
              <><Save size={15} /> Salva modifiche</>
            )}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Lock size={16} className="text-primary-700" /> Cambia password
        </h2>
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nuova password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input"
              placeholder="Min. 6 caratteri"
            />
          </div>
          <div className="form-group">
            <label className="label">Conferma password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Ripeti la nuova password"
            />
          </div>
          {passwordError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {passwordError}
            </div>
          )}
          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="btn-primary"
          >
            {passwordSaved ? (
              <><Check size={15} /> Password aggiornata!</>
            ) : changingPassword ? (
              <><Loader2 size={15} className="animate-spin" /> Aggiornamento...</>
            ) : (
              <><Lock size={15} /> Aggiorna password</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
