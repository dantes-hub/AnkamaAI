import { useEffect, useState } from 'react';

export default function SettingsDrawer({ open, onClose, settings, onChange }) {
  const [local, setLocal] = useState(settings);
  useEffect(()=>setLocal(settings), [settings]);

  function set(k,v){ const next={...local,[k]:v}; setLocal(next); onChange?.(next); }

  return (
    <div className={`${open?'pointer-events-auto':'pointer-events-none'} fixed inset-0 z-40`}>
      {/* backdrop */}
      <div onClick={onClose}
           className={`${open?'opacity-100':'opacity-0'} transition-opacity duration-150
                      absolute inset-0 bg-black/50`}/>
      {/* panel */}
      <div className={`${open?'translate-x-0':'translate-x-full'} transition-transform duration-200
                      absolute right-0 top-0 h-full w-[22rem] glass p-4 overflow-y-auto`}>
        <div className="text-lg font-semibold mb-2">Settings</div>

        <label className="text-xs text-muted">Model</label>
        <select value={local.model} onChange={e=>set('model', e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl2 p-2 mb-3">
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>

        <label className="text-xs text-muted">Top-K</label>
        <input type="number" min="2" max="16" value={local.top_k}
               onChange={e=>set('top_k', Number(e.target.value)||8)}
               className="w-full bg-black/20 border border-white/10 rounded-xl2 p-2 mb-3"/>

        <label className="text-xs text-muted">MMR λ</label>
        <input type="number" step="0.05" min="0" max="1" value={local.mmr_lambda}
               onChange={e=>set('mmr_lambda', Number(e.target.value)||0.5)}
               className="w-full bg-black/20 border border-white/10 rounded-xl2 p-2 mb-3"/>

        <label className="text-xs text-muted">Theme</label>
        <select value={local.theme} onChange={e=>set('theme', e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl2 p-2 mb-3">
          <option value="dark">Dark</option>
          <option value="darker">Darker</option>
        </select>

        <div className="text-xs text-muted mt-6">
          Settings are stored locally for this browser.
        </div>
      </div>
    </div>
  );
}
