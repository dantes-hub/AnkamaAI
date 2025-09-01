import { useEffect, useState } from 'react';
import { Cog6ToothIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';


export default function Topbar({ onRegenerate, onSettings }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }
  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="h-12 border-b border-stroke glass flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onRegenerate}
          className="p-2 rounded-lg hover:bg-white/10"
          title="Regenerate"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
        <div className="text-sm text-muted">
          {user ? `Signed in: ${user.email}` : 'Not signed in'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!user ? (
          <button
            onClick={signIn}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Sign in
          </button>
        ) : (
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Sign out
          </button>
        )}
        <button
          onClick={onSettings}
          className="p-2 rounded-lg hover:bg-white/10"
          title="Settings"
        >
          <Cog6ToothIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
