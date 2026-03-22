# DUMP DE CÓDIGO - AUTOPARTS PORTAL

Este arquivo contém o código-fonte atualizado para análise do Gemini.

## ARQUIVO: src/app/page.tsx
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, LayoutDashboard, Activity, CheckCircle2, ImagePlus, Camera, X, LogIn, LogOut, User, Headset, Zap, Settings2, ChevronDown, Package, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchHistory } from '@/components/SearchHistory';
import { WelcomeModal } from '@/components/WelcomeModal';
import { DashboardWelcomeModal } from '@/components/DashboardWelcomeModal';
import { CompleteProfileModal } from '@/components/CompleteProfileModal';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
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
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
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
      if (session?.user) {
        fetchProfile(session.user.id);
        if (!session.user.user_metadata?.whatsapp) {
          setShowCompleteProfile(true);
        }
      } else {
        setProfile(null);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        if (!session.user.user_metadata?.whatsapp) {
          setShowCompleteProfile(true);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    // Comprime via canvas para reduzir payload (max 1000x1000, 70% JPEG)
    const reader = new FileReader();
    reader.onerror = () => setError('Não foi possível ler o arquivo. Tente novamente.');
    reader.onloadend = () => {
      try {
        const img = new window.Image();
        img.onerror = () => setError('Imagem inválida ou corrompida. Use JPG, PNG ou WEBP.');
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            if (width > height) {
              if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { setError('Erro ao processar imagem. Tente novamente.'); return; }
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setImagePreview(compressedBase64);
            setImageBase64(compressedBase64);
            setError(null);
          } catch (canvasErr) {
            setError('Erro ao comprimir a imagem. Tente uma foto diferente.');
          }
        };
        img.src = reader.result as string;
      } catch (err) {
        setError('Erro inesperado ao carregar a imagem.');
      }
    };
    reader.readAsDataURL(file);
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

      // Nova Arquitetura Estável: Links de Afiliado Diretos (Sem chamadas à API do ML)
      // O frontend apenas monta as URLs e exibe as informações levantadas pelo Gemini
      if (data.dados_tecnicos?.top_3_marcas && Array.isArray(data.dados_tecnicos.top_3_marcas)) {
        try {
          const AFFILIATE_PARAMS = 'matt_word=henrique_cruzn&matt_tool=81389334&forceInApp=true&ref=BFOG';
          
          const mlCards = data.dados_tecnicos.top_3_marcas.map((marcaItem: any, index: number) => {
            if (!marcaItem.termo_busca_mercadolivre) return null;
            
            // 1. Limpeza do Termo e Link Base
            const searchTermBase = marcaItem.termo_busca_mercadolivre.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            // 2. Aplicação do filtro de "Menor Preço" do ML ("_OrderId_PRICE")
            const baseLink = `https://lista.mercadolivre.com.br/${searchTermBase}_OrderId_PRICE`;
            // 3. Injeção do Afiliado Seguro
            const finalLink = baseLink.includes('?') ? `${baseLink}&${AFFILIATE_PARAMS}` : `${baseLink}?${AFFILIATE_PARAMS}`;
            
            return {
               id: `ml-card-${index}-${Date.now()}`,
               title: `${marcaItem.marca} — ${data.dados_tecnicos?.identificacao_tecnica?.peca || 'Peça Automotiva'}`,
               price: null,
               link: finalLink,
               thumbnail: null,
               brand: marcaItem.marca,
               coupon: null,
               codigo_peca: marcaItem.codigo_peca,
               justificativa: marcaItem.justificativa,
               parcelamento: null
            };
          }).filter(Boolean);
          
          setResult((prev: any) => {
             if (!prev) return prev;
             return { ...prev, ml_results: mlCards };
          });
        } catch(e) {
           console.error("Erro renderizando cards estáveis", e);
        }
      }


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
            <Image src="/logo.png" alt="AutoParts AI Logo" width={28} height={28} className="rounded-lg shadow-[0_0_10px_rgba(255,45,85,0.4)]" />
            <span className="ml-2 text-lg font-semibold text-white tracking-tight">
              AutoParts AI
            </span>
            <span className="ml-2 text-[10px] font-bold text-[#FF2D55] bg-[#FF2D55]/10 border border-[#FF2D55]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Beta 1.1
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
          <SearchHistory userId={user?.id ?? null} onSelect={handleHistorySelect} />
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
          <div className="animate-in zoom-in-95 fade-in duration-500 max-w-4xl mx-auto group space-y-8 relative">
            
            {/* Botão Nova Pesquisa e Ações */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  setResult(null);
                  setQuery('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white font-medium text-sm transition-all"
              >
                <Search className="w-4 h-4 mr-2 text-[#8E8E93]" />
                Fazer Nova Pesquisa
              </button>
            </div>

            {/* Opção Rápida de Compra Local e ML */}
            {(result.dados_tecnicos?.top_3_marcas && result.dados_tecnicos.top_3_marcas.length > 0) && (
              <div className="rounded-[32px] bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                <div className="flex flex-col md:flex-row gap-5 items-stretch">
                  
                  {/* Códigos OEM da Peça (Prioridade Local) */}
                  {(() => {
                    const oem = result.dados_tecnicos?.identificacao_tecnica?.codigo_oem;
                    const hasOem = oem && !oem.includes('Requer') && !oem.includes('Consultar') && !oem.includes('Consulte') && oem.length > 3;
                    
                    return (
                      <div className="flex-1 flex flex-col justify-between rounded-[20px] bg-black/40 border border-[#32ADE6]/20 p-4 sm:p-5">
                        <h3 className="text-[#32ADE6] font-bold text-[15px] mb-3 flex items-center gap-2">
                          <span>🏷️</span> Código da Peça Original
                        </h3>
                        <div className="flex flex-col gap-2">
                          <p className="text-[#8E8E93] text-[12px] mb-1">Use este código na autopeças ou concessionária local:</p>
                          {hasOem && (
                            <div className="flex flex-col bg-[#32ADE6]/10 border border-[#32ADE6]/30 rounded-lg px-3 py-2 mb-1">
                              <span className="text-[10px] text-[#32ADE6]/90 font-bold uppercase tracking-wider mb-0.5">Montadora (OEM)</span>
                              <span className="text-white font-mono text-[16px] font-bold tracking-wider">{oem}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mega Botão Centralizado para Compra Rápida Online */}
                  {(() => {
                     // Utilizando a palavra-chave cravada da MELHOR MARCA recomendada pela IA
                     const topMarca = result.dados_tecnicos?.top_3_marcas?.[0];
                     const searchWord = topMarca?.termo_busca_mercadolivre 
                         ? topMarca.termo_busca_mercadolivre 
                         : `${result.dados_tecnicos?.identificacao_tecnica?.peca || ''}`;
                         
                     const optimizedTerm = searchWord.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                     const link = `https://lista.mercadolivre.com.br/${optimizedTerm}_OrderId_PRICE?matt_word=henrique_cruzn&matt_tool=81389334&forceInApp=true&ref=BFOG`;
                     
                     return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex flex-col items-center justify-center p-5 rounded-[20px] bg-gradient-to-r from-[#FF2D55] to-[#ff0036] text-white transition-all duration-300 shadow-[0_4px_20px_rgba(255,45,85,0.4)] hover:shadow-[0_8px_30px_rgba(255,45,85,0.6)] hover:scale-[1.02] group cursor-pointer"
                      >
                        <span className="font-extrabold text-[18px] sm:text-[22px] flex items-center justify-center text-center gap-2 drop-shadow-md mb-2">
                          <span>📦</span>
                          <span>Comprar no Mercado Livre</span>
                        </span>
                        {topMarca && (
                          <span className="text-[12px] sm:text-[13px] font-medium opacity-95 text-center px-4 mb-3">
                            Melhor Qualidade: <strong>{topMarca.marca}</strong>
                          </span>
                        )}
                        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold flex items-center gap-2 mt-auto bg-black/20 py-1.5 px-3 rounded-full border border-black/10">
                          <span className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse"></span>
                          Pesquisar Menor Preço
                        </span>
                      </a>
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

                  {/* Top 3 Marcas (Apenas Informações Técnicas) */}
                  {result.dados_tecnicos.top_3_marcas && result.dados_tecnicos.top_3_marcas.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2 flex items-center justify-between">
                        <span>⭐ Top 3 Melhores Marcas (Recomendação IA)</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {result.dados_tecnicos.top_3_marcas.map((marcaItem: any, idx: number) => {
                          const isBest = idx === 0;
                          
                          return (
                            <div key={`brand-${idx}`} className={`bg-[#2C2C2E]/60 border ${isBest ? 'border-[#FF2D55]/50 shadow-[0_4px_15px_rgba(255,45,85,0.15)] ring-1 ring-[#FF2D55]/20' : 'border-white/10'} rounded-2xl p-6 flex flex-col h-full relative overflow-hidden`}>
                              
                              {/* Tag Melhor Opção */}
                              {isBest && (
                                <div className="absolute top-0 right-0 bg-gradient-to-r from-[#FF2D55] to-[#FF3B30] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                                  1ª Opção
                                </div>
                              )}

                              <h4 className={`text-xl font-bold mb-3 ${isBest ? 'text-[#FF2D55]' : 'text-white'}`}>{marcaItem.marca}</h4>
                              
                              <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5">
                                <span className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest block mb-1">Código da Peça</span>
                                <span className="text-[#E5E5EA] font-mono text-[18px] font-black tracking-wider block">{marcaItem.codigo_peca}</span>
                              </div>
                              
                              <p className="text-[14px] text-[#E5E5EA] flex-grow leading-relaxed mb-4">
                                {marcaItem.justificativa}
                              </p>

                              {/* Botão de Compra Individual */}
                              <a
                                href={`https://lista.mercadolivre.com.br/${marcaItem.termo_busca_mercadolivre?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}_OrderId_PRICE?matt_word=henrique_cruzn&matt_tool=81389334&forceInApp=true&ref=BFOG`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full mt-auto py-2.5 bg-white/5 hover:bg-[#FF2D55]/20 border border-white/10 hover:border-[#FF2D55]/30 rounded-xl text-white text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2"
                              >
                                <span>🛒</span> Ver no Mercado Livre
                              </a>
                            </div>
                          );
                        })}
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

        <CompleteProfileModal 
          isOpen={showCompleteProfile} 
          onComplete={() => {
            setShowCompleteProfile(false);
            supabase.auth.refreshSession();
          }} 
        />
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

```

---

## ARQUIVO: src/app/api/pesquisa/route.ts
```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60; // Allow Vercel to run this function for up to 60 seconds (prevents 504 Timeout)


interface GeminiResponse {
    identificacao_tecnica: {
        peca: string;
        breve_explicativo: string;
        codigo_oem: string;
        nome_ingles: string;
        veiculo_base: string;
        validacao_catalogo: string;
    };
    intercambiabilidade: string[];
    top_3_marcas: Array<{
        marca: string;
        codigo_peca: string;
        justificativa: string;
        termo_busca_mercadolivre: string;
    }>;
    referencia_aliexpress: {
        termo_busca: string;
        link_busca: string;
        recomendacao: string;
    };
}


async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error("Erro de Configuração. A chave de API (GEMINI_API_KEY) não foi encontrada no servidor.");
    }
    
    const MODEL_NAME = "gemini-2.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const promptMestre = `
    PERSONA: Você é um Especialista Sênior em Catálogos de Peças Automotivas com acesso a bancos de dados oficiais de todas as montadoras.
    
    MISSÃO: Analisar a pesquisa: "${query || "Imagem da peça."}" e recomendar as 3 MELHORES MARCAS de peças aftermarket.

    REGRA 1 — ANTI-ALUCINAÇÃO GERAL:
    Se a pesquisa for GENÉRICA (sem modelo exato, ano e motorização):
    - NÃO INVENTE códigos OEM ou da marca. Use "Requer modelo exato" ou "Consultar Catálogo".
    - Adicione AVISO no "breve_explicativo": "ATENÇÃO: Busca genérica. Especifique modelo, ano e motor para código exato."
    - Use termos AMPLOS nos links do Mercado Livre (sem marca específica).

    REGRA 2 — CÓDIGOS DE PEÇA (OBRIGATÓRIO):
    - É SEU DEVER OBRIGATÓRIO fornecer o Código OEM genuíno e o Código da Marca Aftermarket correspondente. 
    - O painel é usado por mecânicos que precisam do CÓDIGO EXATO para compra. 
    - EVITE ao máximo "Consulte o catálogo". Pesquise em sua base interna até encontrar o código de referência cruzada correto para cada uma das 3 marcas.

    REGRA 3 — TERMOS DE BUSCA NO MERCADO LIVRE:
    - O campo "termo_busca_mercadolivre" será usado diretamente na API de busca do ML.
    - DEVE SER EXTREMAMENTE ENXUTO. Máximo de 4 palavras-chave. Nada de hifens.
    - Foque APENAS: Peça Principal + Modelo Principal + Marca Aftermarket
    - NUNCA inclua palavras genéricas como "para", "de", "do", "original", "genuíno", etc.
    
    Exemplos CORRETOS:
    - "pastilha freio golf textar"
    - "bomba combustivel audi continental"
    - "filtro oleo corsa mann"

    REGRA 4 — INTERCAMBIABILIDADE:
    - Liste APENAS veículos com CONFIRMAÇÃO de compatibilidade cruzada (plug and play).
    - NÃO liste veículos "possivelmente compatíveis".

    REGRA 5 — FORMATO:
    - RETORNE APENAS JSON VÁLIDO, SEM texto antes ou depois, SEM blocos de código (sem \`\`\`json).
    - TODOS os campos em Português do Brasil (PT-BR).

    JSON OBRIGATÓRIO:
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico Exato",
        "breve_explicativo": "Função e importância da peça. Aviso de busca genérica se aplicável.",
        "codigo_oem": "Código da Montadora EXATO ou 'Requer modelo exato'",
        "nome_ingles": "Nome em inglês",
        "veiculo_base": "Modelo exato com carroceria, ano e motor",
        "validacao_catalogo": "Catálogo Oficial [Montadora]"
      },
      "intercambiabilidade": [
        "Marca/Modelo/Carroceria (Ano) - Motorização — Plug and Play confirmed"
      ],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "Código exato OU 'Consulte o catálogo oficial do fabricante'",
          "justificativa": "Motivo técnico da recomendação",
          "termo_busca_mercadolivre": "[peça] [modelo] [marca]"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Código OEM ou nome em inglês",
        "link_busca": "https://pt.aliexpress.com/w/wholesale-[termo-busca-encoded].html",
        "recomendacao": "Análise objetiva de custo-benefício e riscos da importação"
      }
    }
    `;

    let contents: any[] = [];
    if (image) {
        const rawBase64 = image.split(',')[1] || image;
        contents = [{
            parts: [
                { text: promptMestre.replace('\${query || "Imagem da peça."}', query || 'Analise esta imagem.') },
                { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
            ]
        }];
    } else {
        contents = [{
            parts: [{ text: promptMestre.replace('\${query || "Imagem da peça."}', query) }]
        }];
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await res.json();
        
        if (data.error) {
            if (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 429) {
                throw new Error("Servidores da Inteligência Artificial sobrecarregados no momento. Por favor, aguarde 1 a 2 minutos e tente novamente.");
            }
            throw new Error(`Erro API Google: ${data.error.message} (Status: ${data.error.status})`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("A IA não retornou conteúdo válido.");

        const cleanJson = text.replace(/^\s*\`\`\`json\s*/g, '').replace(/\s*\`\`\`\s*$/g, '').trim();
        return JSON.parse(cleanJson) as GeminiResponse;
    } catch (e: any) {
        console.error("Erro na análise do Gemini:", e);
        throw e;
    }
}

export async function POST(req: Request) {
    let requestContext: any = {};
    try {
        const payload = await req.json();
        requestContext = payload;
        const { query, image, user_id, user_email, anon_fingerprint } = payload;

        if (!query && !image) {
            return NextResponse.json({ error: "A query de pesquisa ou imagem é obrigatória." }, { status: 400 });
        }

        const isUnlimitedUser = user_email === 'henrike.henrique.cn94@gmail.com';

        // Limite Mensal para usuários logados
        if (user_id && !isUnlimitedUser) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count } = await supabase
                .from('search_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user_id)
                .gte('created_at', startOfMonth.toISOString());

            if (count && count >= 15) {
                return NextResponse.json({ error: "Você atingiu o limite mensal de 15 pesquisas gratuitas da Conta Base. Faça upgrade para continuar economizando!" }, { status: 403 });
            }
        }

        // ✅ Limite persistente para usuários ANÔNIMOS por fingerprint (lado servidor)
        // Isso impede o bypass por limpeza de localStorage ou troca de aba/dia
        if (!user_id && anon_fingerprint) {
            const { data: anonRecord } = await supabase
                .from('anon_search_limits')
                .select('id, search_count')
                .eq('fingerprint', anon_fingerprint)
                .single();

            if (anonRecord && anonRecord.search_count >= 5) {
                return NextResponse.json({
                    error: "Você já utilizou suas 5 pesquisas gratuitas. Crie sua conta gratuitamente para continuar pesquisando sem limites!",
                    require_signup: true
                }, { status: 403 });
            }
        }

        // 1. Obter Inteligência do Gemini
        const aiAnalysis = await getGeminiAnalysis(query, image);

        // 2. Consolidar apenas a Inteligência Artifical (ML será carregado pelo frontend)
        const finalResponse = {
            query: query || "Busca por Imagem",
            dados_tecnicos: {
                identificacao_tecnica: aiAnalysis.identificacao_tecnica,
                intercambiabilidade: aiAnalysis.intercambiabilidade,
                top_3_marcas: aiAnalysis.top_3_marcas,
                referencia_aliexpress: aiAnalysis.referencia_aliexpress
            },
            ml_results: [] // Opcional, mantido como array vazio para compatibilidade inicial do frontend
        };

        // 4. Salvar Histórico async (evitando duplicatas para usuários logados) e Manutenção do DB
        if (user_id) {
            const saveHistory = async () => {
                try {
                    // Remove busca anterior idêntica para não poluir o histórico com repetidas
                    await supabase.from("search_history").delete().eq('user_id', user_id).eq('query', finalResponse.query);
                    await supabase.from("search_history").insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse), user_id: user_id }]);
                    
                    // Método Anti-Erro: Expurgo Automático do Banco (mantendo-o "leve")
                    // Deleta pesquisas com mais de 30 dias do usuário silenciosamente
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    await supabase.from("search_history").delete().eq('user_id', user_id).lt('created_at', thirtyDaysAgo.toISOString());
                } catch (err) {
                    console.error("Erro ao salvar histórico/limpar banco:", err);
                }
            };
            saveHistory();
        }

        // ✅ Incrementa ou cria o contador de pesquisas anônimas no servidor
        if (!user_id && anon_fingerprint) {
            const { data: existing } = await supabase
                .from('anon_search_limits')
                .select('id, search_count')
                .eq('fingerprint', anon_fingerprint)
                .single();

            if (existing) {
                supabase
                    .from('anon_search_limits')
                    .update({ search_count: existing.search_count + 1, last_search_at: new Date().toISOString() })
                    .eq('fingerprint', anon_fingerprint)
                    .then();
            } else {
                supabase
                    .from('anon_search_limits')
                    .insert([{ fingerprint: anon_fingerprint, search_count: 1 }])
                    .then();
            }
        }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Erro interno na rota /api/pesquisa:", error);

        // Registrar erro no painel do Supabase silenciosamente
        supabase.from('system_errors').insert([{
            error_message: error.message || 'Erro desconhecido na API de Pesquisa',
            context: { origin: 'api_pesquisa', payload: requestContext }
        }]).then();

        return NextResponse.json({ error: error.message || "Erro interno na API de Pesquisa." }, { status: 500 });
    }
}


```

---

## ARQUIVO: src/app/api/ml-search/route.ts
```ts
import { NextResponse } from "next/server";

export const maxDuration = 30;

const ML_APP_ID = process.env.ML_APP_ID;
const ML_SECRET_KEY = process.env.ML_SECRET_KEY;


let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getMlAppToken(): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    try {
        const res = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: ML_APP_ID || '',
                client_secret: ML_SECRET_KEY || ''
            }),
            signal: AbortSignal.timeout(8000)
        });
        const data = await res.json();
        if (data.access_token) {
            cachedToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in - 600) * 1000;
            return cachedToken;
        }
    } catch {}
    return null;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '8');

    if (!query) {
        return NextResponse.json({ error: 'Parâmetro q obrigatório' }, { status: 400 });
    }

    const token = await getMlAppToken();

    // Tentativa 1: API oficial com token App
    if (token) {
        try {
            const encodedQ = encodeURIComponent(query);
            const mlRes = await fetch(
                `https://api.mercadolibre.com/sites/MLB/search?q=${encodedQ}&limit=${limit}&sort=price_asc`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0',
                    },
                    signal: AbortSignal.timeout(10000)
                }
            );
            if (mlRes.ok) {
                const data = await mlRes.json();
                const results = data.results || [];
                if (results.length > 0) {
                    return NextResponse.json({ results, total: data.paging?.total || 0 });
                }
            }
        } catch {}
    }

    // Tentativa 2: API do app mobile do ML (endpoint diferente, sem WAF tão restritivo)
    try {
        const encodedQ = encodeURIComponent(query);
        const mobileRes = await fetch(
            `https://apiseller.mercadolivre.com.br/v1/buyer/search?q=${encodedQ}&limit=${limit}&sort=price_asc&site_id=MLB`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'MercadoLivre/7.20.0 (Android 12; Samsung SM-G998B)',
                    'x-channel-id': 'ML_ANDROID'
                },
                signal: AbortSignal.timeout(8000)
            }
        );
        if (mobileRes.ok) {
            const data = await mobileRes.json();
            const results = data.results || data.items || [];
            if (results.length > 0) {
                return NextResponse.json({ results });
            }
        }
    } catch {}

    // Tentativa 3: Scraping da página de resultados HTML do ML para extrair JSON embutido
    try {
        const encodedQ = encodeURIComponent(query);
        const htmlRes = await fetch(
            `https://www.mercadolivre.com.br/busca?q=${encodedQ}&sort=price_asc`,
            {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Cache-Control': 'no-cache',
                },
                signal: AbortSignal.timeout(12000)
            }
        );
        
        if (htmlRes.ok) {
            const html = await htmlRes.text();
            
            // Extrai o JSON embutido no HTML da página de busca
            const jsonMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});/) ||
                              html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/) ||
                              html.match(/initialState\s*=\s*({[\s\S]+?});/);
            
            if (jsonMatch) {
                try {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    // Tenta encontrar os resultados em locais comuns do JSON do ML
                    const rawResults = 
                        jsonData?.initialState?.results ||
                        jsonData?.props?.pageProps?.results ||
                        jsonData?.results ||
                        [];
                    
                    if (rawResults.length > 0) {
                        const results = rawResults.slice(0, limit).map((item: any) => ({
                            id: item.id,
                            title: item.title,
                            price: item.price || item.prices?.amount,
                            thumbnail: item.thumbnail || item.picture,
                            permalink: item.permalink || item.url,
                            installments: item.installments
                        }));
                        return NextResponse.json({ results, source: 'html_scrape' });
                    }
                } catch {}
            }

            // Se não encontrar o JSON embutido, tenta extrair os produtos direto do HTML
            const results = [];
            const regex = /"id":"(MLB\d+)","title":"([^"]+)",[\s\S]*?"price":(\d+(?:\.\d+)?)/g;
            let m;
            let i = 0;
            while ((m = regex.exec(html)) !== null && i < limit) {
                results.push({
                    id: m[1] + '_' + i,
                    title: m[2],
                    price: parseFloat(m[3]),
                    thumbnail: null,
                    permalink: `https://www.mercadolivre.com.br/p/${m[1]}`
                });
                i++;
            }
            if (results.length > 0) {
                return NextResponse.json({ results, source: 'html_regex' });
            }
        }
    } catch (err: any) {
        console.error('Erro no scraping HTML:', err.message);
    }

    return NextResponse.json({ error: 'Não foi possível obter resultados do ML', results: [] }, { status: 200 });
}

```

---

## ARQUIVO: src/data/vehicles.ts
```ts
export const vehicleData: Record<string, Record<string, Record<string, string[]>>> = {
  "Audi": {
    "A1": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TFSI", "1.8 TFSI", "2.0 TFSI", "1.0 TFSI"]])),
    "A3 Sedan": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TFSI", "1.8 TFSI", "2.0 TFSI (EA888)", "1.6", "1.8", "1.8T"]])),
    "A3 Sportback": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TFSI", "1.8 TFSI", "2.0 TFSI (EA888)", "1.0 TFSI"]])),
    "A4 Sedan": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8 TFSI", "2.0 TFSI", "3.2 FSI", "1.8T", "2.4", "2.8 V6", "3.0 V6"]])),
    "A4 Avant": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8 TFSI", "2.0 TFSI", "3.2 FSI", "2.0 TFSI quattro"]])),
    "A4 Allroad": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI quattro", "3.0 TDI quattro"]])),
    "A5 Sportback": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "1.8 TFSI"]])),
    "A5 Coupe": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "3.2 FSI", "1.8 TFSI"]])),
    "A5 Cabriolet": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2021 - i).map(y => [y.toString(), ["2.0 TFSI", "1.8 TFSI"]])),
    "A6 Sedan": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "2.4", "2.8 FSI", "3.0 TFSI", "4.2 V8"]])),
    "A6 Avant": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "3.0 TFSI", "3.0 TDI"]])),
    "A7": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "3.0 TFSI"]])),
    "A8": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 TFSI", "4.2 FSI", "4.2 V8", "6.0 W12"]])),
    "Q2": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TFSI", "1.4 TFSI"]])),
    "Q3": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TFSI", "2.0 TFSI", "2.5 TFSI (RS)"]])),
    "Q5": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI", "3.0 TFSI", "3.2 FSI"]])),
    "Q7": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 TFSI", "4.2 FSI", "3.6 FSI", "3.0 TDI"]])),
    "Q8": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 TFSI", "4.0 V8 TFSI"]])),
    "RS3": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.5 TFSI RS"]])),
    "RS4 Avant": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.9 V6 Biturbo RS"]])),
    "S3": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TFSI S"]])),
    "TT Coupe": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8T", "2.0 TFSI", "3.2 V6", "2.5 TFSI"]])),
    "TT Roadster": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.8T", "2.0 TFSI", "3.2 V6"]]))
  },
  "BMW": {
    "Série 1 Hatch (116i/118i/120i/125i)": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 TwinPower Turbo", "1.6 TwinPower Turbo", "2.0 16V", "2.0 TwinPower Turbo"]])),
    "M135i": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6 TwinPower Turbo"]])),
    "Série 2 Coupe (220i/M235i)": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo"]])),
    "Série 2 Gran Coupe": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo"]])),
    "M2": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6 TwinPower Turbo"]])),
    "Série 3 Sedan (318i/320i/325i/328i/330i/335i)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo (B48)", "2.0 TwinPower Turbo (N20)", "2.0 16V", "2.5 L6", "3.0 L6", "3.0 L6 Biturbo"]])),
    "Série 3 Touring (Estate)": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo (B48)", "2.0 TwinPower Turbo (N20)", "3.0 L6 Biturbo"]])),
    "Série 3 Gran Turismo": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2019 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo (N20)", "3.0 L6 Biturbo"]])),
    "M3": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6 Biturbo S58", "4.0 V8 S65"]])),
    "Série 4 Coupe (420i/428i/430i)": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "3.0 L6 TwinPower Turbo"]])),
    "Série 4 Gran Coupe": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "3.0 L6 TwinPower Turbo"]])),
    "Série 4 Cabrio": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo"]])),
    "Série 5 Sedan (528i/530i/540i/550i)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "3.0 L6", "4.4 V8 Biturbo", "4.8 V8"]])),
    "Série 5 Touring": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "3.0 L6 Biturbo"]])),
    "Série 5 Gran Turismo": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2017 - i).map(y => [y.toString(), ["3.0 L6", "4.4 V8 Biturbo"]])),
    "M5": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["4.4 V8 Biturbo S63"]])),
    "Série 7 (740i/750i)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6 TwinPower Turbo", "4.4 V8 Biturbo", "4.8 V8"]])),
    "X1": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "1.5 TwinPower Turbo", "2.0 16V Aspirado", "3.0 L6"]])),
    "X2": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 TwinPower Turbo", "2.0 TwinPower Turbo"]])),
    "X3": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "2.5 L6", "3.0 L6"]])),
    "X4": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "3.0 L6 TwinPower Turbo"]])),
    "X5": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6", "4.4 V8", "4.8 V8", "3.0 Diesel", "4.4 V8 Biturbo"]])),
    "X6": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 L6 TwinPower Turbo", "4.4 V8 Biturbo"]])),
    "Z4": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TwinPower Turbo", "2.5 L6", "3.0 L6"]]))
  },
  "Mercedes-Benz": {
    "Classe A (A160, A190, A200, A250, A45)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Turbo", "1.6", "1.6 Turbo", "1.9", "2.0 Turbo"]])),
    "Classe B (B170, B180, B200)": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 Turbo", "1.7", "2.0 Turbo"]])),
    "Classe C (C180, C200, C250, C300, C63)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 EQ Boost", "1.6 Kompressor", "1.6 Turbo", "1.8 Kompressor", "1.8 Turbo", "2.0 Turbo", "3.0 V6", "4.0 V8 Biturbo", "6.2 V8"]])),
    "Classe E (E250, E300, E350, E63)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8 Turbo", "2.0 Turbo", "3.0 V6", "3.5 V6", "4.0 V8 Biturbo", "5.5 V8"]])),
    "Classe S (S500, S63)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["4.0 V8 Biturbo", "4.7 V8 Biturbo", "5.0 V8", "5.5 V8"]])),
    "CLA (CLA200, CLA250, CLA45)": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Turbo", "1.6 Turbo", "2.0 Turbo"]])),
    "CLK": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2009 - i).map(y => [y.toString(), ["1.8 Kompressor", "3.2 V6", "5.0 V8"]])),
    "CLS": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2023 - i).map(y => [y.toString(), ["3.5 V6", "4.7 V8", "5.5 V8", "3.0 L6 Turbo"]])),
    "GLA (GLA200, GLA250)": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Turbo", "1.6 Turbo", "2.0 Turbo"]])),
    "GLB": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Turbo", "2.0 Turbo"]])),
    "GLC": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo", "2.0 Turbodiesel"]])),
    "GLE (antiga ML)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 V6 Turbo", "3.0 V6 Turbodiesel", "3.5 V6", "5.0 V8"]])),
    "GLK": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2015 - i).map(y => [y.toString(), ["3.0 V6", "3.5 V6", "2.2 Turbodiesel"]]))
  },
  "Porsche": {
    "911 (Carrera, Turbo, GT3)": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 Boxer Biturbo", "3.4 Boxer", "3.6 Boxer", "3.8 Boxer", "3.8 Boxer Biturbo", "4.0 Boxer"]])),
    "Boxster": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Boxer Turbo", "2.5 Boxer Turbo", "2.7 Boxer", "2.9 Boxer", "3.2 Boxer", "3.4 Boxer"]])),
    "Cayenne": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 V6 E-Hybrid", "3.0 V6 Turbo", "3.2 V6", "3.6 V6", "4.5 V8", "4.8 V8"]])),
    "Cayman": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Boxer Turbo", "2.5 Boxer Turbo", "2.7 Boxer", "2.9 Boxer", "3.4 Boxer"]])),
    "Macan": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo", "2.9 V6 Biturbo", "3.0 V6 Biturbo", "3.0 V6 Turbo", "3.6 V6 Biturbo"]])),
    "Panamera": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.9 V6 Biturbo", "3.0 V6 E-Hybrid", "3.6 V6", "4.0 V8 Biturbo", "4.8 V8"]]))
  },
  "Volkswagen": {
    "Amarok": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TDI", "2.0 TDI Biturbo", "3.0 V6 TDI"]])),
    "Bora": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["2.0 8V", "2.0 8V Flex"]])),
    "CrossFox": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2018 - i).map(y => [y.toString(), ["1.6 8V", "1.6 16V MSI"]])),
    "Fox Hatch": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 8V", "1.0 12V", "1.6 8V", "1.6 16V MSI"]])),
    "Fusca (Novo)": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2016 - i).map(y => [y.toString(), ["2.0 TSI"]])),
    "Gol": Object.fromEntries(Array.from({ length: 24 }, (_, i) => 2023 - i).map(y => [y.toString(), ["1.0 8V", "1.0 16V", "1.0 12V MPI", "1.0 TEC", "1.6 AP", "1.6 VHT", "1.6 16V MSI", "1.8 AP"]])),
    "Golf Hatch": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TSI", "1.4 TSI", "1.6 8V", "1.8T", "2.0 8V", "2.0 TSI (GTI)"]])),
    "Golf GTI": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TSI GTI"]])),
    "Golf R": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TSI R 4Motion"]])),
    "Golf Variant": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI", "1.6 MSI", "2.0 TSI"]])),
    "Jetta Sedan": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI", "2.0 8V Flex", "2.0 TSI", "2.5 20V"]])),
    "Jetta Gli": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 TSI GLI"]])),
    "Jetta Hybrid": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.4 TSI Hybrid"]])),
    "Nivus": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TSI (200)"]])),
    "Parati": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2012 - i).map(y => [y.toString(), ["1.0 16V", "1.6 AP", "1.8 AP", "2.0 AP"]])),
    "Passat Sedan": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.8T", "2.0", "2.0 TSI", "2.8 V6", "3.2 V6 FSI"]])),
    "Passat Variant": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2015 - i).map(y => [y.toString(), ["1.8T", "2.0 TSI"]])),
    "Polo Hatch": Object.fromEntries(Array.from({ length: 23 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 12V MPI", "1.0 TSI", "1.4 TSI (GTS)", "1.6 8V", "1.6 16V MSI", "2.0 8V"]])),
    "Polo Sedan": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2014 - i).map(y => [y.toString(), ["1.6 8V", "1.6 16V"]])),
    "Polo Track": Object.fromEntries(Array.from({ length: 3 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 12V MPI"]])),
    "Polo GTS": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI GTS"]])),
    "Saveiro": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 AP", "1.6 VHT", "1.6 16V MSI"]])),
    "SpaceCross": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2017 - i).map(y => [y.toString(), ["1.6 8V", "1.6 16V MSI"]])),
    "SpaceFox": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.6 8V", "1.6 16V MSI"]])),
    "T-Cross": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TSI (200)", "1.4 TSI (250)"]])),
    "Taos": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI (250)"]])),
    "Tiguan": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI", "2.0 TSI"]])),
    "Touareg": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2018 - i).map(y => [y.toString(), ["3.2 V6", "3.6 V6", "4.2 V8", "4.2 V8 FSI"]])),
    "up!": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 12V MPI", "1.0 TSI"]])),
    "Virtus Sedan": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TSI", "1.4 TSI (GTS)", "1.6 16V MSI"]])),
    "Virtus GTS": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 TSI GTS"]])),
    "Voyage": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2023 - i).map(y => [y.toString(), ["1.0 8V", "1.0 12V MPI", "1.6 8V", "1.6 16V MSI"]]))
  },
  "Chevrolet": {
    "Agile": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2014 - i).map(y => [y.toString(), ["1.4 Econo.Flex"]])),
    "Astra Hatch": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["1.8 8V", "2.0 8V", "2.0 16V"]])),
    "Astra Sedan": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2011 - i).map(y => [y.toString(), ["2.0 8V", "2.0 16V"]])),
    "Astra GTC": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2009 - i).map(y => [y.toString(), ["2.0 16V"]])),
    "Blazer": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["2.4 Flexpower", "2.8 Turbo Diesel", "4.3 V6"]])),
    "Camaro": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["6.2 V8"]])),
    "Captiva": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2017 - i).map(y => [y.toString(), ["2.4", "3.0 V6", "3.6 V6"]])),
    "Celta Hatch": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2015 - i).map(y => [y.toString(), ["1.0 VHC", "1.0 VHC-E", "1.4"]])),
    "Celta Sedan (Classic)": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.0 VHC", "1.0 VHC-E"]])),
    "Cobalt": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.4 Econo.Flex", "1.8 Econo.Flex"]])),
    "Corsa Hatch": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2012 - i).map(y => [y.toString(), ["1.0 8V", "1.0 16V", "1.4 Econo.Flex", "1.8 8V"]])),
    "Corsa Sedan": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2012 - i).map(y => [y.toString(), ["1.0 8V", "1.0 16V", "1.4 Econo.Flex"]])),
    "Corsa Wagon": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2009 - i).map(y => [y.toString(), ["1.0 8V", "1.4 Econo.Flex"]])),
    "Cruze Sedan": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.4 Turbo Flex", "1.8 Ecotec Flex"]])),
    "Cruze Sport6 (Hatch)": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2022 - i).map(y => [y.toString(), ["1.4 Turbo Flex"]])),

    "Equinox": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 Turbo", "2.0 Turbo"]])),
    "Montana": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.2 Turbo Flex", "1.4 Econo.Flex", "1.8 8V"]])),
    "Omega": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["3.6 V6 Alloytec", "3.8 V6"]])),
    "Onix": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 SPE/4", "1.0 Flex", "1.0 Turbo Flex", "1.4 SPE/4"]])),
    "Onix Plus": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Flex", "1.0 Turbo Flex"]])),
    "Prisma": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.0 SPE/4", "1.4 SPE/4", "1.4 Econo.Flex"]])),
    "S10": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.4 Flexpower", "2.5 Ecotec Flex", "2.8 Turbo Diesel", "4.3 V6"]])),
    "Spin": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8 Econo.Flex"]])),
    "Tracker": Object.fromEntries(Array.from({ length: 24 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Turbo Flex", "1.2 Turbo Flex", "1.4 Turbo", "1.8 Ecotec", "2.0 16V"]])),
    "Trailblazer": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.8 Turbo Diesel", "3.6 V6"]])),
    "Vectra": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["2.0 8V", "2.2 16V", "2.4 16V"]])),
    "Zafira": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2012 - i).map(y => [y.toString(), ["2.0 8V", "2.0 16V"]]))
  },
  "Fiat": {
    "Argo": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Firefly", "1.3 Firefly", "1.8 E.torQ"]])),
    "Bravo": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.4 T-Jet", "1.8 E.torQ"]])),
    "Cronos": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Firefly", "1.3 Firefly", "1.8 E.torQ"]])),
    "Doblo": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.3 16V Fire", "1.4 Fire", "1.6 16V", "1.8 Powertrain", "1.8 E.torQ"]])),
    "Ducato": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.3 Multijet", "2.8 Turbo Diesel"]])),
    "Fiorino": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Fire", "1.4 Fire"]])),
    "Freemont": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2016 - i).map(y => [y.toString(), ["2.4 16V"]])),
    "Grand Siena": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 Fire", "1.4 Fire", "1.6 E.torQ"]])),
    "Idea": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.4 Fire", "1.6 E.torQ", "1.8 Powertrain", "1.8 E.torQ"]])),
    "Linea": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.4 T-Jet", "1.8 E.torQ", "1.9 16V"]])),
    "Marea": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2007 - i).map(y => [y.toString(), ["1.6 16V", "1.8 16V", "2.0 20V", "2.0 20V Turbo", "2.4 20V"]])),
    "Mobi": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Fire", "1.0 Firefly"]])),
    "Palio": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2018 - i).map(y => [y.toString(), ["1.0 Fire", "1.3 Fire", "1.4 Fire", "1.5", "1.6 8V", "1.6 16V", "1.8 Powertrain"]])),
    "Palio Weekend": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.3 Fire", "1.4 Fire", "1.5", "1.6 16V", "1.8 Powertrain", "1.8 E.torQ"]])),
    "Punto": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2017 - i).map(y => [y.toString(), ["1.4 Fire", "1.4 T-Jet", "1.6 E.torQ", "1.8 Powertrain", "1.8 E.torQ"]])),
    "Pulse": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Turbo 200 Flex", "1.3 Firefly"]])),
    "Siena": Object.fromEntries(Array.from({ length: 21 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.0 Fire", "1.3 Fire", "1.4 Fire", "1.5", "1.6 8V", "1.6 16V"]])),
    "Stilo": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2011 - i).map(y => [y.toString(), ["1.8 8V", "1.8 16V", "2.4 20V"]])),
    "Strada": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 Firefly", "1.4 Fire", "1.5", "1.6 16V", "1.8 Powertrain", "1.8 E.torQ", "1.0 Turbo 200 Flex"]])),
    "Toro": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.8 E.torQ", "1.3 Turbo 270 Flex", "2.0 Turbo Diesel", "2.4 Tigershark"]])),
    "Uno": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 Mille Fire", "1.0 Fire", "1.0 Firefly", "1.3 Firefly", "1.4 Fire"]]))
  },
  "Toyota": {
    "Camry": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.4 16V", "2.5 16V", "3.0 V6", "3.5 V6"]])),
    "Corolla": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 16V", "1.8 16V", "2.0 16V", "1.8 16V Hybrid"]])),
    "Corolla Cross": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V Dynamic Force", "1.8 16V Hybrid"]])),
    "Etios Hatch": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.3 16V", "1.5 16V"]])),
    "Etios Sedan": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.5 16V"]])),
    "Hilux": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.5 Turbo Diesel", "2.7 16V Flex", "2.8 Turbo Diesel", "3.0 Turbo Diesel", "4.0 V6"]])),
    "Prius": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.8 16V Hybrid"]])),
    "RAV4": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V", "2.4 16V", "2.5 16V Hybrid"]])),
    "SW4": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.7 16V Flex", "2.8 Turbo Diesel", "3.0 Turbo Diesel", "4.0 V6"]])),
    "Yaris Hatch": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 16V", "1.5 16V"]])),
    "Yaris Sedan": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 16V"]]))
  },
  "Honda": {
    "Accord": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V Hybrid", "2.2 16V", "2.4 16V", "3.0 V6", "3.5 V6"]])),
    "City": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 16V i-VTEC", "1.5 16V DI DOHC"]])),
    "City Hatchback": Object.fromEntries(Array.from({ length: 3 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 16V DI DOHC"]])),
    "Civic Sedan": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 Turbo", "1.7 16V VTEC", "1.8 16V i-VTEC", "2.0 16V i-VTEC", "2.0 16V Hybrid"]])),
    "Civic Hatchback": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 Turbo", "2.0 16V e:HEV Hybrid"]])),
    "Civic Type R": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 VTEC Turbo Type R"]])),
    "CR-V": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V", "2.4 16V", "1.5 Turbo"]])),
    "Fit Hatch": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.4 8V", "1.4 16V i-VTEC", "1.5 16V VTEC", "1.5 16V i-VTEC"]])),
    "HR-V": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 DI i-VTEC", "1.5 Turbo", "1.8 16V i-VTEC"]])),
    "WR-V": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.5 16V i-VTEC"]]))
  },
  "Hyundai": {
    "Azera": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2022 - i).map(y => [y.toString(), ["3.0 V6", "3.3 V6"]])),
    "Creta": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 TGDI", "1.6 16V Flex", "2.0 16V Flex", "2.0 Smartstream"]])),
    "Elantra": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.8 16V", "2.0 16V Flex"]])),
    "HB20": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 12V Flex", "1.0 TGDI", "1.0 Turbo", "1.6 16V Flex"]])),
    "HB20S": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 12V Flex", "1.0 TGDI", "1.0 Turbo", "1.6 16V Flex"]])),
    "HB20X": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2022 - i).map(y => [y.toString(), ["1.6 16V Flex"]])),
    "i30": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.6 16V Flex", "1.8 16V", "2.0 16V"]])),
    "ix35": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2022 - i).map(y => [y.toString(), ["2.0 16V Flex"]])),
    "Santa Fe": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2020 - i).map(y => [y.toString(), ["2.4 16V", "2.7 V6", "3.3 V6", "3.5 V6"]])),
    "Sonata": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2014 - i).map(y => [y.toString(), ["2.4 16V"]])),
    "Tucson": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 Turbo GDI", "2.0 16V Flex", "2.7 V6"]])),
    "Veloster": Object.fromEntries(Array.from({ length: 3 }, (_, i) => 2014 - i).map(y => [y.toString(), ["1.6 16V"]])),
    "Vera Cruz": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2012 - i).map(y => [y.toString(), ["3.8 V6"]]))
  },
  "Ford": {
    "Courier": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2013 - i).map(y => [y.toString(), ["1.6 Zetec Rocam"]])),
    "EcoSport": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 Supercharger", "1.5 Dragon", "1.6 Sigma", "1.6 Zetec Rocam", "2.0 Direct Flex", "2.0 Duratec"]])),
    "Edge": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2021 - i).map(y => [y.toString(), ["3.5 V6", "2.0 EcoBoost"]])),
    "F-250": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2011 - i).map(y => [y.toString(), ["3.9 Cummins Diesel", "4.2 MWM Diesel"]])),
    "Fiesta Hatch": Object.fromEntries(Array.from({ length: 20 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.0 Zetec Rocam", "1.5 Sigma", "1.6 Sigma", "1.6 Zetec Rocam"]])),
    "Fiesta Sedan": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2014 - i).map(y => [y.toString(), ["1.0 Zetec Rocam", "1.6 Zetec Rocam"]])),
    "Focus Hatch": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.6 Sigma", "1.6 Zetec Rocam", "2.0 16V Zetec", "2.0 Duratec", "2.0 Direct Flex"]])),
    "Focus Sedan": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2013 - i).map(y => [y.toString(), ["1.6 Zetec Rocam", "1.8 16V Zetec", "2.0 16V Zetec", "2.0 Duratec"]])),
    "Focus SW (Wagon)": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2013 - i).map(y => [y.toString(), ["2.0 16V Zetec", "2.0 Duratec"]])),
    "Focus ST": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2019 - i).map(y => [y.toString(), ["2.0 EcoBoost ST"]])),
    "Fusion Sedan": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2019 - i).map(y => [y.toString(), ["2.0 EcoBoost", "2.0 Hybrid", "2.3 16V", "2.5 16V Flex", "3.0 V6"]])),
    "Ka Hatch": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 Zetec Rocam", "1.0 Ti-VCT", "1.5 Sigma", "1.5 Dragon", "1.6 Zetec Rocam"]])),
    "Ka Sedan": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2021 - i).map(y => [y.toString(), ["1.0 Ti-VCT", "1.5 Sigma", "1.5 Dragon"]])),
    "Mustang Fastback": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["5.0 V8 Coyote"]])),
    "Mustang Convertible": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["5.0 V8 Coyote"]])),

    "Ranger": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo Diesel", "2.2 Diesel", "2.3 16V Gasolina", "2.5 Flex", "3.0 PowerStroke", "3.0 V6 Diesel", "3.2 Diesel"]])),
    "Territory": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 EcoBoost"]]))
  },
  "Jeep": {
    "Cherokee": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2021 - i).map(y => [y.toString(), ["3.2 V6", "3.7 V6"]])),
    "Commander": Object.fromEntries(Array.from({ length: 4 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 T270 Flex", "2.0 Turbodiesel"]])),
    "Compass": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 T270 Flex", "2.0 Gasolina", "2.0 Tigershark Flex", "2.0 Turbodiesel"]])),
    "Grand Cherokee": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 V6 Diesel", "3.6 V6", "4.7 V8", "5.7 V8"]])),
    "Renegade": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 T270 Flex", "1.8 E.torQ", "2.0 Turbodiesel"]])),
    "Wrangler": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo", "3.6 V6", "3.8 V6", "4.0 L6"]]))
  },
  "Renault": {
    "Captur": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 TCe", "1.6 SCe", "2.0 16V"]])),
    "Clio": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2016 - i).map(y => [y.toString(), ["1.0 8V", "1.0 16V", "1.6 8V", "1.6 16V"]])),
    "Duster": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 TCe", "1.6 16V", "1.6 SCe", "2.0 16V"]])),
    "Duster Oroch": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.3 TCe", "1.6 16V", "1.6 SCe", "2.0 16V"]])),
    "Fluence": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2018 - i).map(y => [y.toString(), ["2.0 16V", "2.0 Turbo"]])),
    "Kwid": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 SCe"]])),
    "Logan": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 16V", "1.0 SCe", "1.6 8V", "1.6 16V", "1.6 SCe"]])),
    "Megane": Object.fromEntries(Array.from({ length: 15 }, (_, i) => 2013 - i).map(y => [y.toString(), ["1.6 16V", "2.0 16V"]])),
    "Sandero": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 16V", "1.0 SCe", "1.6 8V", "1.6 16V", "1.6 SCe", "2.0 R.S."]])),
    "Stepway": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 SCe", "1.6 8V", "1.6 16V", "1.6 SCe"]])),
    "Symbol": Object.fromEntries(Array.from({ length: 5 }, (_, i) => 2013 - i).map(y => [y.toString(), ["1.6 8V", "1.6 16V"]]))
  },
  "Nissan": {
    "Frontier": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.3 Bi-Turbo Diesel", "2.5 Turbo Diesel", "2.8 Sprint Diesel"]])),
    "Kicks": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 16V Flex"]])),
    "Livina": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2014 - i).map(y => [y.toString(), ["1.6 16V Flex", "1.8 16V Flex"]])),
    "March": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.0 16V Flex", "1.0 12V", "1.6 16V Flex"]])),
    "Sentra": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V", "2.0 16V Flex"]])),
    "Tiida": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2013 - i).map(y => [y.toString(), ["1.8 16V Flex"]])),
    "Versa": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 12V", "1.6 16V Flex"]]))
  },
  "Peugeot": {
    "2008": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 16V Flex", "1.6 THP Flex"]])),
    "206": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2010 - i).map(y => [y.toString(), ["1.0 16V", "1.4 8V", "1.6 8V", "1.6 16V"]])),
    "207": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2015 - i).map(y => [y.toString(), ["1.4 8V", "1.6 16V"]])),
    "208": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Firefly", "1.0 Turbo 200", "1.2 PureTech", "1.5 8V", "1.6 16V Flex", "1.6 THP"]])),
    "3008": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 THP"]])),
    "307": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2012 - i).map(y => [y.toString(), ["1.6 16V", "2.0 16V"]])),
    "308": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.6 16V", "1.6 THP", "2.0 16V"]])),
    "408": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.6 THP", "2.0 16V"]]))
  },
  "Citroën": {
    "Aircross": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.5 8V", "1.6 16V"]])),
    "C3": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.0 Firefly", "1.2 PureTech", "1.4 8V", "1.5 8V", "1.6 16V"]])),
    "C4 Cactus": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 16V Flex", "1.6 THP"]])),
    "C4 Lounge": Object.fromEntries(Array.from({ length: 8 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.6 THP", "2.0 16V"]])),
    "C4 Pallas": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2013 - i).map(y => [y.toString(), ["2.0 16V"]])),
    "Xsara Picasso": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2012 - i).map(y => [y.toString(), ["1.6 16V", "2.0 16V"]]))
  },
  "Mitsubishi": {
    "ASX": Object.fromEntries(Array.from({ length: 12 }, (_, i) => 2022 - i).map(y => [y.toString(), ["2.0 16V"]])),
    "Eclipse Cross": Object.fromEntries(Array.from({ length: 6 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.5 Turbo"]])),
    "L200 Triton": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.4 Turbo Diesel", "3.2 Turbo Diesel", "3.5 V6 Flex"]])),
    "Outlander": Object.fromEntries(Array.from({ length: 17 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V", "2.2 Turbo Diesel", "3.0 V6"]])),
    "Pajero Dakar": Object.fromEntries(Array.from({ length: 9 }, (_, i) => 2017 - i).map(y => [y.toString(), ["3.2 Turbo Diesel", "3.5 V6 Flex"]])),
    "Pajero Full": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2021 - i).map(y => [y.toString(), ["3.2 Turbo Diesel", "3.8 V6"]])),
    "Pajero TR4": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2015 - i).map(y => [y.toString(), ["2.0 16V", "2.0 16V Flex"]]))
  },
  "Kia": {
    "Cerato": Object.fromEntries(Array.from({ length: 18 }, (_, i) => 2024 - i).map(y => [y.toString(), ["1.6 16V", "2.0 16V"]])),
    "Picanto": Object.fromEntries(Array.from({ length: 14 }, (_, i) => 2019 - i).map(y => [y.toString(), ["1.0 12V", "1.1 12V"]])),
    "Sorento": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.4 16V", "2.5 Turbodiesel", "3.3 V6", "3.5 V6", "3.8 V6"]])),
    "Soul": Object.fromEntries(Array.from({ length: 11 }, (_, i) => 2020 - i).map(y => [y.toString(), ["1.6 16V"]])),
    "Sportage": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 16V", "2.7 V6"]]))
  },
  "Land Rover": {
    "Defender": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo", "3.0 Diesel MHEV", "2.4 Diesel", "2.5 Diesel"]])),
    "Discovery": Object.fromEntries(Array.from({ length: 25 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 V6 Diesel", "4.0 V6", "2.7 V6 Diesel", "3.0 V6 Gasolina"]])),
    "Discovery Sport": Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo Flex", "2.0 Turbodiesel"]])),
    "Evoque": Object.fromEntries(Array.from({ length: 13 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo Flex", "2.2 Turbodiesel", "2.0 Turbodiesel"]])),
    "Range Rover Sport": Object.fromEntries(Array.from({ length: 19 }, (_, i) => 2024 - i).map(y => [y.toString(), ["3.0 V6 Diesel", "3.0 V6 Gasolina", "5.0 V8 Supercharged"]])),
    "Range Rover Velar": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 Turbo", "3.0 V6", "2.0 Turbodiesel"]]))
  },
  "Volvo": {
    "C30": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2013 - i).map(y => [y.toString(), ["2.0", "2.5 T5"]])),
    "S60": Object.fromEntries(Array.from({ length: 24 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 T4", "2.0 T5", "2.0 T8 Hybrid"]])),
    "V40": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2019 - i).map(y => [y.toString(), ["2.0 T4", "2.0 T5"]])),
    "XC40": Object.fromEntries(Array.from({ length: 7 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 T4", "2.0 T5 Hybrid", "Recharge Electric"]])),
    "XC60": Object.fromEntries(Array.from({ length: 16 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 T5", "2.0 T8 Hybrid", "3.0 T6"]])),
    "XC90": Object.fromEntries(Array.from({ length: 22 }, (_, i) => 2024 - i).map(y => [y.toString(), ["2.0 T8 Hybrid", "2.5 T", "3.2", "4.4 V8"]]))
  }
};

```

---

## ARQUIVO: package.json
```json
{
  "name": "autoparts-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:push": "node db-push.mjs"
  },
  "dependencies": {
    "@google/genai": "^1.42.0",
    "@google/generative-ai": "^0.24.1",
    "@supabase/supabase-js": "^2.97.0",
    "@types/pg": "^8.18.0",
    "dotenv": "^17.3.1",
    "jimp": "^1.6.0",
    "lucide-react": "^0.575.0",
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/jimp": "^0.2.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```

---

