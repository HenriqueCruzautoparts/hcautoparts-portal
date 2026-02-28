'use client';

import { useState } from 'react';
import { Search, LayoutDashboard, Activity, CheckCircle2, ImagePlus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchHistory } from '@/components/SearchHistory';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("A imagem deve ter no máximo 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setImageBase64(base64String);
        setError(null);
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
    if (!query.trim() && !imageBase64) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = { query };
      if (imageBase64) {
        payload.image = imageBase64;
      }

      const res = await fetch('/api/pesquisa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar dados.');
      }

      // Process "RAW_URL:" format from prompt to standard markdown links
      // Agora data já é o objeto estruturado { query, analise_tecnica, ml_results }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-8 md:py-16 max-w-5xl">

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
        <div className="max-w-3xl mx-auto w-full mb-12 relative">
          <form
            onSubmit={handleSearch}
            className="relative flex flex-col bg-[#1C1C1E]/70 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 shadow-[0_8px_30px_rgb(255,45,85,0.05)] focus-within:ring-2 focus-within:ring-[#FF2D55]/50 transition-all duration-300"
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

              <label className="cursor-pointer p-2 rounded-full hover:bg-white/5 transition-colors group relative">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={loading}
                />
                <ImagePlus className="w-5 h-5 text-[#8E8E93] group-hover:text-[#FF2D55] transition-colors" />
              </label>

              <input
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-white px-2 py-3 text-[17px] placeholder:text-[#8E8E93]"
                placeholder="Chassi, código OEM ou descrição da peça..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || (!query.trim() && !imageBase64)}
                className="bg-gradient-to-r from-[#FF2D55] to-[#FF3B30] hover:from-[#FF3B30] hover:to-[#FF2D55] text-white rounded-full px-6 py-3 font-semibold text-[15px] transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ml-2 shadow-[0_4px_14px_0_rgba(255,45,85,0.39)]"
              >
                <span>{loading ? 'Buscando...' : 'Buscar'}</span>
                {!loading && (
                  <div className="absolute inset-0 h-full w-full opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:animate-shimmer" />
                )}
              </button>
            </div>
          </form>
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

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500 py-12">
            <div className="w-8 h-8 border-4 border-[#FF2D55]/20 border-t-[#FF2D55] rounded-full animate-spin" />
            <p className="text-[#8E8E93] font-medium text-[15px]">
              Buscando informações e catálogos...
            </p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {result.ml_results.map((item: any) => {
                    let href = item.link;
                    const mlAffiliateId = process.env.NEXT_PUBLIC_ML_AFFILIATE_ID;
                    if (href.includes('mercadolivre.com.br') && mlAffiliateId) {
                      try {
                        const url = new URL(href);
                        url.searchParams.set('af_prid', mlAffiliateId);
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
                        <div className="h-40 w-full bg-white/95 flex items-center justify-center p-4">
                          <img src={item.thumbnail} alt={item.title} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                        </div>
                        <div className="p-4 flex flex-col flex-grow justify-between bg-[#2C2C2E]/80">
                          <h3 className="text-[15px] font-medium text-white line-clamp-2 mb-3 leading-snug group-hover:text-[#FF2D55] transition-colors">
                            {item.title}
                          </h3>
                          <div>
                            {item.price !== null ? (
                              <p className="text-[22px] font-bold text-white flex items-start">
                                <span className="text-sm font-normal text-[#8E8E93] mr-1 mt-1">R$</span>
                                {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.price)}
                              </p>
                            ) : (
                              <p className="text-[17px] font-bold text-white mt-1">
                                Ver Oferta Exata
                              </p>
                            )}
                            <span className="mt-3 w-full block text-center py-2.5 px-4 rounded-xl bg-[#FF2D55]/10 border border-[#FF2D55]/20 text-[#FF2D55] font-bold text-[15px] group-hover:bg-[#FF2D55] group-hover:text-white transition-all duration-300">
                              Clique para Comprar
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
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
