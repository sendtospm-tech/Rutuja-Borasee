import React, { useState, useEffect, useRef } from 'react';
import { PostSize, DesignStyle, GeneratedPost, LogEntry, FileAttachment, SocialPlatform } from './types.ts';
import { geminiService } from './services/geminiService.ts';
import { 
  PlusIcon, 
  PhotoIcon, 
  DocumentTextIcon, 
  ArrowDownTrayIcon, 
  TrashIcon, 
  SparklesIcon, 
  RectangleGroupIcon, 
  CheckCircleIcon, 
  PaperClipIcon, 
  XMarkIcon, 
  ArrowUpTrayIcon, 
  BeakerIcon,
  ShareIcon,
  LinkIcon,
  CheckIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [instructions, setInstructions] = useState('');
  const [referenceImage, setReferenceImage] = useState<FileAttachment | null>(null);
  const [contextAttachments, setContextAttachments] = useState<FileAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [selectedSize, setSelectedSize] = useState<PostSize>(PostSize.INSTAGRAM);
  const [selectedStyles, setSelectedStyles] = useState<DesignStyle[]>([DesignStyle.REALISTIC]);

  // Social Connectivity State
  const [connectedPlatforms, setConnectedPlatforms] = useState<SocialPlatform[]>([
    { id: 'insta', name: 'Instagram', connected: false, color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600', icon: '📸' },
    { id: 'whatsapp', name: 'WhatsApp', connected: false, color: 'bg-emerald-500', icon: '💬' },
    { id: 'linkedin', name: 'LinkedIn', connected: false, color: 'bg-blue-700', icon: '💼' },
    { id: 'facebook', name: 'Facebook', connected: false, color: 'bg-indigo-600', icon: '👥' },
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const contextFilesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog]);

  useEffect(() => {
    const saved = localStorage.getItem('social_posts');
    if (saved) { try { setPosts(JSON.parse(saved)); } catch (e) {} }
    const savedPlatforms = localStorage.getItem('connected_platforms');
    if (savedPlatforms) { try { setConnectedPlatforms(JSON.parse(savedPlatforms)); } catch (e) {} }
  }, []);

  useEffect(() => {
    localStorage.setItem('social_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('connected_platforms', JSON.stringify(connectedPlatforms));
  }, [connectedPlatforms]);

  const togglePlatform = (id: string) => {
    setConnectedPlatforms(prev => prev.map(p => 
      p.id === id ? { ...p, connected: !p.connected } : p
    ));
  };

  const addLog = (message: string, status: 'pending' | 'success' | 'error' = 'pending') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      status,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setActivityLog(prev => [...prev, newEntry]);
  };

  const updateLastLog = (status: 'success' | 'error') => {
    setActivityLog(prev => {
      const logs = [...prev];
      if (logs.length > 0) logs[logs.length - 1].status = status;
      return logs;
    });
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setReferenceImage({
          id: 'ref-' + Math.random().toString(36).substr(2, 5),
          name: file.name,
          data: base64String,
          mimeType: file.type,
          type: 'image'
        });
      };
      reader.readAsDataURL(file);
    }
    if (refImageInputRef.current) refImageInputRef.current.value = '';
  };

  const handleContextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        let type: FileAttachment['type'] = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';
        else if (file.name.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i)) type = 'document';
        setContextAttachments(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 5),
          name: file.name,
          data: base64String,
          mimeType: file.type,
          type
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (contextFilesInputRef.current) contextFilesInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setActivityLog([]);
    const allAttachments = referenceImage ? [referenceImage, ...contextAttachments] : contextAttachments;

    try {
      addLog("Initializing studio tools...");
      const correctedTopic = await geminiService.correctText(topic);
      const correctedInstructions = instructions.trim() ? await geminiService.correctText(instructions) : '';
      setTopic(correctedTopic);
      setInstructions(correctedInstructions);
      updateLastLog('success');

      addLog(`Researching trends and context...`);
      const researchData = await geminiService.researchTopic(correctedTopic, correctedInstructions, allAttachments);
      const templateSuggestions = await geminiService.suggestTemplates(correctedTopic, selectedStyles);
      updateLastLog('success');

      addLog("Crafting high-engagement copy...");
      const { caption, hashtags } = await geminiService.generateCaptions(correctedTopic, researchData.info, correctedInstructions);
      updateLastLog('success');

      addLog(referenceImage ? "Rendering with vision guide..." : "Rendering AI visual...");
      const imageUrl = await geminiService.generateImage(correctedTopic, selectedStyles, selectedSize, correctedInstructions, allAttachments);
      updateLastLog('success');

      const newPost: GeneratedPost = {
        id: Math.random().toString(36).substr(2, 9),
        topic: correctedTopic,
        instructions: correctedInstructions || undefined,
        caption,
        hashtags,
        imageUrl,
        size: selectedSize,
        styles: [...selectedStyles],
        sources: researchData.sources,
        templateSuggestions,
        timestamp: Date.now(),
      };

      setPosts(prev => [newPost, ...prev]);
      setIsGenerating(false);
      setActivityLog([]);
      setTopic(''); setInstructions(''); 
      setReferenceImage(null); setContextAttachments([]);
    } catch (err) {
      console.error(err);
      addLog("Pipeline failed.", 'error');
      setIsGenerating(false);
      setError("Asset generation failed. Please check your API key.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-[420px] bg-white border-b md:border-r border-slate-200 p-6 flex flex-col h-full z-20 shadow-xl overflow-hidden shrink-0">
        <div className="flex items-center gap-2 mb-8 shrink-0">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">SocialSnap</h1>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Design Studio</p>
          </div>
        </div>

        <div className="space-y-8 overflow-y-auto pr-2 flex-grow">
          {/* Inputs Section */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Post Topic</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                placeholder="e.g. Modern Coffee Shop Promo" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Specific Instructions</label>
              <textarea 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium h-24 outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all" 
                placeholder="Target audience, brand colors, mood..." 
                value={instructions} 
                onChange={(e) => setInstructions(e.target.value)} 
              />
            </div>
          </div>

          {/* Design Controls */}
          <div className="space-y-6">
             <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <RectangleGroupIcon className="w-3.5 h-3.5" /> Canvas Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PostSize).map(([key, val]) => (
                  <button 
                    key={key} 
                    onClick={() => setSelectedSize(val as PostSize)}
                    className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1 ${selectedSize === val ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm scale-[1.02]' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <span>{key.replace('_', ' ')}</span>
                    <span className="opacity-60 text-[9px]">{val}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Squares2X2Icon className="w-3.5 h-3.5" /> Design Vibe
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(DesignStyle).map(style => (
                  <button 
                    key={style} 
                    onClick={() => setSelectedStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style])}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${selectedStyles.includes(style) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vision & Knowledge */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <BeakerIcon className="w-3.5 h-3.5" /> Vision Guide
              </label>
              {!referenceImage ? (
                <button onClick={() => refImageInputRef.current?.click()} className="w-full aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all p-4 text-center group">
                  <ArrowUpTrayIcon className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                  <span className="text-[9px] font-bold">Upload Reference</span>
                </button>
              ) : (
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                  <img src={`data:${referenceImage.mimeType};base64,${referenceImage.data}`} className="w-full h-full object-cover" alt="Ref" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                    <button onClick={() => setReferenceImage(null)} className="p-2 bg-white rounded-full text-red-500 shadow-xl active:scale-90 transition-transform"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                </div>
              )}
              <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" onChange={handleRefImageUpload} />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <DocumentTextIcon className="w-3.5 h-3.5" /> Knowledge
              </label>
              <div className="space-y-2">
                {contextAttachments.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <PaperClipIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                    </div>
                    <button onClick={() => setContextAttachments(prev => prev.filter(a => a.id !== file.id))} className="text-slate-300 hover:text-red-500"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => contextFilesInputRef.current?.click()} className="w-full p-3 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-indigo-50/30 transition-all">
                  <PlusIcon className="w-4 h-4" />
                  <span className="text-[9px] font-bold text-center">Attach Doc/PDF</span>
                </button>
                <input type="file" ref={contextFilesInputRef} className="hidden" multiple onChange={handleContextUpload} />
              </div>
            </div>
          </div>

          {/* Social Platform Connectivity */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <ShareIcon className="w-3.5 h-3.5" /> Connections
            </label>
            <div className="grid grid-cols-2 gap-2">
              {connectedPlatforms.map(platform => (
                <button 
                  key={platform.id} 
                  onClick={() => togglePlatform(platform.id)}
                  className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${platform.connected ? `${platform.color} border-transparent text-white shadow-md` : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                >
                  <span className="text-sm">{platform.icon}</span>
                  <div className="text-left">
                    <p className="text-[9px] font-black leading-none">{platform.name}</p>
                    <p className="text-[7px] font-bold opacity-70 uppercase mt-0.5">{platform.connected ? 'Active' : 'Link'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-6 mt-auto shrink-0">
          <button 
            onClick={handleCreatePost} 
            disabled={isGenerating || !topic.trim()} 
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] group"
          >
            {isGenerating ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Rendering Design...</>
            ) : (
              <><SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Generate Campaign Post</>
            )}
          </button>
          {error && <p className="text-center text-[10px] font-bold text-red-500 mt-3">{error}</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto relative bg-slate-50/50">
        {isGenerating && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-50/80 backdrop-blur-md">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh]">
              <div className="p-8 border-b border-slate-100 bg-indigo-600 text-white">
                <h3 className="text-2xl font-black tracking-tight">AI Engine Processing</h3>
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Building your creative assets</p>
              </div>
              <div className="p-8 overflow-y-auto space-y-4 bg-slate-50/50">
                {activityLog.map(log => (
                  <div key={log.id} className="flex gap-4 items-center">
                    {log.status === 'pending' ? (
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    )}
                    <p className={`text-sm ${log.status === 'success' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'}`}>{log.message}</p>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto pb-24">
          <header className="mb-12 flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Your Designs</h2>
              <p className="text-slate-500 mt-1 font-medium">Browse and export your generated campaigns.</p>
            </div>
            <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs font-black text-slate-600 flex items-center gap-2">
              <RectangleGroupIcon className="w-4 h-4 text-indigo-500" />
              {posts.length} {posts.length === 1 ? 'Asset' : 'Assets'}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-12">
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                connectedPlatforms={connectedPlatforms}
                onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))} 
              />
            ))}
            {posts.length === 0 && !isGenerating && (
              <div className="py-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-[3rem] bg-white/40">
                <div className="bg-slate-100 p-6 rounded-full mb-6 text-slate-300">
                  <PhotoIcon className="w-16 h-16" />
                </div>
                <p className="text-slate-500 font-black text-xl">The gallery is empty</p>
                <p className="text-slate-400 text-sm font-bold mt-2">Start creating in the sidebar to fill this space.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const PostCard: React.FC<{ post: GeneratedPost; connectedPlatforms: SocialPlatform[]; onDelete: (id: string) => void }> = ({ post, connectedPlatforms, onDelete }) => {
  const handleShare = (platform: string) => {
    const text = `${post.caption}\n\n${post.hashtags.join(' ')}`;
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'linkedin' || platform === 'facebook') {
      navigator.clipboard.writeText(text);
      alert(`Caption & hashtags copied! Proceed to ${platform} feed.`);
      window.open(platform === 'linkedin' ? 'https://www.linkedin.com/feed/' : 'https://www.facebook.com/', '_blank');
    } else if (platform === 'insta') {
      navigator.clipboard.writeText(text);
      alert("Caption copied! Download the image to upload manually on Instagram.");
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = post.imageUrl;
    link.download = `socialsnap-${post.topic.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col lg:flex-row group">
      {/* Visual Part */}
      <div className="w-full lg:w-[45%] bg-slate-50 p-10 flex flex-col items-center justify-center relative border-b lg:border-b-0 lg:border-r border-slate-100">
        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 translate-y-2 group-hover:translate-y-0">
          <button onClick={handleDownload} title="Download" className="p-3 bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:text-indigo-600 transition-colors"><ArrowDownTrayIcon className="w-6 h-6" /></button>
          <button onClick={() => onDelete(post.id)} title="Delete" className="p-3 bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:text-red-500 transition-colors"><TrashIcon className="w-6 h-6" /></button>
        </div>
        
        <div className="max-w-full relative shadow-2xl rounded-2xl overflow-hidden border-8 border-white bg-white group-hover:scale-[1.02] transition-transform duration-500" 
             style={{ 
               width: '100%',
               aspectRatio: post.size.includes(':') ? post.size.split(':').join(' / ') : '1/1' 
             }}>
          <img src={post.imageUrl} className="w-full h-full object-cover" alt="AI Generated Poster" />
          <div className="absolute bottom-4 left-4 flex gap-1.5">
            <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[9px] font-black rounded-full uppercase tracking-widest">{post.size}</span>
          </div>
        </div>
      </div>

      {/* Copy & Actions Part */}
      <div className="w-full lg:w-[55%] p-10 space-y-6 flex flex-col justify-center bg-white relative">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight pr-12">{post.topic}</h3>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 relative group/caption transition-colors hover:bg-indigo-50/30">
            <span className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase text-slate-400 tracking-widest">Optimized Copy</span>
            <p className="text-lg text-slate-700 leading-relaxed font-semibold italic">"{post.caption}"</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {post.hashtags.map(tag => (
            <span key={tag} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
              {tag}
            </span>
          ))}
        </div>

        {/* Action Hub */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-2">
            <ShareIcon className="w-4 h-4 text-slate-400" />
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Post to Socials</h4>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {connectedPlatforms.some(p => p.connected) ? (
              connectedPlatforms.filter(p => p.connected).map(platform => (
                <button 
                  key={platform.id} 
                  onClick={() => handleShare(platform.id)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[10px] font-black text-white shadow-md ${platform.color} hover:brightness-110 hover:-translate-y-0.5 transition-all`}
                >
                  <span className="text-sm">{platform.icon}</span>
                  Share on {platform.name}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 w-full">
                <LinkIcon className="w-5 h-5 text-slate-300" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Connect accounts in sidebar to enable direct posting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;