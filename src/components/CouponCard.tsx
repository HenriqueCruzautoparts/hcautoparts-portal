'use client';

import { useState } from 'react';
import { Tag, Copy, Check, Zap, Clock } from 'lucide-react';

interface CouponData {
    titulo?: string;
    title?: string;
    descricao?: string;
    desc?: string;
    codigo?: string;
    code?: string;
    link?: string;
    data_validade?: string;
}

function getValidityBadge(dataValidade?: string): { text: string; color: string; urgent: boolean } {
    if (!dataValidade) {
        return { text: 'Sem validade definida', color: 'text-[#8E8E93]', urgent: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(dataValidade + 'T00:00:00');
    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { text: 'Expirado', color: 'text-[#FF3B30]', urgent: true };
    }
    if (diffDays === 0) {
        return { text: '⏰ Último dia!', color: 'text-[#FF9500]', urgent: true };
    }
    if (diffDays <= 3) {
        return { text: `⚡ Expira em ${diffDays} dia${diffDays > 1 ? 's' : ''}`, color: 'text-[#FF9500]', urgent: true };
    }
    if (diffDays <= 7) {
        return { text: `Expira em ${diffDays} dias`, color: 'text-[#FFCC00]', urgent: false };
    }

    // Format date as DD/MM
    const day = expiry.getDate().toString().padStart(2, '0');
    const month = (expiry.getMonth() + 1).toString().padStart(2, '0');
    return { text: `Válido até ${day}/${month}`, color: 'text-[#34C759]', urgent: false };
}

export function CouponCard({ coupon, index }: { coupon: CouponData; index: number }) {
    const [copied, setCopied] = useState(false);

    const titulo = coupon.titulo || coupon.title || 'Cupom';
    const descricao = coupon.descricao || coupon.desc || '';
    const codigo = coupon.codigo || coupon.code || '';
    const link = coupon.link || '#';
    const validity = getValidityBadge(coupon.data_validade);

    // Não renderizar cupons expirados
    if (validity.text === 'Expirado') return null;

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(codigo);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col bg-[#2C2C2E]/60 border border-dashed border-[#32ADE6]/40 rounded-2xl p-5 hover:border-[#32ADE6] transition-colors group relative overflow-hidden">
            {/* Badge de Validade Real */}
            <div className={`absolute top-0 right-0 ${validity.urgent ? 'bg-[#FF9500]/10 border-[#FF9500]/20' : 'bg-[#34C759]/10 border-[#34C759]/20'} text-[10px] font-bold px-2.5 py-1 rounded-bl-xl uppercase tracking-widest border-b border-l flex items-center gap-1`}>
                <Clock className={`w-3 h-3 ${validity.color}`} />
                <span className={validity.color}>{validity.text}</span>
            </div>

            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#32ADE6]/10 flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5 text-[#32ADE6]" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-[15px]">{titulo}</h3>
                    <p className="text-[#8E8E93] text-[12px] mt-0.5">{descricao}</p>
                </div>
            </div>

            <div className="mt-auto pt-4 flex items-center gap-2">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between group-hover:border-[#32ADE6]/30 transition-colors">
                    <span className="font-mono text-[#32ADE6] font-bold tracking-wider text-[14px]">{codigo}</span>
                    <button
                        className="text-[#8E8E93] hover:text-white transition-all"
                        title={copied ? 'Copiado!' : 'Copiar cupom'}
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-[#34C759] animate-in zoom-in duration-200" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>
                <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#32ADE6] hover:bg-[#2892C6] text-white p-2.5 rounded-xl transition-colors shrink-0"
                    title="Usar cupom"
                >
                    <Zap className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}
