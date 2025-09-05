let AUTH_TOKEN = null;
export function setAuthToken(t) { AUTH_TOKEN = t || null; }

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

function authHeaders() {
  return AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};
}

export async function listFiles(tenantId, projectId, token) {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/files?tenant_id=${tenantId}&project_id=${projectId}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}, // ← important
    });
    if (!res.ok) throw new Error(`files failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

export async function ingest(formData, tenant='demo-tenant', project='kb') {
    const url = `${BASE}/ingest?tenant_id=${tenant}&project_id=${project}`;
    const res = await fetch(url, { method: 'POST', body: formData, headers: authHeaders() });
    if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`ingest failed: ${res.status} ${text}`);
    }
    return res.json();
}

export async function ask(query, opts={}) {
  const body = { tenant_id:'demo-tenant', project_id:'kb', user_id:'demo-user', query, top_k:8, ...opts };
  const res = await fetch(`${BASE}/ask`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  return res.json();
}


function b64utf8(objOrStr) {
  const s = typeof objOrStr === 'string' ? objOrStr : JSON.stringify(objOrStr);
  if (typeof window === 'undefined') {
    // Node path
    return Buffer.from(s, 'utf8').toString('base64');
  }
  // Browser path
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function streamChatES(messages, { model } = {}) {
  const payloadObj = { messages: messages.slice(-12), model };
  const payload = b64utf8(payloadObj);

  const qs = new URLSearchParams({ payload });
  if (AUTH_TOKEN) qs.set('access_token', AUTH_TOKEN);

  const url = `${BASE}/chat/sse?${qs.toString()}`;
  const es = new EventSource(url);

  const handlers = { token:null, done:null, err:null };

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.delta && handlers.token) handlers.token(data.delta);
      if (data.done || data.error) {
        handlers.done?.(data);
        es.close();
      }
    } catch {}
  };
  es.onerror = (e) => { handlers.err?.(e); es.close(); };

  return {
    onToken(cb){ handlers.token = cb; return this; },
    onDone(cb){ handlers.done = cb; return this; },
    onError(cb){ handlers.err = cb; return this; },
    close(){ es.close(); }
  };
}
