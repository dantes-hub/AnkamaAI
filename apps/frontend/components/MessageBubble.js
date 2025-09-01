import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ClipboardIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

export default function MessageBubble({ role, content, sources=[], onCopy, onRegen }) {
  const me = role === 'user';
  const initials = me ? 'YOU' : 'AI';
  return (
    <div className={`msg ${me?'me':''}`}>
      <div className={`avatar ${me?'me':''}`}>{initials}</div>
      <div className={`inline-block max-w-3xl px-4 py-3 rounded-xl2 border ${me
          ? 'bg-accent/15 border-accent/30'
          : 'glass'
        }`}>
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content || ''}
          </ReactMarkdown>
        </div>

        {sources.length>0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {sources.map((s,i)=>(
              <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10"
                title={`${s.file} • page ${s.page}`}>[{s.n ?? i+1}] {s.file} p{s.page}</span>
            ))}
          </div>
        )}

        {!me && (
          <div className="mt-2 msg-actions flex gap-3 text-xs text-muted">
            <button className="hover:text-white flex items-center gap-1" onClick={onCopy}>
              <ClipboardIcon className="h-4 w-4" /> Copy
            </button>
            <button className="hover:text-white flex items-center gap-1" onClick={onRegen}>
              <ArrowPathIcon className="h-4 w-4" /> Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
