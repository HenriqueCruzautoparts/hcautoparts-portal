'use client';

import { useState, useEffect } from 'react';
import { Search, LayoutDashboard, Activity, CheckCircle2, ImagePlus, Camera, X, LogIn, LogOut, User, Headset, Zap, Settings2, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchHistory } from '@/components/SearchHistory';
import { WelcomeModal } from '@/components/WelcomeModal';
import { DashboardWelcomeModal } from '@/components/DashboardWelcomeModal';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { vehicleData } from '@/data/vehicles';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [anonFingerprint, setAnonFingerprint] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'smart' | 'guided'>('smart');
  const [guidedForm, setGuidedForm] = useState({
    montadora: '',
    modelo: '',
    ano: '',
    motor: '',
    peca: ''
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleCancelSearch = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
  };

  // Gera um fingerprint estável do dispositivo/navegador para rastrear limite anônimo no servidor
  // Usa dados disponíveis sem libs externas: userAgent + timezone + idioma + resolução + canvas hash
  const generateFingerprint = async (): Promise<string> => {
    const components = [
      navigator.userAgent,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      navigator.hardwareConcurrency?.toString() || '0',
      new Date().getTimezoneOffset().toString(),
    ];
    // Canvas fingerprint (hash visual do GPU/driver de renderização)
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('AutoParts🔧', 2, 2);
        components.push(canvas.toDataURL().slice(-50));
      }
    } catch (e) {}
    const raw = components.join('|');
    // Hash simples via Web Crypto API
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  };

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      setProfile(data);
    };

    // Gera e armazena o fingerprint do dispositivo (persiste no sessionStorage para evitar recalcular)
    const initFingerprint = async () => {
      let fp = sessionStorage.getItem('ap_fp');
      if (!fp) {
        fp = await generateFingerprint();
        sessionStorage.setItem('ap_fp', fp);
      }
      setAnonFingerprint(fp);
    };
    initFingerprint();

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a native canvas compressor to handle 5MB+ smartphone photos seamlessly
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for Gemini and Payload limits
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality JPEG
            setImagePreview(compressedBase64);
            setImageBase64(compressedBase64);
            setError(null);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalQuery = query;
    let finalImage = imageBase64;

    if (activeTab === 'guided') {
      const { montadora, modelo, ano, motor, peca } = guidedForm;
      if (!montadora || !modelo || !ano || !motor || !peca) {
        setError("Por favor, preencha todos os campos da busca guiada para garantirmos a peça correta.");
        return;
      }
      finalQuery = `${peca} ${montadora} ${modelo} ${ano} ${motor}`;
      finalImage = null; // Buscas guiadas não utilizam imagem para focar na precisão textual
    } else {
      if (!finalQuery.trim() && !finalImage) return;
    }

    // Verificação local rápida no localStorage (cache client-side, não é a fonte de verdade)
    if (!user) {
      const anonSearches = parseInt(localStorage.getItem('autoparts_anon_searches') || '0', 10);
      if (anonSearches >= 5) {
        setError("Você já utilizou suas 5 pesquisas gratuitas. Crie sua conta gratuitamente para continuar pesquisando sem limites!");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Envia também o fingerprint do dispositivo para o servidor validar o limite de forma persistente
      const payload: any = {
        query: finalQuery,
        user_id: user?.id || null,
        user_email: user?.email || null,
        anon_fingerprint: !user ? (anonFingerprint || null) : null,
      };
      if (finalImage) {
        payload.image = finalImage;
      }

      const res = await fetch('/api/pesquisa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await res.json();

      if (!res.ok) {
        // Se o servidor sinalizou que precisa de cadastro, atualiza o contador local também
        if (data.require_signup) {
          localStorage.setItem('autoparts_anon_searches', '5');
        }
        throw new Error(data.error || 'Erro ao buscar dados.');
      }

      // Sincroniza o contador local com o servidor após pesquisa bem-sucedida
      if (!user) {
        const currentCount = parseInt(localStorage.getItem('autoparts_anon_searches') || '0', 10);
        localStorage.setItem('autoparts_anon_searches', (currentCount + 1).toString());
      }

      setResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Ignore abort errors quietly
      }
      setError(err.message);

      // Enviar log silenciosamente
      fetch('/api/logger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: err.message,
          context: { origin: 'frontend_search_submit', query: activeTab === 'smart' ? query : guidedForm },
          user_id: user?.id
        })
      }).catch(() => { });

    } finally {
      if (!abortController?.signal.aborted) {
        setLoading(false);
      }
      setAbortController(null);
    }
  };

  const handleHistorySelect = (historyQuery: string, historyResult: string) => {
    setQuery(historyQuery);
    setLoading(false);
    setError(null);
    try {
      const parsedResult = JSON.parse(historyResult);
      // Verifica se é o formato novo (dados_tecnicos) ou intermediário (analise_tecnica)
      if (parsedResult?.dados_tecnicos || parsedResult?.analise_tecnica) {
        setResult(parsedResult);
      } else {
        setResult({ analise_tecnica: historyResult, ml_results: [] });
      }
    } catch (e) {
      // Compatibilidade com pesquisas antigas (só string)
      const formattedResult = (historyResult || "").replace(
        /\[RAW_URL:\s*(http[^\]]+)\]/g,
        '[Ver Oferta]($1)'
      );
      setResult({ analise_tecnica: formattedResult, ml_results: [] });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#FF2D55]/30">
      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-5xl">

        {/* Top Navbar */}
        <div className="w-full flex justify-end items-center mb-6 h-12">
          {user ? (
            <div className="flex items-center space-x-1 sm:space-x-3 bg-[#1C1C1E]/60 backdrop-blur-md border border-white/10 rounded-full pl-3 pr-1 py-1 sm:pl-4 sm:pr-1.5 sm:py-1.5 shadow-sm overflow-hidden max-w-full">
              <Link href="/perfil" className="flex items-center space-x-1.5 sm:space-x-2 text-[#E5E5EA] text-[13px] sm:text-[15px] font-medium hover:text-white transition-colors cursor-pointer mr-0 sm:mr-1 shrink">
                <User className="w-4 h-4 text-[#FF2D55] shrink-0" />
                <span className="max-w-[80px] sm:max-w-[150px] truncate">{profile?.full_name || user.email}</span>
              </Link>
              <div className="w-[1px] h-4 bg-white/10 shrink-0" />
              <Link
                href="/suporte"
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-[#8E8E93] hover:text-white transition-colors shrink-0"
                title="Suporte"
              >
                <Headset className="w-4 h-4 sm:w-4 sm:h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-full hover:bg-[#FF3B30]/20 hover:text-[#FF3B30] text-[#8E8E93] transition-colors shrink-0"
                title="Sair"
              >
                <LogOut className="w-4 h-4 sm:w-4 sm:h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <a
                href="https://wa.me/5563981144408"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 rounded-full bg-[#34C759]/10 hover:bg-[#34C759]/20 border border-[#34C759]/30 text-[#34C759] transition-colors"
                title="Suporte WhatsApp"
              >
                <Headset className="w-5 h-5" />
              </a>
              <Link
                href="/login"
                className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2 sm:px-5 sm:py-2 transition-colors text-white text-[14px] sm:text-[15px] font-medium"
              >
                <LogIn className="w-4 h-4 text-[#FF2D55]" />
                <span>Entrar</span>
              </Link>
            </div>
          )}
        </div>

        {/* Global Modals */}
        <WelcomeModal />
        {user && <DashboardWelcomeModal />}

        {/* Header Section */}
        <div className="flex flex-col items-center justify-center text-center mb-10 space-y-3">
          <div className="inline-flex items-center justify-center p-2 mb-2 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-sm backdrop-blur-md">
            <LayoutDashboard className="w-6 h-6 text-[#FF2D55]" />
            <span className="ml-2 text-lg font-semibold text-white tracking-tight">
              AutoParts AI
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white pb-1">
            Pesquisa Inteligente <br className="hidden md:block" />
            <span className="text-[#FF2D55]">
              de Autopeças
            </span>
          </h1>
          <p className="text-base md:text-lg text-[#8E8E93] max-w-xl mt-3 font-normal">
            Encontre a peça específica para o seu veículo e pague mais barato.
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="max-w-3xl mx-auto w-full mb-12 relative flex flex-col items-center">

          {/* Tabs */}
          <div className="flex bg-[#1C1C1E]/60 backdrop-blur-md p-1.5 rounded-full border border-white/10 w-fit mb-8 shadow-sm">
            <button
              onClick={() => setActiveTab('smart')}
              className={`flex items-center px-6 py-2.5 rounded-full text-[15px] font-medium transition-all duration-300 ${activeTab === 'smart' ? 'bg-[#2C2C2E] text-white shadow-sm border border-white/5' : 'text-[#8E8E93] hover:text-white'}`}
            >
              <Zap className="w-4 h-4 mr-2" />
              Busca com IA
            </button>
            <button
              onClick={() => setActiveTab('guided')}
              className={`flex items-center px-6 py-2.5 rounded-full text-[15px] font-medium transition-all duration-300 ${activeTab === 'guided' ? 'bg-[#FF2D55]/10 text-[#FF2D55] shadow-sm border border-[#FF2D55]/20' : 'text-[#8E8E93] hover:text-[#FF2D55]'}`}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Busca Guiada
            </button>
          </div>

          {activeTab === 'smart' ? (
            <form
              onSubmit={handleSearch}
              className="relative flex flex-col bg-[#1C1C1E]/70 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 shadow-[0_8px_30px_rgb(255,45,85,0.05)] focus-within:ring-2 focus-within:ring-[#FF2D55]/50 transition-all duration-300 w-full"
            >
              {imagePreview && (
                <div className="relative self-start ml-4 mt-2 mb-2">
                  <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-2xl border border-white/10 shadow-sm" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-gray-200 rounded-full p-1.5 shadow-sm transition-transform hover:scale-105 border border-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center w-full">
                <div className="pl-6 pr-2">
                  <Search className="w-5 h-5 text-[#8E8E93]" />
                </div>

                <label className="cursor-pointer p-2 rounded-full hover:bg-white/5 transition-colors group relative" title="Upload Galeria">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={loading}
                  />
                  <ImagePlus className="w-5 h-5 text-[#8E8E93] group-hover:text-[#FF2D55] transition-colors" />
                </label>

                <label className="cursor-pointer p-2 rounded-full hover:bg-white/5 transition-colors group relative" title="Tirar Foto">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={loading}
                  />
                  <Camera className="w-5 h-5 text-[#8E8E93] group-hover:text-[#FF2D55] transition-colors" />
                </label>

                <input
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none text-white px-2 py-3 text-[17px] placeholder:text-[#8E8E93]"
                  placeholder="Nome ou código da peça, ou chassi do veículo..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || (!query.trim() && !imageBase64)}
                  className="bg-gradient-to-r from-[#FF2D55] to-[#FF3B30] hover:from-[#FF3B30] hover:to-[#FF2D55] text-white rounded-full px-6 py-3 font-semibold text-[15px] transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ml-2 shadow-[0_4px_14px_0_rgba(255,45,85,0.39)] group relative overflow-hidden"
                >
                  <span>{loading ? 'Buscando...' : 'Buscar'}</span>
                  {!loading && (
                    <div className="absolute inset-0 h-full w-full opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:animate-shimmer" />
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSearch} className="w-full bg-[#1C1C1E]/70 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(255,45,85,0.05)] transition-all duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[13px] font-medium text-[#8E8E93] ml-1">Montadora</label>
                  <div className="relative">
                    <select
                      value={guidedForm.montadora}
                      onChange={(e) => setGuidedForm({ ...guidedForm, montadora: e.target.value, modelo: '', ano: '', motor: '' })}
                      disabled={loading}
                      className="w-full bg-[#2C2C2E]/60 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#FF2D55]/50 focus:bg-[#3A3A3C]/40 transition-colors appearance-none pr-10 cursor-pointer"
                    >
                      <option value="" className="bg-[#1C1C1E] text-[#8E8E93]">Selecione a Montadora...</option>
                      {Object.keys(vehicleData).sort().map(brand => (
                        <option key={brand} value={brand} className="bg-[#1C1C1E] text-white">{brand}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[13px] font-medium text-[#8E8E93] ml-1">Modelo</label>
                  <div className="relative">
                    <select
                      value={guidedForm.modelo}
                      onChange={(e) => setGuidedForm({ ...guidedForm, modelo: e.target.value, ano: '', motor: '' })}
                      disabled={loading || !guidedForm.montadora}
                      className="w-full bg-[#2C2C2E]/60 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#FF2D55]/50 focus:bg-[#3A3A3C]/40 transition-colors appearance-none pr-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-[#1C1C1E] text-[#8E8E93]">Selecione o Modelo...</option>
                      {guidedForm.montadora && Object.keys(vehicleData[guidedForm.montadora] || {}).sort().map(model => (
                        <option key={model} value={model} className="bg-[#1C1C1E] text-white">{model}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[13px] font-medium text-[#8E8E93] ml-1">Ano</label>
                  <div className="relative">
                    <select
                      value={guidedForm.ano}
                      onChange={(e) => setGuidedForm({ ...guidedForm, ano: e.target.value, motor: '' })}
                      disabled={loading || !guidedForm.modelo}
                      className="w-full bg-[#2C2C2E]/60 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#FF2D55]/50 focus:bg-[#3A3A3C]/40 transition-colors appearance-none pr-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-[#1C1C1E] text-[#8E8E93]">Selecione o Ano...</option>
                      {guidedForm.montadora && guidedForm.modelo && Object.keys(vehicleData[guidedForm.montadora]?.[guidedForm.modelo] || {}).sort((a,b) => b.localeCompare(a)).map(year => (
                        <option key={year} value={year} className="bg-[#1C1C1E] text-white">{year}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[13px] font-medium text-[#8E8E93] ml-1">Motorização</label>
                  <div className="relative">
                    <select
                      value={guidedForm.motor}
                      onChange={(e) => setGuidedForm({ ...guidedForm, motor: e.target.value })}
                      disabled={loading || !guidedForm.ano}
                      className="w-full bg-[#2C2C2E]/60 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-[#FF2D55]/50 focus:bg-[#3A3A3C]/40 transition-colors appearance-none pr-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-[#1C1C1E] text-[#8E8E93]">Selecione a Motorização...</option>
                      {guidedForm.montadora && guidedForm.modelo && guidedForm.ano && (vehicleData[guidedForm.montadora]?.[guidedForm.modelo]?.[guidedForm.ano] || []).map(engine => (
                        <option key={engine} value={engine} className="bg-[#1C1C1E] text-white">{engine}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8E8E93] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mb-8 mt-2">
                <label className="text-[13px] font-medium text-[#8E8E93] ml-1">Qual peça você precisa?</label>
                <input
                  type="text"
                  placeholder="Ex: Filtro de Óleo, Pastilha de Freio..."
                  value={guidedForm.peca}
                  onChange={(e) => setGuidedForm({ ...guidedForm, peca: e.target.value })}
                  disabled={loading}
                  className="w-full bg-[#2C2C2E]/60 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-[#8E8E93]/50 focus:outline-none focus:border-[#FF2D55]/50 focus:bg-[#3A3A3C]/40 transition-colors text-[15px]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#FF2D55] to-[#FF3B30] hover:from-[#FF3B30] hover:to-[#FF2D55] text-white rounded-2xl px-6 py-4 font-bold text-[16px] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_4px_14px_0_rgba(255,45,85,0.39)] group relative overflow-hidden"
              >
                <span>{loading ? 'Analisando Catálogos Oficiais...' : 'Buscar Peça Exata'}</span>
                {!loading && (
                  <div className="absolute inset-0 h-full w-full opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:animate-shimmer" />
                )}
              </button>
            </form>
          )}
        </div>

        {/* Search History */}
        {!result && !loading && (
          <SearchHistory onSelect={handleHistorySelect} />
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 flex items-start space-x-4 animate-in fade-in slide-in-from-bottom-4">
            <Activity className="w-5 h-5 text-[#FF3B30] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[#FF3B30] font-medium text-[15px]">Erro na busca</h3>
              <p className="text-[#FF3B30]/80 mt-1 text-[15px]">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State - iOS Style Skeletons */}
        {loading && (
          <div className="animate-in fade-in duration-500 max-w-4xl mx-auto space-y-8 w-full mt-8">
            {/* iOS Style Spinner & Cancel Button */}
            <div className="flex flex-col items-center justify-center mb-10">
              <div className="w-10 h-10 border-4 border-[#FF2D55]/20 border-t-[#FF2D55] rounded-full animate-spin"></div>
              <button
                onClick={handleCancelSearch}
                type="button"
                className="mt-4 px-4 py-2 rounded-full border border-white/10 text-[#8E8E93] hover:text-white hover:bg-[#FF3B30]/20 hover:border-[#FF3B30]/30 text-[13px] font-medium transition-all duration-300"
              >
                Cancelar Busca
              </button>
            </div>

            {/* Skeleton ML Offers */}
            <div className="rounded-[32px] bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse mr-3" />
                <div className="h-6 w-48 bg-white/5 rounded-lg animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col rounded-2xl bg-[#2C2C2E]/50 border border-white/5 overflow-hidden h-72 animate-pulse">
                    <div className="h-40 w-full bg-white/5" />
                    <div className="p-4 flex flex-col flex-grow justify-between">
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-white/5 rounded" />
                        <div className="h-4 w-3/4 bg-white/5 rounded" />
                      </div>
                      <div className="h-8 w-24 bg-white/5 rounded mt-4" />
                      <div className="h-10 w-full bg-white/5 rounded-xl mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skeleton Technical Analysis */}
            <div className="rounded-[32px] bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
              <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-56 bg-white/5 rounded-lg animate-pulse" />
                  <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-5 w-40 bg-white/5 rounded animate-pulse mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-4 w-full max-w-md bg-white/5 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Container */}
        {result && !loading && (
          <div className="animate-in zoom-in-95 fade-in duration-500 max-w-4xl mx-auto group space-y-8">

            {/* ML API Products Container */}
            {result.ml_results && result.ml_results.length > 0 && (
              <div className="rounded-[32px] bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center tracking-tight">
                  <span className="w-8 h-8 rounded-full bg-[#FFCC00]/20 flex items-center justify-center mr-3 border border-[#FFCC00]/30">
                    <span className="font-bold text-[#FFCC00] text-xs">ML</span>
                  </span>
                  Ofertas no Mercado Livre
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                  {result.ml_results.map((item: any) => {
                    let href = item.link;
                    // Injeta automaticamente os parâmetros da Central de Afiliados/Social de Henrique Cruz
                    if (href.includes('mercadolivre.com.br')) {
                      try {
                        const url = new URL(href);
                        url.searchParams.set('matt_word', 'henrique_cruzn');
                        url.searchParams.set('matt_tool', '81389334');
                        url.searchParams.set('forceInApp', 'true');
                        url.searchParams.set('ref', 'BFOG');
                        href = url.toString();
                      } catch (e) { }
                    }

                    return (
                      <a
                        key={item.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col rounded-2xl bg-[#2C2C2E]/80 backdrop-blur-md border border-white/10 overflow-hidden transform hover:scale-[1.02] hover:border-[#FF2D55]/50 hover:shadow-[0_0_20px_rgba(255,45,85,0.15)] transition-all duration-300 relative group"
                      >
                        {item.brand && (
                          <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-md text-[#E5E5EA] border border-white/10 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {item.brand}
                          </div>
                        )}
                        {item.coupon && item.coupon !== "Desconto não disponível" && (
                          <div className="absolute top-2 right-2 z-10 bg-[#32ADE6]/20 backdrop-blur-md border border-[#32ADE6]/50 text-[#32ADE6] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center">
                            Cupom: {item.coupon}
                          </div>
                        )}
                        {/* Modified Image Container: Removed solid white bg, using mix-blend strategies or forced dark rendering if possible. Since ML images are usually JPG with white bg, we keep a subtle off-white core or use mix-blend-screen if appropriate, but white stands out nicely against dark gray. */}
                        <div className="h-28 sm:h-40 w-full bg-white/95 flex items-center justify-center p-2 sm:p-4">
                          <img src={item.thumbnail} alt={item.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                        </div>
                        <div className="p-2.5 sm:p-4 flex flex-col flex-grow justify-between bg-[#2C2C2E]/80">
                          <h3 className="text-[11px] sm:text-[15px] font-medium text-white line-clamp-2 mb-2 sm:mb-3 leading-snug group-hover:text-[#FF2D55] transition-colors">
                            {item.title}
                          </h3>
                          <div>
                            {item.price !== null ? (
                              <p className="text-base sm:text-[22px] font-bold text-white flex items-start">
                                <span className="text-[10px] sm:text-sm font-normal text-[#8E8E93] mr-1 mt-0.5 sm:mt-1">R$</span>
                                {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.price)}
                              </p>
                            ) : (
                              <p className="text-[13px] sm:text-[17px] font-bold text-white mt-1">
                                Ver Oferta
                              </p>
                            )}
                            <span className="mt-2 sm:mt-3 w-full block text-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl bg-[#FF2D55]/10 border border-[#FF2D55]/20 text-[#FF2D55] font-bold text-[11px] sm:text-[15px] group-hover:bg-[#FF2D55] group-hover:text-white transition-all duration-300">
                              <span className="hidden sm:inline">Clique para Comprar</span>
                              <span className="sm:hidden">Comprar</span>
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}

                  {/* 🏷️ 4º slot - Códigos para Busca em Loja Física */}
                  {(() => {
                    const oem = result.dados_tecnicos?.identificacao_tecnica?.codigo_oem;
                    const marcas = result.dados_tecnicos?.top_3_marcas || [];
                    const hasOem = oem && !oem.includes('Requer') && !oem.includes('Consultar') && !oem.includes('Consulte');
                    const codigosMarca = marcas.filter((m: any) =>
                      m.codigo_peca &&
                      !m.codigo_peca.includes('Consulte') &&
                      !m.codigo_peca.includes('Requer')
                    );
                    if (!hasOem && codigosMarca.length === 0) return null;
                    return (
                      <div className="col-span-1 md:col-span-3 flex flex-col rounded-2xl bg-[#FF9F0A]/5 border border-[#FF9F0A]/25 p-3 sm:p-5">
                        <h3 className="text-[11px] sm:text-sm font-bold text-[#FF9F0A] mb-2 flex items-center gap-1.5">
                          <span>🏷️</span>
                          <span className="hidden sm:inline">Códigos para Busca em Loja Física</span>
                          <span className="sm:hidden">Códigos da Peça</span>
                        </h3>
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2 flex-grow">
                          {hasOem && (
                            <div className="flex flex-col bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-xl px-3 py-2">
                              <span className="text-[9px] sm:text-[10px] text-[#FF9F0A]/70 font-semibold uppercase tracking-wider">OEM (Montadora)</span>
                              <span className="text-white font-bold text-[13px] sm:text-[15px] tracking-wide font-mono">{oem}</span>
                            </div>
                          )}
                          {codigosMarca.map((m: any, i: number) => (
                            <div key={i} className="flex flex-col bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                              <span className="text-[9px] sm:text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">{m.marca}</span>
                              <span className="text-white font-bold text-[12px] sm:text-[14px] tracking-wide font-mono">{m.codigo_peca}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[#8E8E93] text-[10px] sm:text-[12px] mt-2">Use em lojas físicas ou online para encontrar a peça exata.</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}



            {/* Analysis Container */}
            <div className="rounded-[32px] bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:p-10">
              <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-white/10">
                <div className="w-12 h-12 rounded-2xl bg-[#FF2D55]/10 border border-[#FF2D55]/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[#FF2D55]" />
                </div>
                <div>
                  <h2 className="text-[22px] font-bold text-white tracking-tight">
                    Análise Técnica da Peça
                  </h2>
                  <p className="text-[#8E8E93] text-sm mt-0.5">{result.query}</p>
                </div>
              </div>

              {result.dados_tecnicos?.identificacao_tecnica ? (
                <div className="space-y-8 text-[#E5E5EA] text-sm md:text-base leading-relaxed">

                  {/* Identificação Técnica */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">🛠️ Identificação Técnica</h3>
                    {result.dados_tecnicos.identificacao_tecnica.breve_explicativo && (
                      <div className="mb-4 p-4 rounded-xl bg-[#2C2C2E]/40 border border-[#FF2D55]/10 text-[#E5E5EA] text-[15px] leading-relaxed italic relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF2D55]/50"></div>
                        {result.dados_tecnicos.identificacao_tecnica.breve_explicativo}
                      </div>
                    )}
                    <ul className="space-y-2">
                      <li><strong className="text-white">Peça:</strong> {result.dados_tecnicos.identificacao_tecnica.peca}</li>
                      <li><strong className="text-white">Código OEM:</strong> {result.dados_tecnicos.identificacao_tecnica.codigo_oem}</li>
                      <li><strong className="text-white">Nome em Inglês:</strong> {result.dados_tecnicos.identificacao_tecnica.nome_ingles}</li>
                      <li><strong className="text-white">Veículo Base:</strong> {result.dados_tecnicos.identificacao_tecnica.veiculo_base}</li>
                      <li><strong className="text-[#32ADE6]">Validação de Catálogo:</strong> {result.dados_tecnicos.identificacao_tecnica.validacao_catalogo}</li>
                    </ul>
                  </div>

                  {/* Intercambiabilidade */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">🔄 Compatibilidade Cruzada</h3>
                    <ul className="list-disc list-inside space-y-1 text-[#E5E5EA]">
                      {result.dados_tecnicos.intercambiabilidade?.map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Top 3 Marcas */}
                  {result.dados_tecnicos.top_3_marcas && result.dados_tecnicos.top_3_marcas.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">⭐ Top 3 Melhores Marcas (Recomendação IA)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {result.dados_tecnicos.top_3_marcas.map((marcaItem: any, idx: number) => (
                          <div key={idx} className="bg-[#2C2C2E]/60 border border-white/10 rounded-2xl p-4 flex flex-col h-full">
                            <h4 className="text-lg font-bold text-[#FF2D55] mb-1">{marcaItem.marca}</h4>
                            <p className="text-sm text-white mb-3">
                              <span className="font-semibold text-[#8E8E93]">Código:</span> {marcaItem.codigo_peca}
                            </p>
                            <p className="text-sm text-[#E5E5EA] flex-grow">
                              {marcaItem.justificativa}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referência AliExpress */}
                  {result.dados_tecnicos.referencia_aliexpress && (
                    <div className="bg-[#FFCC00]/5 border border-[#FFCC00]/20 p-5 rounded-2xl mt-6">
                      <h3 className="text-lg font-bold text-[#FFCC00] mb-3 flex items-center">
                        🌏 Referência AliExpress (Importação)
                      </h3>
                      <ul className="space-y-2 text-[#E5E5EA]">
                        <li><strong className="text-white">Termo de Busca:</strong> {result.dados_tecnicos.referencia_aliexpress.termo_busca}</li>
                        <li><strong className="text-white">Recomendação do Especialista:</strong> {result.dados_tecnicos.referencia_aliexpress.recomendacao}</li>
                        <li className="pt-2">
                          <a
                            href={result.dados_tecnicos.referencia_aliexpress.link_busca}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-black bg-[#FFCC00] hover:bg-[#FFD60A] px-4 py-2 rounded-xl font-bold transition-colors shadow-sm"
                          >
                            Buscar no AliExpress
                          </a>
                        </li>
                      </ul>
                    </div>
                  )}

                </div>
              ) : (
                <div className="prose prose-invert max-w-none prose-sm md:prose-base text-[#E5E5EA]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-white mt-6 mb-4 tracking-tight" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-white mt-6 mb-3 tracking-tight" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-white mt-5 mb-2" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-6 space-y-1.5" {...props} />,
                      li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto mb-6 rounded-2xl border border-white/10 hidden-scrollbar">
                          <table className="w-full text-left border-collapse text-[15px]" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className="bg-white/5" {...props} />,
                      th: ({ node, ...props }) => <th className="px-4 py-3 text-sm font-semibold text-white border-b border-white/10" {...props} />,
                      td: ({ node, ...props }) => <td className="px-4 py-3 border-b border-white/5 whitespace-nowrap" {...props} />,
                      a: ({ node, ...props }) => (
                        <a
                          className="inline-flex items-center text-[#FF2D55] hover:underline font-medium"
                          target="_blank"
                          rel="noreferrer"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {result.analise_tecnica}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}} />
    </div>
  );
}
