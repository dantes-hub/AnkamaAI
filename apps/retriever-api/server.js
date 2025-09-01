import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Busboy from 'busboy';
import crypto from 'crypto';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as jose from 'jose';

const {
    SUPABASE_URL,
    SUPABASE_JWT_AUD = 'authenticated',
    SUPABASE_JWT_SECRET,  
  } = process.env;
  
  const jwks = SUPABASE_URL
    ? jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/keys`))
    : null;
  
  async function verifySupabaseJWT(token) {
    const { alg } = jose.decodeProtectedHeader(token);
  
    if (alg && alg.startsWith('RS')) {
      if (!jwks) throw new Error('JWKS not configured');
      const { payload } = await jose.jwtVerify(token, jwks, {
        audience: SUPABASE_JWT_AUD,
        algorithms: ['RS256', 'RS384', 'RS512'],
      });
      return payload;
    }
  
    if (alg && alg.startsWith('HS')) {
      if (!SUPABASE_JWT_SECRET) throw new Error('SUPABASE_JWT_SECRET missing');
      const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret, {
        audience: SUPABASE_JWT_AUD,
        algorithms: ['HS256', 'HS384', 'HS512'],
      });
      return payload;
    }
  
    throw new Error(`Unsupported alg: ${alg || 'unknown'}`);
  }
  
  export async function requireAuth(req, res, next) {
    // remove in prod)
    if (!SUPABASE_URL && !SUPABASE_JWT_SECRET) {
      req.user = { id: 'demo-user', email: 'demo@example.com' };
      req.tenant_id = 'demo-tenant';
      return next();
    }
  
    // EventSource 
    let token = null;
    const hdr = req.headers.authorization || '';
    if (hdr.startsWith('Bearer ')) token = hdr.slice(7);
    if (!token && req.query?.access_token) token = String(req.query.access_token);
  
    if (!token) return res.status(401).json({ ok:false, error:'missing_token' });
  
    try {
      const payload = await verifySupabaseJWT(token);
      req.user = { id: payload.sub, email: payload.email };
  
      //  multi-tenant mapping by email domain 
      const domain = (payload.email || '').split('@')[1] || 'demo';
      req.tenant_id = `tenant-${domain}`;
  
      next();
    } catch (e) {
      return res.status(401).json({ ok:false, error:'invalid_token', details: e.message });
    }
  }
  

//  Quotas 
const TENANT_CAP = Number(process.env.TENANT_DAILY_TOKEN_CAP || 150000);
const USER_CAP   = Number(process.env.USER_DAILY_TOKEN_CAP   || 50000);

// pg 
import pkg from 'pg';
const { Pool } = pkg;

// App & CORS
const app = express();
const FRONT = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());
app.use(cors({
  origin: FRONT,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Env / Clients 
const {
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-4o-mini',
  EMBED_MODEL = 'text-embedding-3-small',
  QDRANT_URL = 'http://localhost:6333',
  QDRANT_COLLECTION = 'demo2_chunks',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = '5432',
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
} = process.env;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: QDRANT_URL });
const pg = new Pool({
  host: POSTGRES_HOST,
  port: Number(POSTGRES_PORT),
  database: POSTGRES_DB,
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
});

// Ensure PG is reachable before listening
async function waitPg() {
  for (let i = 0; i < 30; i++) {
    try {
      await pg.query('select 1');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Postgres not reachable');
}

// df-parse 
let pdfParse;
async function parsePdf(buffer) {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  }
  const { text } = await pdfParse(buffer);
  return text || '';
}

//  Qdrant collection
async function ensureCollection() {
  try {
    await qdrant.getCollection(QDRANT_COLLECTION);
  } catch {
    await qdrant.createCollection(QDRANT_COLLECTION, {
      vectors: { size: 1536, distance: 'Cosine' }, // text-embedding-3-small
    });
  }
}
ensureCollection().catch(console.error);

//  Utils 
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function chunkText(text, size = 450, overlap = 90) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += (size - overlap)) {
    const slice = words.slice(i, i + size).join(' ').trim();
    if (slice) chunks.push(slice);
  }
  return chunks;
}

async function embedMany(texts) {
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: texts });
  return res.data.map(d => d.embedding);
}

async function multiQueryRewrites(query, n = 3) {
  const prompt = `Rewrite the user's query into ${n} diverse search queries.
User: ${query}
Output each rewrite on a new line without numbering.`;
  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
  });
  const text = resp.choices[0].message.content || '';
  return text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, n);
}

function mmrRerank(candidates, lambda = 0.7, topK = 8) {
  // candidates
  const sel = [];
  const cand = candidates.slice();
  const scores = cand.map(c => c.score);
  const min = Math.min(...scores), max = Math.max(...scores);
  const norm = cand.map(c => ({ ...c, rel: (max === min ? 1 : (c.score - min) / (max - min)) }));

  while (sel.length < Math.min(topK, norm.length)) {
    let best = null, bestVal = -Infinity;
    for (const c of norm) {
      if (sel.find(s => s.id === c.id)) continue;
      let simToSel = 0;
      for (const s of sel) {
        simToSel = Math.max(
          simToSel,
          (s.payload.file_id === c.payload.file_id && s.payload.page === c.payload.page) ? 1 : 0
        );
      }
      const val = lambda * c.rel - (1 - lambda) * simToSel;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    if (!best) break;
    sel.push(best);
  }
  return sel;
}

//  Quota helpers 
async function todayTokensFor(pgPool, scope, tenant_id, user_id) {
  if (scope === 'tenant') {
    const { rows } = await pgPool.query(
      `select coalesce(sum(tokens_in+tokens_out),0) t
       from requests_log
       where tenant_id=$1 and date_trunc('day', created_at)=date_trunc('day', now())`,
      [tenant_id]
    );
    return Number(rows[0].t || 0);
  } else {
    const { rows } = await pgPool.query(
      `select coalesce(sum(tokens_in+tokens_out),0) t
       from requests_log
       where tenant_id=$1 and user_id=$2 and date_trunc('day', created_at)=date_trunc('day', now())`,
      [tenant_id, user_id]
    );
    return Number(rows[0].t || 0);
  }
}

async function enforceQuota(pgPool, req, res, projected_tokens = 0) {
  const tenantUsed = await todayTokensFor(pgPool, 'tenant', req.tenant_id, req.user?.id);
  if (tenantUsed + projected_tokens > TENANT_CAP) {
    res.status(429).json({ ok: false, error: 'tenant_cap_reached', used: tenantUsed, cap: TENANT_CAP });
    return true;
  }
  const userUsed = await todayTokensFor(pgPool, 'user', req.tenant_id, req.user?.id);
  if (userUsed + projected_tokens > USER_CAP) {
    res.status(429).json({ ok: false, error: 'user_cap_reached', used: userUsed, cap: USER_CAP });
    return true;
  }
  return false;
}

//  Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

//  Quota check (auth + tenant/user scopes) 
app.post('/quota/check', requireAuth, async (req, res) => {
  const projected_tokens = Number(req.body?.projected_tokens || 0);
  const tenantUsed = await todayTokensFor(pg, 'tenant', req.tenant_id, req.user?.id);
  const userUsed   = await todayTokensFor(pg, 'user',   req.tenant_id, req.user?.id);
  const ok = (tenantUsed + projected_tokens) <= TENANT_CAP &&
             (userUsed   + projected_tokens) <= USER_CAP;
  res.json({
    ok,
    tenant: { used: tenantUsed, cap: TENANT_CAP },
    user:   { used: userUsed,   cap: USER_CAP },
  });
});


app.get('/chat/sse', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => res.write(':keep-alive\n\n'), 15000);
  const done = (msg) => { clearInterval(heartbeat); if (msg) res.write(`data: ${JSON.stringify(msg)}\n\n`); res.end(); };

  try {
    const b64 = String(req.query.payload || '');
    if (!b64) return done({ error: 'missing payload' });
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const { messages = [], model = OPENAI_MODEL } = JSON.parse(json);
    if (!Array.isArray(messages) || messages.length === 0) return done({ error: 'no messages' });

    const stream = await openai.chat.completions.create({ model, messages, stream: true });
    res.write(`data: ${JSON.stringify({ ready: true })}\n\n`);
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    done({ done: true });
  } catch (e) {
    done({ error: e?.message || String(e) });
  }
});

app.post('/chat/stream', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => res.write(':keep-alive\n\n'), 15000);
  const done = (msg) => { clearInterval(heartbeat); if (msg) res.write(`data: ${JSON.stringify(msg)}\n\n`); res.end(); };

  try {
    const { messages = [], model = OPENAI_MODEL } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return done({ error: 'No messages' });

    const stream = await openai.chat.completions.create({ model, messages, stream: true });
    res.write(`data: ${JSON.stringify({ ready: true })}\n\n`);
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta || {};
      if (typeof delta.content === 'string' && delta.content.length) {
        res.write(`data: ${JSON.stringify({ delta: delta.content })}\n\n`);
      }
    }
    done({ done: true });
  } catch (e) {
    done({ error: e?.message || String(e) });
  }
});

//  Ingest
app.post('/ingest', requireAuth, async (req, res) => {
  const tenant_id = req.query.tenant_id || req.tenant_id || 'demo-tenant';
  const project_id = req.query.project_id || 'kb';

  const bb = Busboy({ headers: req.headers });
  const files = [];

  bb.on('file', (_name, file, info) => {
    const { filename } = info;
    const chunks = [];
    file.on('data', d => chunks.push(d));
    file.on('end', () => files.push({ filename, buffer: Buffer.concat(chunks) }));
  });

  bb.on('finish', async () => {
    try {
      await ensureCollection();

      let totalChunks = 0;
      for (const f of files) {
        const hash = sha256(f.buffer);

        // Extract text
        let text = '';
        if (f.filename.toLowerCase().endsWith('.pdf')) {
          text = await parsePdf(f.buffer);
        } else {
          text = f.buffer.toString('utf8');
        }

        // Quota guard 
        const estimatedTokens = Math.min(20000, Math.ceil(text.length / 3));
        if (await enforceQuota(pg, req, res, estimatedTokens)) return;

        // Chunk + embed
        const chunks = chunkText(text);
        const embs = await embedMany(chunks);

        // Insert file row
        const fileRow = await pg.query(
          `insert into files(tenant_id, project_id, filename, sha256, pages)
           values ($1,$2,$3,$4,$5) returning id`,
          [tenant_id, project_id, f.filename, hash, 0]
        );
        const file_id = fileRow.rows[0].id;

        // Upsert points 
        const points = embs.map((v, i) => ({
          id: undefined,
          vector: v,
          payload: {
            tenant_id, project_id, file_id,
            page: 1,
            chunk_index: i,
            sha256: hash,
            filename: f.filename,
            text: chunks[i],
          },
        }));
        await qdrant.upsert(QDRANT_COLLECTION, { points });
        totalChunks += chunks.length;

        // Log usage 
        pg.query(
          `insert into requests_log(tenant_id,user_id,tokens_in,tokens_out,cost_usd)
           values($1,$2,$3,$4,$5)`,
          [tenant_id, req.user?.id || 'unknown', estimatedTokens, 0, 0.0]
        ).catch(() => {});
      }

      res.json({ ok: true, files: files.length, chunks: totalChunks });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  req.pipe(bb);
});

//  Retrieval core
async function retrieveCore({ tenant_id, project_id, query, top_k = 8, mmr_lambda = 0.7 }) {
  await ensureCollection();

  const rewrites = await multiQueryRewrites(query, 3);
  const queries = [query, ...rewrites];

  const results = [];
  for (const q of queries) {
    const emb = (await openai.embeddings.create({ model: EMBED_MODEL, input: [q] }))
      .data[0].embedding;

    const r = await qdrant.search(QDRANT_COLLECTION, {
      vector: emb,
      limit: Math.max(top_k, 12),
      with_payload: true,
      filter: {
        must: [
          { key: 'tenant_id',  match: { value: tenant_id } },
          { key: 'project_id', match: { value: project_id } },
        ],
      },
    });

    for (const p of r) {
      results.push({ id: p.id, score: p.score, payload: p.payload });
    }
  }

  // Dedupe 
  const key = x => `${x.payload.file_id}:${x.payload.chunk_index}`;
  const dedup = Object.values(results.reduce((m, x) => {
    const k = key(x);
    if (!m[k] || x.score > m[k].score) m[k] = x;
    return m;
  }, {}));

  return mmrRerank(dedup, Number(mmr_lambda), Number(top_k));
}

//  retrieve 
app.post('/retrieve', requireAuth, async (req, res) => {
  try {
    const { project_id = 'kb', query, top_k = 8, mmr_lambda = 0.7 } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query required' });

    const hits = await retrieveCore({
      tenant_id: req.tenant_id,
      project_id,
      query,
      top_k,
      mmr_lambda,
    });

    res.json({ ok: true, hits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

//  ask 
app.post('/ask', requireAuth, async (req, res) => {
  const { project_id = 'kb', query, top_k = 8 } = req.body || {};
  if (!query) return res.status(400).json({ ok: false, error: 'query required' });

  try {
    // Quota 
    if (await enforceQuota(pg, req, res, 1000)) return;

    const hits = await retrieveCore({
      tenant_id: req.tenant_id,
      project_id,
      query,
      top_k,
    });

    const ctx = hits.map((h, i) =>
      `[${i + 1}] (file:${h.payload.filename} page:${h.payload.page})\n${h.payload.text || '(no snippet)'}`
    ).join('\n\n');

    const prompt = `You are a helpful assistant for a company knowledge base.
Use only the provided context if relevant. Cite sources inline like [1], [2].

Context:
${ctx}

Question: ${query}
Answer:`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    // Log usage
    const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0 };
    pg.query(
      `insert into requests_log(tenant_id,user_id,tokens_in,tokens_out,cost_usd)
       values($1,$2,$3,$4,$5)`,
      [req.tenant_id, req.user?.id || 'unknown', usage.prompt_tokens || 0, usage.completion_tokens || 0, 0.0]
    ).catch(() => {});

    res.json({
      ok: true,
      answer: completion.choices[0].message.content,
      sources: hits.map((h, i) => ({
        n: i + 1,
        file: h.payload.filename,
        page: h.payload.page,
        score: h.score,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

//  Tiny files API 
app.get('/files', requireAuth, async (req, res) => {
  const project_id = req.query.project_id || 'kb';
  try {
    const { rows } = await pg.query(
      `select id, filename, pages, created_at
       from files
       where tenant_id=$1 and project_id=$2
       order by created_at desc`,
      [req.tenant_id, project_id]
    );
    res.json({ ok: true, files: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/files/:id', requireAuth, async (req, res) => {
  const file_id = req.params.id;
  try {
    // Delete vectors by filter
    await qdrant.delete(QDRANT_COLLECTION, {
      filter: { must: [{ key: 'file_id', match: { value: file_id } }] },
    }).catch(() => {}); 

    // Delete metadata
    await pg.query(`delete from files where tenant_id=$1 and id=$2`, [req.tenant_id, file_id]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

//  Start 
waitPg()
  .then(() =>
    app.listen(8000, () => console.log('retriever-api on :8000'))
  )
  .catch(err => {
    console.error('PG wait failed', err);
    process.exit(1);
  });
