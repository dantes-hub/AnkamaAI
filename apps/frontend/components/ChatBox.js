import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { PaperAirplaneIcon, ClipboardIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { streamChatES } from '../lib/api';  

function loadMeta() { try { return JSON.parse(localStorage.getItem('ankhai_chats')||'[]'); } catch { return []; } }
function saveMeta(list){ localStorage.setItem('ankhai_chats', JSON.stringify(list)); }
function loadMsgs(id){ try { return JSON.parse(localStorage.getItem(`ankhai_chat_${id}`)||'[]'); } catch { return []; } }
function saveMsgs(id, msgs){ localStorage.setItem(`ankhai_chat_${id}`, JSON.stringify(msgs)); }

export default function ChatBox({ chatId, onAsk, model='gpt-4o-mini' }) {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const persistTick = useRef(0);   // throttle persist during stream

  // load messages for the active chat
  useEffect(()=> {
    if (!chatId) { setItems([]); return; }
    setItems(loadMsgs(chatId));
  }, [chatId]);

  // auto-scroll to bottom on new messages
  useEffect(()=>{
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  function persist(msgs){
    if (!chatId) return;
    saveMsgs(chatId, msgs);
    // update list meta (title on first user message)
    const meta = loadMeta();
    const idx = meta.findIndex(m => m.id===chatId);
    if (idx>-1) {
      if (!meta[idx].title || meta[idx].title==='New chat') {
        const firstUser = msgs.find(m => m.role==='user');
        if (firstUser) meta[idx].title = firstUser.content.slice(0, 48);
      }
      meta[idx].updatedAt = Date.now();
      saveMeta(meta);
    }
  }

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;

    const mine = [...items, { role:'user', content:q }];
    setItems(mine); persist(mine); setInput(''); setBusy(true);

    // create assistant bubble immediately
    const assistant = { role:'assistant', content:'', sources:[] };
    setItems([...mine, assistant]);

    try {
      const history = mine.map(m => ({ role:m.role, content:m.content }));
      const stream = streamChatES(history, { model });

      let acc = '';
      let raf = null;
      const flush = () => {
        assistant.content = acc || '…';
        setItems([...mine, assistant]);
        // throttle persistence (every ~400ms)
        const now = Date.now();
        if (now - persistTick.current > 400) {
          persistTick.current = now;
          persist([...mine, { ...assistant }]);
        }
        raf = null;
      };

      stream
        .onToken(tok => {
          acc += tok;
          if (!raf) raf = requestAnimationFrame(flush);
        })
        .onDone(async () => {
          if (raf) flush();
          // final persist to lock in
          persist([...mine, { ...assistant, content: acc }]);

          // fetch citations after stream
          if (typeof onAsk === 'function') {
            try {
              const res = await onAsk(q);
              if (res?.sources?.length) {
                assistant.sources = res.sources;
                const finalMsgs = [...mine, assistant];
                setItems(finalMsgs);
                persist(finalMsgs);
              }
            } catch {}
          }
          setBusy(false);
        })
        .onError(err => {
          assistant.content = `⚠️ Stream error: ${err.message}`;
          const finalMsgs = [...mine, assistant];
          setItems(finalMsgs); persist(finalMsgs); setBusy(false);
        });

    } catch (err) {
      const finalMsgs = [...mine, { role:'assistant', content:`⚠️ Stream error: ${err?.message || String(err)}` }];
      setItems(finalMsgs); persist(finalMsgs); setBusy(false);
    }
  }

  function copy(text){ if (text) navigator.clipboard.writeText(text); }
  function regen(i){
    const prevUser = [...items].slice(0, i).reverse().find(m=>m.role==='user');
    if (prevUser) send(prevUser.content);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* messages */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        {items.map((m, i) => (
          <div key={i} className={m.role==='user' ? 'text-right' : ''}>
            <div className={`bubble-enter inline-block max-w-3xl px-4 py-3 rounded-xl2 border ${m.role==='user'
              ? 'bg-accent/15 border-accent/30'
              : 'glass'}`}>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {m.content || ''}
                </ReactMarkdown>
              </div>

              {m.sources?.length>0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.sources.map((s, n) => (
                    <span key={`${s.file}-${s.page}-${n}`}
                      className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10"
                      title={`${s.file} • page ${s.page}`}>[{s.n ?? n+1}] {s.file} p{s.page}</span>
                  ))}
                </div>
              )}

            {m.role==='assistant' && (
            <div className="mt-2 flex gap-1">
                <button
                className="p-1.5 rounded-md text-muted hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10"
                title="Copy"
                onClick={()=>copy(m.content)}
                >
                <ClipboardIcon className="h-4 w-4" />
                </button>
                <button
                className="p-1.5 rounded-md text-muted hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10"
                title="Regenerate"
                onClick={()=>regen(i)}
                >
                <ArrowPathIcon className="h-4 w-4" />
                </button>
            </div>
            )}
            </div>
          </div>
        ))}
      </div>

      {/* composer */}
      <div className="p-4 border-t border-stroke glass">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
            placeholder="Ask your docs… (Shift+Enter for newline)"
            className="flex-1 bg-black/20 border border-white/10 rounded-xl2 px-3 py-3 outline-none resize-none"
          />
          <button onClick={()=>send()} disabled={busy}
            className="h-12 w-12 rounded-xl2 bg-accent/20 border border-accent/40 grid place-items-center disabled:opacity-50"
            title="Send">
            <PaperAirplaneIcon className="h-5 w-5 text-accent" />
          </button>
        </div>
        <div className="mt-2 text-xs text-muted">
          Enter to send • Shift+Enter for newline {busy && '• thinking…'}
        </div>
      </div>
    </div>
  );
}
