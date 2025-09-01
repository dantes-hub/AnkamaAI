import { useState } from 'react';

export default function Uploader({ onUpload }) {
  const [busy, setBusy] = useState(false);
  async function handle(files) {
    if (!files || files.length===0) return;
    setBusy(true);
    const fd = new FormData();
    files.forEach(f => fd.append('file', f));
    const res = await onUpload(fd);
    setBusy(false);
    alert(res.ok ? `Uploaded! Chunks: ${res.chunks}` : `Error: ${res.error}`);
  }
  return (
    <div className="p-2">
      <button
        onClick={()=>{
          const inp = document.createElement('input');
          inp.type='file'; inp.multiple=true;
          inp.onchange = ()=> handle(Array.from(inp.files||[]));
          inp.click();
        }}
        className="text-sm px-3 py-2 bg-white/5 border border-white/10 rounded"
        disabled={busy}
      >{busy? 'Uploading…':'Choose files'}</button>
    </div>
  );
}
