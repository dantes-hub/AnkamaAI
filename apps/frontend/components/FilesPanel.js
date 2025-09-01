export default function FilesPanel({ files=[] }) {
    return (
      <div className="p-4 chat-wrap grid gap-2">
        {files.length===0 && <div className="text-sm text-muted">No files yet. Upload from the left.</div>}
        {files.map(f=>(
          <div key={f.id} className="glass rounded-xl2 p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{f.filename}</div>
              <div className="text-xs text-muted">{new Date(f.created_at).toLocaleString()}</div>
            </div>
            {f.pages ? <div className="text-xs text-muted">{f.pages}p</div> : null}
          </div>
        ))}
      </div>
    );
  }
  