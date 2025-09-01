import '../styles/globals.css';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { setAuthToken } from '../lib/api';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthToken(data?.session?.access_token || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthToken(session?.access_token || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);
  return <Component {...pageProps} />;
}
