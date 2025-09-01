import { useEffect, useRef, useState } from 'react';
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  CloudArrowUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

function loadChats(){ try{ return JSON.parse(localStorage.getItem('ankhai_chats')||'[]'); }catch{return[];} }
function saveChats(list){ localStorage.setItem('ankhai_chats', JSON.stringify(list)); }
function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

export default function Sidebar({
  chatId, setChatId,
  onFilesSelected,
  model, setModel,
  activeTab, setActiveTab,
}) {
  const [chats, setChats] = useState([]);
  const [drag, setDrag] = useState(false);
  const fileInp = useRef(null);

  useEffect(()=> setChats(loadChats()), []);

  function createChat(){
    const id=newId();
    const item={id,title:'New chat',updatedAt:Date.now()};
    const list=[item, ...loadChats()];
    saveChats(list); setChats(list);
    localStorage.setItem(`ankhai_chat_${id}`, JSON.stringify([]));
    setChatId(id); setActiveTab('chat');
  }

  function deleteChat(id){
    localStorage.removeItem(`ankhai_chat_${id}`);
    const list = loadChats().filter(c=>c.id!==id);
    saveChats(list); setChats(list);
    if (chatId === id){
      if (list.length) setChatId(list[0].id);
      else createChat();
    }
  }

  async function handleFiles(files){
    if (!files?.length) return;
    await onFilesSelected(files);
    setActiveTab('library');
  }

  const NavBtn = ({ active, Icon, children, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
        transition-colors border
        ${active
          ? 'bg-white/10 border-white/10 text-white'
          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/8'}`}
    >
      <Icon className="h-4 w-4 opacity-80" />
      <span className="truncate">{children}</span>
    </button>
  );

  return (
    <div className="w-72 border-r border-stroke glass h-screen p-3 flex flex-col gap-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="font-semibold tracking-wide">AnkhAI Console</div>
        <button onClick={createChat} className="text-accent hover:opacity-80" title="New chat">
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>

      {/* sections */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted px-1 mb-2">Sections</div>
        <div className="grid gap-2">
          <NavBtn active={activeTab==='chat'} Icon={ChatBubbleLeftRightIcon} onClick={()=>setActiveTab('chat')}>
            Chats
          </NavBtn>
          <NavBtn active={activeTab==='library'} Icon={RectangleStackIcon} onClick={()=>setActiveTab('library')}>
            Library
          </NavBtn>
        </div>
      </div>

      {/* chats list — only when Chats is active */}
      {activeTab==='chat' && (
        <div className="flex-1 overflow-auto space-y-1">
          {chats.map(c=>(
            <div
              key={c.id}
              onClick={()=>{ setChatId(c.id); }}
              className={`group px-3 py-2 rounded-lg border cursor-pointer flex items-center justify-between
                ${chatId===c.id ? 'bg-accent/15 border-accent/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              <div className="min-w-0">
                <div className="truncate">{c.title}</div>
                <div className="text-[10px] text-muted">{new Date(c.updatedAt).toLocaleString()}</div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                title="Delete chat"
                onClick={(e)=>{ e.stopPropagation(); deleteChat(c.id); }}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* drop zone — only when Library is active */}
      {activeTab==='library' && (
        <div
          onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e)=>{e.preventDefault(); setDrag(false); handleFiles(Array.from(e.dataTransfer.files||[]));}}
          className={`rounded-xl2 border-2 border-dashed p-5 text-center cursor-pointer
            ${drag ? 'border-accent/70 bg-accent/10' : 'border-white/15 bg-white/5'}`}
          onClick={()=>fileInp.current?.click()}
        >
          <CloudArrowUpIcon className="h-6 w-6 mx-auto mb-2 text-accent" />
          <div className="text-sm">Drop files here</div>
          <div className="text-xs text-muted">or click to choose</div>
          <input ref={fileInp} type="file" multiple hidden onChange={(e)=>handleFiles(Array.from(e.target.files||[]))}/>
        </div>
      )}

      {/* model select */}
      <div>
        <label className="text-xs text-muted">Model</label>
        <select value={model} onChange={e=>setModel(e.target.value)}
          className="mt-1 w-full bg-black/20 border border-white/10 rounded-xl2 p-2">
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
      </div>
    </div>
  );
}
