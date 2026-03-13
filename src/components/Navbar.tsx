'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plane, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Hide navbar on auth and invite pages
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isInvitePage = pathname.startsWith('/invite/');

  useEffect(() => {
    const supabase = createClient();

    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserEmail(null);
        setProfile(null);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setProfile(data ?? null);
    };

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserEmail(null);
        setProfile(null);
      } else {
        setUserEmail(session.user.email ?? null);
        loadProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthPage || isInvitePage || !userEmail) return null;

  const displayName = profile?.display_name || profile?.email || userEmail;

  const initials = (displayName || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-primary-900 sticky top-0 z-40 shadow-elevated">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <Plane size={18} className="text-primary-900" />
            </div>
            <span className="text-lg font-extrabold text-white tracking-tight">Viaggi</span>
          </Link>

          {/* User */}
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-900 font-bold text-xs">{initials}</span>
              </div>
              <span className="hidden sm:inline max-w-[160px] truncate">
                {displayName}
              </span>
            </Link>
            <button
              onClick={handleLogout}
              title="Esci"
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
