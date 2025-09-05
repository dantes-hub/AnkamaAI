// apps/frontend/components/Sidebar.js
import {
    ChatBubbleLeftRightIcon,
    RectangleStackIcon,
    ArrowRightOnRectangleIcon,
    ArrowLeftOnRectangleIcon,
    PaperClipIcon,
  } from '@heroicons/react/24/outline';
  import { useRef, useState } from 'react';
  
  function NavBtn({ active, onClick, Icon, children }) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition
          ${active
            ? 'bg-white/10 border-white/20'
            : 'bg-transparent border-white/10 hover:bg-white/5'
          }`}
      >
        <Icon className="h-4 w-4" />
        <span>{children}</span>
      </button>
    );
  }
  
  export default function Sidebar({
    onFilesSelected,
    model, setModel,
    activeTab, setActiveTab,
    signedIn = false,
    onSignIn,
    onSignOut,
    userEmail = null,
  }) {
    const fileInputRef = useRef(null);
    const [pendingNames, setPendingNames] = useState('');
  
    const triggerFile = () => fileInputRef.current?.click();
    const handleFiles = (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setPendingNames(files.map(f => f.name).join(', '));
      onFilesSelected(files);
      e.target.value = '';         // allow re-select same file
      setTimeout(() => setPendingNames(''), 1500);
    };
  
    const safeSetTab = (tab) => (typeof setActiveTab === 'function' ? setActiveTab(tab) : undefined);
  
    return (
      <div className="w-72 bg-[var(--panel)] border-r border-gray-800 p-4 flex flex-col">
        <div className="text-xl font-bold mb-1">AnkhAI Console</div>
        <div className="text-sm text-[var(--muted)] mb-4">OpenWebUI feel • tidy</div>
  
        {/* Auth */}
        <div className="mb-4">
          {signedIn ? (
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 bg-white/5 border border-white/10 rounded hover:bg-white/10"
              title="Sign out"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4" />
              Sign out{userEmail ? ` (${userEmail})` : ''}
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 bg-white/5 border border-white/10 rounded hover:bg-white/10"
              title="Sign in"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign in
            </button>
          )}
        </div>
  
        {/* Model */}
        <label className="text-sm mb-1">Model</label>
        <select
          value={model}
          onChange={e=>setModel(e.target.value)}
          className="bg-black/30 border border-gray-700 rounded p-2 mb-6"
        >
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
        </select>
  
        {/* Sections */}
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] px-1 mb-2">Sections</div>
        <div className="grid gap-2 mb-6">
          <NavBtn active={activeTab==='chat'} Icon={ChatBubbleLeftRightIcon} onClick={()=>safeSetTab('chat')}>
            Chats
          </NavBtn>
          <NavBtn active={activeTab==='library'} Icon={RectangleStackIcon} onClick={()=>safeSetTab('library')}>
            Library
          </NavBtn>
        </div>
  
        {/* Upload (styled button + hidden input) */}
        <div className="text-sm mb-2">Upload Documents</div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt"
          onChange={handleFiles}
          className="hidden"
        />
        <button
          onClick={triggerFile}
          className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 bg-white/5 border border-white/10 rounded hover:bg-white/10"
          title="Choose files"
        >
          <PaperClipIcon className="h-4 w-4" />
          Choose files
        </button>
        <div className="h-5 mt-1 text-xs text-[var(--muted)] truncate">
          {pendingNames ? pendingNames : 'PDF or TXT. Chunks → Qdrant.'}
        </div>
  
        <div className="mt-auto pt-4 text-xs text-[var(--muted)]">
          <div>Branding: <span className="text-teal-300">/components/Sidebar.js</span></div>
          <div>Colors: <span className="text-teal-300">/styles/globals.css</span></div>
        </div>
      </div>
    );
  }
  