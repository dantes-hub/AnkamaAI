import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ChatBox from '../components/ChatBox';
import FilesPanel from '../components/FilesPanel';
import SettingsDrawer from '../components/SettingsDrawer';
import PromptChips from '../components/PromptChips';
import { ingest, ask, listFiles } from '../lib/api';

function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function getMsgs(id){ try { return JSON.parse(localStorage.getItem(`ankhai_chat_${id}`)||'[]'); } catch { return []; } }

export default function Home() {
  const [model, setModel] = useState('gpt-4o-mini');
  const [chatId, setChatId] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); 
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(()=>({
    model: 'gpt-4o-mini', top_k: 8, mmr_lambda: 0.5, theme: 'dark'
  }));
  const [files, setFiles] = useState([]);

  // bootstrap a chat if none exists
  useEffect(()=>{
    const list = JSON.parse(localStorage.getItem('ankhai_chats')||'[]');
    if (list.length===0){
      const id = newId();
      localStorage.setItem('ankhai_chats', JSON.stringify([{ id, title:'New chat', updatedAt: Date.now() }]));
      localStorage.setItem(`ankhai_chat_${id}`, JSON.stringify([]));
      setChatId(id);
    } else {
      setChatId(list[0].id);
    }
  }, []);

  // keep model in settings in sync
  useEffect(()=> setSettings(s=>({...s, model})), [model]);

  async function handleFilesSelected(filesList){
    const fd = new FormData();
    filesList.forEach(f => fd.append('file', f));
     try {
           const res = await ingest(fd, 'demo-tenant', 'kb');
           const out = await listFiles('demo-tenant', 'kb');
           setFiles(out.files || []);
           return res;
         } catch (e) {
           console.error('INGEST_UI_ERROR', e);
           alert(e.message || 'Upload failed');
           throw e;
         }
  }

  async function handleAsk(q, opt={}){
    return ask(q, { top_k: settings.top_k, mmr_lambda: settings.mmr_lambda, model, ...opt });
  }

  return (
    <div className="h-screen grid grid-cols-[18rem_minmax(0,1fr)]"> {}
        <Sidebar
        chatId={chatId} setChatId={setChatId}
        onFilesSelected={handleFilesSelected}
        model={model} setModel={setModel}
        activeTab={activeTab} setActiveTab={setActiveTab}
        />

      {/* RIGHT PANE */}
      <div className="flex flex-col min-h-0">     {}
        <Topbar
          onRegenerate={()=>{}}
          onSettings={()=>setSettingsOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && (
        <div className="flex flex-col h-full min-h-0">
            {}
            {!chatId || getMsgs(chatId).length === 0 ? (
            <div className="chat-wrap px-4 shrink-0">
                <PromptChips onPick={(p)=>{
                const ta=document.querySelector('textarea');
                if(ta){ ta.value=p; ta.focus(); ta.setSelectionRange(p.length,p.length); }
                }}/>
            </div>
            ) : null}

            {}
            <div className="chat-wrap flex-1 min-h-0">
            <ChatBox chatId={chatId} onAsk={handleAsk} model={model} />
            </div>
        </div>
        )}

          {activeTab==='library' && <FilesPanel files={files} />}

          {activeTab==='settings' && (
            <div className="p-6 chat-wrap text-sm text-muted">
              Use the drawer (top right) to adjust settings.
            </div>
          )}
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)}
                      settings={settings} onChange={setSettings} />
    </div>
  );
}
