'use client';

import { ShoppingBag, Tag, Zap, TrendingDown } from 'lucide-react';

interface Oferta {
  id: string;
  titulo: string;
  categoria: string;
  preco_original: number;
  preco_atual: number;
  desconto_percent: number;
  dica?: string | null;
  thumbnail?: string | null;
  link_ml: string;
  link_shopee?: string | null;
  fonte: 'ml' | 'ia';
}

const ML_AFFILIATE = 'matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG';

function buildShopeeLink(titulo: string): string {
  return `https://shopee.com.br/search?keyword=${encodeURIComponent(titulo)}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OfertaCard({ oferta, index }: { oferta: Oferta; index: number }) {
  const isHot = oferta.desconto_percent >= 30;
  const shopeeLink = oferta.link_shopee || buildShopeeLink(oferta.titulo);

  return (
    <div className={`relative flex flex-col bg-[#1C1C1E]/80 border ${isHot ? 'border-[#FF2D55]/40 shadow-[0_4px_20px_rgba(255,45,85,0.1)]' : 'border-white/10'} rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]`}>

      {/* Badge de desconto */}
      <div className={`absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${isHot ? 'bg-[#FF2D55] text-white' : 'bg-[#FF9500]/90 text-white'}`}>
        <TrendingDown className="w-3 h-3" />
        -{oferta.desconto_percent}%
      </div>

      {/* Badge de fonte */}
      {oferta.fonte === 'ml' && (
        <div className="absolute top-3 left-3 z-10 bg-[#FF2D55]/10 border border-[#FF2D55]/20 text-[#FF2D55] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          ML Oficial
        </div>
      )}

      {/* Thumbnail ou placeholder */}
      <div className="w-full h-32 bg-[#2C2C2E]/60 flex items-center justify-center overflow-hidden border-b border-white/5">
        {oferta.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={oferta.thumbnail}
            alt={oferta.titulo}
            className="h-full w-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#3A3A3C]">
            <Tag className="w-10 h-10" />
            <span className="text-[10px] font-medium text-[#8E8E93]">{oferta.categoria}</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-white text-[13px] font-semibold leading-snug mb-3 line-clamp-2">
          {oferta.titulo}
        </h3>

        {/* Preços */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-[#FF2D55] font-black text-[20px] leading-none">
            {formatBRL(oferta.preco_atual)}
          </span>
          <span className="text-[#8E8E93] text-[12px] line-through mb-0.5">
            {formatBRL(oferta.preco_original)}
          </span>
        </div>

        {/* Dica técnica */}
        {oferta.dica && (
          <p className="text-[#8E8E93] text-[11px] leading-relaxed mb-3 flex items-start gap-1.5">
            <Zap className="w-3 h-3 text-[#FF9500] shrink-0 mt-0.5" />
            {oferta.dica}
          </p>
        )}

        {/* Botões */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <a
            href={oferta.link_ml}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 bg-[#FF2D55]/10 hover:bg-[#FF2D55]/20 border border-[#FF2D55]/20 hover:border-[#FF2D55]/40 rounded-xl text-white text-[11px] font-bold transition-all"
          >
            <span>🛒</span> ML
          </a>
          <a
            href={shopeeLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 bg-[#EE4D2D]/10 hover:bg-[#EE4D2D]/20 border border-[#EE4D2D]/20 hover:border-[#EE4D2D]/40 rounded-xl text-white text-[11px] font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Shopee
          </a>
        </div>
      </div>
    </div>
  );
}
