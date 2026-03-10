import React, { useState } from 'react';
import { Upload, FileCode, Search, Download, CheckCircle2, Loader2, Sparkles, Github, Code2, Zap, Layout } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark', suppressErrorRendering: true });

const MermaidChart = ({ code }) => {
  const containerRef = React.useRef(null);
  const [hasError, setHasError] = React.useState(false);

  const cleanupMermaidBombs = () => {
    document.querySelectorAll('[id^="dmermaid-"]').forEach(el => el.remove());
  };

  React.useEffect(() => {
    if (containerRef.current && !hasError) {
      try {
        mermaid.parse(code).then((isValid) => {
          if (isValid) {
             const id = `mermaid-${Math.random().toString(36).substring(7)}`;
             mermaid.render(id, code, containerRef.current)
               .then(({ svg }) => {
                 if (containerRef.current) containerRef.current.innerHTML = svg;
                 cleanupMermaidBombs();
               })
               .catch((err) => {
                 console.error("Mermaid render rejected", err);
                 setHasError(true);
                 cleanupMermaidBombs();
               });
          } else {
             setHasError(true);
             cleanupMermaidBombs();
          }
        }).catch((err) => {
          console.error("Mermaid parse rejected", err);
          setHasError(true);
          cleanupMermaidBombs();
        });
      } catch (err) {
        console.error("Mermaid syntax error", err);
        setHasError(true);
        cleanupMermaidBombs();
      }
    }
  }, [code, hasError]);

  if (hasError) {
    return (
      <div className="my-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 shadow-inner">
        <div className="flex items-center gap-3 text-red-400 mb-3 font-semibold text-lg">
          <span className="text-xl">⚠️</span> Mermaid Syntax Error - Highlighting Raw Code Instead:
        </div>
        <pre className="overflow-x-auto text-sm text-red-200 bg-black/50 p-5 rounded-xl border border-red-500/20 max-h-[400px]">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return <div ref={containerRef} className="mermaid-container my-8 flex justify-center bg-black/40 p-6 rounded-xl border border-white/10 overflow-x-auto shadow-inner" />;
};

const BACKEND_URL = 'http://localhost:5000/api';

function App() {
  const [activeTab, setActiveTab] = useState('zip');
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [readmeContent, setReadmeContent] = useState('');
  const [error, setError] = useState('');
  const [detectedLanguages, setDetectedLanguages] = useState([]);
  
  // GitHub Export State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [githubPushRepo, setGithubPushRepo] = useState('');
  const [githubPushBranch, setGithubPushBranch] = useState('main');
  const [isPushing, setIsPushing] = useState(false);
  const [githubPushMessage, setGithubPushMessage] = useState('');

  const extensionToLanguage = {
    js: { name: 'JavaScript', color: 'bg-yellow-400' },
    jsx: { name: 'React', color: 'bg-cyan-400' },
    ts: { name: 'TypeScript', color: 'bg-blue-500' },
    tsx: { name: 'React/TS', color: 'bg-blue-400' },
    py: { name: 'Python', color: 'bg-green-500' },
    java: { name: 'Java', color: 'bg-red-500' },
    c: { name: 'C', color: 'bg-slate-500' },
    cpp: { name: 'C++', color: 'bg-blue-600' },
    cs: { name: 'C#', color: 'bg-green-600' },
    go: { name: 'Go', color: 'bg-cyan-500' },
    rs: { name: 'Rust', color: 'bg-orange-500' },
    php: { name: 'PHP', color: 'bg-indigo-400' },
    rb: { name: 'Ruby', color: 'bg-red-600' },
    html: { name: 'HTML', color: 'bg-orange-400' },
    css: { name: 'CSS', color: 'bg-blue-300' },
    json: { name: 'JSON', color: 'bg-slate-400' },
    md: { name: 'Markdown', color: 'bg-slate-300' },
    sh: { name: 'Shell', color: 'bg-green-400' },
    yaml: { name: 'YAML', color: 'bg-gray-400' },
    yml: { name: 'YAML', color: 'bg-gray-400' }
  };

  const analyzeZip = async (selectedFile) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(selectedFile);
      const extCounts = {};
      let totalAssessedFiles = 0;

      Object.keys(contents.files).forEach((filename) => {
        if (!contents.files[filename].dir) {
          const parts = filename.split('/');
          const fileOnly = parts[parts.length - 1];
          const nameParts = fileOnly.split('.');
          if (nameParts.length > 1) {
             const ext = nameParts.pop().toLowerCase();
             if (extensionToLanguage[ext]) {
               extCounts[ext] = (extCounts[ext] || 0) + 1;
               totalAssessedFiles++;
             }
          }
        }
      });

      if (totalAssessedFiles > 0) {
        const langsArr = Object.entries(extCounts)
          .map(([ext, count]) => ({
             ...extensionToLanguage[ext],
             count,
             percentage: Math.round((count / totalAssessedFiles) * 100)
          }))
          .filter(l => l.percentage > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
          
        setDetectedLanguages(langsArr);
      } else {
        setDetectedLanguages([]);
      }
    } catch (err) {
      console.error("Error parsing ZIP for languages:", err);
      setDetectedLanguages([]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setDetectedLanguages([]);
      analyzeZip(selectedFile);
    }
  };

  const generateReadme = async () => {
    setError('');
    setReadmeContent('');
    setIsGenerating(true);

    try {
      if (activeTab === 'zip') {
        if (!file) {
          throw new Error('Please upload a ZIP file first.');
        }
        const formData = new FormData();
        formData.append('projectZip', file);

        const response = await axios.post(`${BACKEND_URL}/generate/zip`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setReadmeContent(response.data.readme);
      } else {
        if (!repoUrl || !repoUrl.includes('github.com')) {
          throw new Error('Please enter a valid GitHub repository URL.');
        }
        const response = await axios.post(`${BACKEND_URL}/generate/github`, { repoUrl });
        setReadmeContent(response.data.readme);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const pushToGitHub = () => {
    setGithubPushMessage('');
    setShowGithubModal(true);
  };

  const executeGithubPush = async () => {
    if (!githubToken || !githubPushRepo) {
      setGithubPushMessage('⚠️ Token and Repo exactly required.');
      return;
    }
    setIsPushing(true);
    setGithubPushMessage('');
    try {
      const cleanRepo = githubPushRepo.replace('https://github.com/', '').trim();
      const apiUrl = `https://api.github.com/repos/${cleanRepo}/contents/README.md`;
      let sha = null;
      
      try {
        const getRes = await axios.get(apiUrl, {
          headers: { Authorization: `token ${githubToken}` }
        });
        sha = getRes.data.sha;
      } catch (e) {
        // Status 404 is fine, file does not exist yet
      }

      const contentEncoded = btoa(unescape(encodeURIComponent(readmeContent)));
      const payload = {
        message: 'docs: auto-generated README.md via AI',
        content: contentEncoded,
        branch: githubPushBranch
      };
      if (sha) payload.sha = sha;

      await axios.put(apiUrl, payload, {
        headers: { Authorization: `token ${githubToken}` }
      });

      setGithubPushMessage('✅ Successfully pushed to GitHub!');
      setTimeout(() => {
        setShowGithubModal(false);
        setGithubPushMessage('');
      }, 2500);
    } catch (err) {
      console.error(err);
      setGithubPushMessage('❌ Failed to push. Check token permissions, branch name, or repo path.');
    } finally {
      setIsPushing(false);
    }
  };

  const downloadReadme = () => {
    if (!readmeContent) return;
    const blob = new Blob([readmeContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      
      {/* Dynamic Background Effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none animate-pulse-slow object-cover" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none animate-pulse-slow object-cover" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay"></div>

      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="border-b border-white/5 sticky top-0 z-50 backdrop-blur-2xl bg-[#070709]/60"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="relative group">
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl blur group-hover:blur-lg transition-all duration-300 opacity-60"></div>
               <div className="relative bg-gradient-to-br from-slate-900 to-black p-2.5 rounded-xl text-white border border-white/10 shadow-2xl">
                  <Sparkles size={22} className="text-indigo-400" />
               </div>
             </div>
             <h1 className="text-2xl font-bold text-white tracking-tight">
               Auto-Read-Me <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 font-black ml-1">Pro</span>
             </h1>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10 min-h-[calc(100vh-80px)] flex flex-col justify-center">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-sm font-medium mb-10 backdrop-blur-md shadow-lg shadow-indigo-500/10"
          >
            <Zap size={16} className="fill-indigo-400 text-indigo-400 animate-pulse" /> 
            Powered by next-gen AI models
          </motion.div>

          {/* Glowing AI Orb Dashboard Feature */}
          <div className="flex justify-center mb-12">
            <div className="relative group">
              <motion.div 
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.4, 0.7, 0.4],
                  rotate: [0, 90, 180, 270, 360]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-500 rounded-full blur-2xl opacity-60 mix-blend-screen"
              />
              <motion.div 
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="relative w-28 h-28 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.5)] z-10"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className="text-indigo-300 w-12 h-12" />
                </motion.div>
                {/* Secondary inner glow */}
                <div className="absolute inset-2 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-full blur-md"></div>
              </motion.div>
            </div>
          </div>

          <h2 className="text-5xl sm:text-7xl font-black text-white mb-8 tracking-tight leading-[1.15]">
            Documentation that <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 animate-gradient-x">writes itself perfectly.</span>
          </h2>
          <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto font-light">
            Drop your project files or paste a GitHub link. Our AI analyzes your entire architecture and generates a comprehensive, beautiful README.md instantly.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full pb-10">
          
          {/* Input Panel */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-5 flex flex-col gap-6"
          >
            {/* Animated Tab Selectors (The "Selectors" requested by User) */}
            <div className="flex relative bg-white/5 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
              {['zip', 'github'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setDetectedLanguages([]);
                  }}
                  className={`relative flex-1 py-4 px-4 text-sm font-bold rounded-xl transition-colors duration-300 flex items-center justify-center gap-3 z-10 ${
                    activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="active-tab-indicator"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/80 to-violet-600/80 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-20 flex items-center gap-2">
                    {tab === 'zip' ? <Upload size={18} /> : <Github size={18} />}
                    {tab === 'zip' ? 'Upload Project' : 'GitHub Repo'}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden relative">
              <div className="p-8 min-h-[340px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {/* ZIP Upload View */}
                  {activeTab === 'zip' && (
                    <motion.div
                      key="zip"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-6"
                    >
                      <div className="relative group rounded-3xl">
                        <div className={`absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 rounded-3xl blur-2xl transition-opacity duration-500 ${file ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                        <div className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 bg-black/40 backdrop-blur-sm ${file ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 group-hover:border-white/30 group-hover:bg-white/5'}`}>
                          <input 
                            type="file" 
                            accept=".zip" 
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center gap-5">
                            <motion.div 
                              whileHover={{ scale: 1.1, rotate: file ? 0 : 5 }}
                              className={`p-5 rounded-2xl transition-all duration-300 shadow-xl ${file ? 'bg-indigo-500/20 text-indigo-400 shadow-indigo-500/20' : 'bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10 group-hover:shadow-white/10'}`}
                            >
                              {file ? <CheckCircle2 size={40} className="text-emerald-400" /> : <Upload size={40} />}
                            </motion.div>
                            <div>
                              <p className="font-semibold text-white text-xl">
                                {file ? 'File ready to scan' : 'Drop your .zip here'}
                              </p>
                              <p className="text-sm text-slate-400 mt-2 font-medium">
                                {file ? 'Click or drag to change file' : 'Maximum 50MB. Source code only.'}
                              </p>
                            </div>
                            <AnimatePresence>
                              {file && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 flex flex-col items-center gap-3 w-full"
                                >
                                  <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl text-sm font-semibold shadow-inner">
                                    <FileCode size={16} /> {file.name}
                                  </div>
                                  
                                  {detectedLanguages.length > 0 && (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: 0.1 }}
                                      className="flex flex-wrap justify-center gap-2 mt-2 max-w-[90%]"
                                    >
                                      {detectedLanguages.map((lang, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 shadow-md backdrop-blur-md">
                                          <div className={`w-2.5 h-2.5 rounded-full ${lang.color} shadow-sm`}></div>
                                          {lang.name} <span className="text-slate-400 ml-0.5">{lang.percentage}%</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* GitHub Repo View */}
                  {activeTab === 'github' && (
                    <motion.div
                      key="github"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-6"
                    >
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-slate-300 ml-1">Repository URL</label>
                        <div className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition duration-500"></div>
                          <div className="relative flex items-center bg-black/60 border border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all shadow-inner">
                            <div className="pl-5 pr-3 py-4 text-slate-400">
                              <Search size={20} className="group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input 
                              type="text" 
                              placeholder="https://github.com/username/repo" 
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              className="block w-full py-5 pr-5 bg-transparent outline-none text-white placeholder:text-slate-600 font-medium text-lg"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm shadow-inner backdrop-blur-sm">
                        <Code2 size={24} className="shrink-0 text-violet-400" />
                        <p className="leading-relaxed font-medium mt-0.5">We'll securely clone and analyze the default branch of your public repository to generate context for the AI.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl text-sm font-medium flex gap-3 items-start backdrop-blur-sm">
                        <span className="shrink-0 bg-red-500/20 p-1.5 rounded-lg text-red-400">⚠️</span> 
                        <span className="mt-1">{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generateReadme}
                  disabled={isGenerating || (activeTab === 'zip' && !file) || (activeTab === 'github' && !repoUrl)}
                  className="relative w-full mt-8 group disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl border border-white/20 text-lg">
                    {isGenerating ? (
                       <>
                        <Loader2 size={24} className="animate-spin" /> Scanning & Generating...
                       </>
                    ) : (
                      <>
                        <Sparkles size={24} className="text-indigo-100" /> Generate Documentation
                      </>
                    )}
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Preview Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-7 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 flex flex-col h-[700px] shadow-2xl shadow-black/80 overflow-hidden"
          >
            {/* Window Controls & Header */}
            <div className="border-b border-white/10 px-6 py-5 flex justify-between items-center bg-black/50 backdrop-blur-md">
              <div className="flex items-center gap-5">
                <div className="flex gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
                <div className="font-semibold text-slate-300 text-sm flex items-center gap-2.5 bg-white/5 px-4 py-1.5 rounded-lg border border-white/10 shadow-inner">
                  <Layout size={16} className="text-indigo-400" />
                  <span className="opacity-90">README.md</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={pushToGitHub}
                  disabled={!readmeContent}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-xl text-sm font-bold text-indigo-200 transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg"
                >
                  <Github size={16} /> <span className="hidden sm:inline">Push to GitHub</span>
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={downloadReadme}
                  disabled={!readmeContent}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-black/20"
                >
                  <Download size={18} /> <span className="hidden sm:inline">Download</span>
                </motion.button>
              </div>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8 lg:p-14 prose-container bg-[#070709] relative custom-scrollbar">
              <AnimatePresence mode="wait">
                {readmeContent ? (
                  <motion.div 
                    key="content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="prose prose-invert prose-slate max-w-none 
                               prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                               prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-white/10
                               prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-indigo-100
                               prose-h3:text-xl prose-h3:text-indigo-200/80
                               prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6
                               prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:text-indigo-300 hover:prose-a:underline
                               prose-strong:text-white prose-strong:font-semibold
                               prose-code:text-indigo-200 prose-code:bg-indigo-500/10 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-lg prose-code:border prose-code:border-indigo-500/20 prose-code:font-medium
                               prose-pre:bg-[#030304] prose-pre:border prose-pre:border-white/10 prose-pre:shadow-2xl prose-pre:rounded-2xl prose-pre:p-6
                               prose-li:text-slate-300 prose-li:my-1
                               prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
                               prose-blockquote:border-l-4 prose-blockquote:border-indigo-500/50 prose-blockquote:bg-indigo-500/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:text-slate-400 prose-blockquote:not-italic
                               prose-hr:border-white/10 prose-hr:my-10
                               prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-white/10 prose-th:p-4 prose-th:bg-white/5 prose-th:text-left prose-td:border prose-td:border-white/10 prose-td:p-4
                               [&>*:first-child]:mt-0
                               "
                  >
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          if (!inline && match && match[1] === 'mermaid') {
                            return <MermaidChart code={String(children).replace(/\n$/, '')} />;
                          }
                          return !inline && match ? (
                            <pre className={className} {...props}>
                              <code className={className}>{children}</code>
                            </pre>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {readmeContent}
                    </ReactMarkdown>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-slate-500 space-y-8"
                  >
                    <div className="relative group">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
                      <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="relative p-8 bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-sm"
                      >
                        <Code2 size={64} className="text-indigo-400/40 group-hover:text-indigo-400/60 transition-colors duration-500" />
                      </motion.div>
                    </div>
                    <div className="text-center space-y-3">
                      <p className="text-xl font-bold text-slate-300 tracking-wide">Awaiting your project</p>
                      <p className="max-w-[320px] text-base text-slate-500 leading-relaxed text-center mx-auto font-medium">
                        Upload a zip or paste a link. Your generated documentation will dynamically appear here.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>

      {/* GitHub Push Modal */}
      <AnimatePresence>
        {showGithubModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#09090B] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Github size={28} className="text-indigo-400" /> Push to GitHub
              </h3>
              <p className="text-sm text-slate-400 mb-6">Create or update your <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">README.md</code> directly via the official GitHub API.</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Target Repository <span className="text-indigo-400">*</span></label>
                  <input 
                    type="text" 
                    placeholder="e.g. username/repo" 
                    value={githubPushRepo}
                    onChange={(e) => setGithubPushRepo(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
                
                <div>
                   <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Branch <span className="text-indigo-400">*</span></label>
                   <input 
                     type="text" 
                     placeholder="main" 
                     value={githubPushBranch}
                     onChange={(e) => setGithubPushBranch(e.target.value)}
                     className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                   />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Personal Access Token <span className="text-indigo-400">*</span></label>
                  <input 
                    type="password" 
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                  <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">Generate a token (needs 'repo' scope) ↗</a>
                </div>
              </div>

              {githubPushMessage && (
                <div className={`mb-6 p-3 rounded-xl text-sm font-medium border ${githubPushMessage.includes('❌') || githubPushMessage.includes('⚠️') ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
                  {githubPushMessage}
                </div>
              )}

              <div className="flex gap-3 justify-end mt-2">
                <button 
                  onClick={() => setShowGithubModal(false)}
                  disabled={isPushing}
                  className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeGithubPush}
                  disabled={isPushing || !githubToken || !githubPushRepo}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors disabled:bg-indigo-600/50 disabled:text-white/50"
                >
                  {isPushing ? <><Loader2 size={18} className="animate-spin" /> Pushing...</> : <><Code2 size={18} /> Push Directly</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
