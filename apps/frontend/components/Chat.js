import { useState } from 'react';

export default function Chat({ onAsk }) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);

  async function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setItems(prev => [...prev, { role:'user', content:q }]);
    setInput('');
    const res = await onAsk(q);
    setItems(prev => [...prev, { role:'assistant', content: res.answer, sources: res.sources||[] }]);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {items.map((m, i) => (
          <div key={i} className={m.role==='user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-3xl px-4 py-3 rounded-2xl ${m.role==='user'?'bg-teal-600/20 border border-teal-500/40':'bg-white/5 border border-white/10'}`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.sources && m.sources.length>0 && (
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Sources: {m.sources.map(s => `[${s.n} ${s.file} p${s.page}]`).join(' ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-800 flex gap-2">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=> e.key==='Enter' && send()}
          placeholder="Ask your docs…"
          className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-3"
        />
        <button onClick={send} className="px-4 py-3 bg-teal-500/20 border border-teal-400/40 rounded">
          Send
        </button>
      </div>
    </div>
  );
}
