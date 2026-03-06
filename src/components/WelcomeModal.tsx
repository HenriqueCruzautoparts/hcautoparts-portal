'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Verifica se o usuário já viu o modal da versão Beta v1.0
        const hasSeenWelcome = localStorage.getItem('autoparts_beta_welcome_v1');
        if (!hasSeenWelcome) {
            // Pequeno atraso para não assustar o usuário assim que a tela pisca
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('autoparts_beta_welcome_v1', 'true');
    };

    if (!isMounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
            <div
                className="bg-[#1C1C1E] border border-white/10 rounded-[32px] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glow Background */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#FF2D55]/20 blur-[60px] rounded-full pointer-events-none" />

                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8E8E93] hover:text-white transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FF2D55]/10 border border-[#FF2D55]/20 mb-6 mx-auto">
                        <Sparkles className="w-8 h-8 text-[#FF2D55]" />
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center mb-2 tracking-tight">
                        Bem-vindo ao AutoParts AI!
                    </h2>

                    <div className="flex items-center justify-center space-x-2 mb-6">
                        <span className="px-2.5 py-1 rounded-md bg-[#FFCC00]/10 border border-[#FFCC00]/20 text-[#FFCC00] text-[12px] font-bold uppercase tracking-wider">
                            Versão Beta v1.0
                        </span>
                    </div>

                    <div className="space-y-5 text-[15px] leading-relaxed text-[#E5E5EA]">
                        <p>
                            Você está entre os primeiros a testar o futuro da busca de autopeças. Nosso objetivo é <strong>facilitar sua vida, economizar seu tempo e o seu dinheiro</strong>.
                        </p>

                        <div className="bg-[#2C2C2E]/50 rounded-2xl p-4 border border-white/5">
                            <h3 className="font-semibold text-white flex items-center mb-2">
                                <CheckCircle2 className="w-4 h-4 text-[#34C759] mr-2" /> Como funciona?
                            </h3>
                            <ul className="list-disc list-inside text-[#8E8E93] space-y-1.5 ml-1">
                                <li>Digite o nome ou código da peça, ou pesquise pelo chassi do veículo.</li>
                                <li>Nossa IA analisa e descobre a peça exata.</li>
                                <li>Apresentamos as 3 Melhores Ofertas reais.</li>
                                <li>Mostramos um comparativo de Custo-Benefício.</li>
                            </ul>
                        </div>

                        <div className="bg-[#FFCC00]/10 rounded-2xl p-4 border border-[#FFCC00]/20">
                            <h3 className="font-semibold text-[#FFCC00] flex items-center mb-2">
                                <AlertTriangle className="w-4 h-4 mr-2" /> Aviso Importante
                            </h3>
                            <p className="text-[#E5E5EA] text-[14px]">
                                O sistema está em desenvolvimento constante. Por ser uma inteligência artificial em fase de testes, <strong>pode cometer pequenos erros de interpretação ou links</strong>. Caso encontre problemas, use nossa Central de Suporte no menu.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/10">
                    <button
                        onClick={handleClose}
                        className="w-full py-4 rounded-xl bg-[#FF2D55] hover:bg-[#FF3B30] text-white font-bold text-[16px] transition-all transform active:scale-[0.98] shadow-lg"
                    >
                        Entendi, vamos começar!
                    </button>
                </div>
            </div>
        </div>
    );
}
