// apps/frontend/pages/index.js
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Chat from '../components/Chat';
import { listFiles, ingest as ingestFormData, deleteFile as deleteFileApi, ask, setAuthToken } from '../lib/api';
import { supabase, getAccessToken } from '../lib/supabase';

export default function Home() {
  // Tabs: 'chat' | 'library'
  const [activeTab, setActiveTab] = useState('chat');
  const [model, setModel] = useState('gpt-4o-mini');

  // Auth-derived identity (or demo fallback)
  const [tenant, setTenant] = useState('demo-tenant');
  const [userId, setUserId] = useState('demo-user');
  const [user, setUser] = useState(null);

  // Files + UI state
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  // ---- Bootstrap auth (set global token ONCE) ----
  useEffect(() => {
    let sub = null;

    (async () => {
      try {
        const token = await getAccessToken();
        setAuthToken(token);
        setHasToken(!!token);

        const { data } = await supabase.auth.getSession();
        const session = data?.session || null;
        if (session?.user) {
          setUser(session.user);
          const t = session.user.app_metadata?.tenant_id || session.user.id || 'demo-tenant';
          setTenant(t);
          setUserId(session.user.id || 'demo-user');
        } else {
          setUser(null);
          setTenant('demo-tenant');
          setUserId('demo-user');
        }

        sub = supabase.auth.onAuthStateChange(async (_evt, sess) => {
          const tok = sess?.access_token || null;
          setAuthToken(tok);
          setHasToken(!!tok);
          if (sess?.user) {
            setUser(sess.user);
            const t2 = sess.user.app_metadata?.tenant_id || sess.user.id || 'demo-tenant';
            setTenant(t2);
            setUserId(sess.user.id || 'demo-user');
          } else {
            setUser(null);
            setTenant('demo-tenant');
            setUserId('demo-user');
          }
        });
      } catch (e) {
        // If Supabase not configured, stay in demo mode (but backend requiring JWT will 401)
        setAuthToken(null);
        setHasToken(false);
      } finally {
        setAuthReady(true);
      }
    })();

    return () => {
      try { sub?.data?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  const signedIn = !!user;

  // ---- Data helpers ----
  const refreshFiles = useCallback(async () => {
    // Avoid the 401 on first load: only hit the API when we actually have a token
    if (!hasToken) return;
    try {
      const res = await listFiles(tenant, 'kb'); // server may derive tenant from JWT
      setFiles(res.files || []);
    } catch (e) {
      console.error('LIST_FILES_ERROR', e);
    }
  }, [tenant, hasToken]);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  // Upload from Sidebar
  async function handleUpload(selectedFiles) {
    if (!selectedFiles?.length) return;
    if (!hasToken) { alert('Please sign in before uploading.'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      selectedFiles.forEach(f => fd.append('file', f));
      const res = await ingestFormData(fd, tenant, 'kb');
      if (!res?.ok) alert(res?.error || 'Upload failed');
      await refreshFiles();
      setActiveTab('library');
    } catch (e) {
      console.error('INGEST_UI_ERROR', e);
      alert(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!id) return;
    if (!hasToken) { alert('Please sign in before deleting.'); return; }
    if (!confirm('Delete this file and its chunks?')) return;
    try {
      await deleteFileApi(id, tenant, 'kb');
      await refreshFiles();
    } catch (e) {
      console.error('DELETE_FILE_ERROR', e);
      alert(e.message || 'Delete failed');
    }
  }

  async function handleAsk(q) {
    // ask works with/without auth depending on your backend; if auth is required it will use the global token
    return ask(q, { tenant_id: tenant, project_id: 'kb', user_id: userId, top_k: 8 });
  }

  // Sign in/out (Google example)
  async function handleSignIn() {
    try { await supabase.auth.signInWithOAuth({ provider: 'google' }); }
    catch (e) { alert(e.message || 'Sign-in failed'); }
  }
  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setAuthToken(null);
      setHasToken(false);
      setUser(null);
      setTenant('demo-tenant');
      setUserId('demo-user');
      setFiles([]);
    } catch (e) {
      alert(e.message || 'Sign-out failed');
    }
  }

  return (
    <div className="h-screen grid grid-cols-[18rem_1fr]">
      <Sidebar
        onFilesSelected={handleUpload}
        model={model}
        setModel={setModel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        signedIn={signedIn}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        userEmail={user?.email || null}
      />

      <div className="flex flex-col">
        <div className="h-12 border-b border-gray-800 flex items-center px-4 justify-between">
          <div className="font-medium">Knowledge Chat</div>
          <div className="text-sm text-[var(--muted)]">
            {loading
              ? 'Uploading…'
              : signedIn
                ? `Signed in${user?.email ? ` as ${user.email}` : ''}`
                : 'Demo mode'}
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'chat' ? (
            <Chat onAsk={handleAsk} />
          ) : (
            <div className="h-full overflow-auto">
              <div className="border-b border-gray-800 flex items-center justify-between px-3 py-2">
                <div className="text-sm text-[var(--muted)]">
                  Tenant: <span className="text-teal-300">{tenant}</span> · Project:{' '}
                  <span className="text-teal-300">kb</span>
                </div>
                <button
                  onClick={refreshFiles}
                  className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10"
                  title="Refresh file list"
                  disabled={!hasToken}
                >
                  Refresh
                </button>
              </div>

              {!authReady ? (
                <div className="p-3 text-sm text-[var(--muted)]">Checking session…</div>
              ) : !hasToken ? (
                <div className="p-3 text-sm text-[var(--muted)]">Sign in to view your library.</div>
              ) : files?.length === 0 ? (
                <div className="p-3 text-sm text-[var(--muted)]">
                  No files yet. Upload PDFs or TXT from the left.
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-3 py-2">
                      <div className="truncate">
                        <div className="text-sm font-medium truncate">{f.filename}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {f.created_at ? new Date(f.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-xs px-2 py-1 border border-red-400/40 text-red-300 bg-red-500/10 rounded hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
