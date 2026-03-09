import { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, PiggyBank, FolderHeart } from 'lucide-react';

export function DashboardWelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Verifica se o usuário recém-logado já viu este modal de onboarding
        const hasSeenOnboarding = localStorage.getItem('autoparts_user_onboarding_v1');
        if (!hasSeenOnboarding) {
            // Atraso de 2s para o modal aparecer suavemente após o login
            const timer = setTimeout(() => setIsOpen(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('autoparts_user_onboarding_v1', 'true');
    };

    if (!isMounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-lg bg-[#1C1C1E] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-300">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-[#8E8E93] hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-gradient-to-br from-[#FF2D55]/20 to-[#FF3B30]/10 rounded-2xl border border-[#FF2D55]/30">
                        <CheckCircle2 className="w-10 h-10 text-[#FF2D55]" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo(a) à AutoParts AI!</h2>
                    <p className="text-[#8E8E93] text-sm">
                        Seu cadastro foi concluído com sucesso. Agora você tem acesso ilimitado à nova era da busca de autopeças automotivas.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#2C2C2E]/40 border border-white/5">
                        <PiggyBank className="w-6 h-6 text-[#FF2D55] shrink-0 mt-1" />
                        <div>
                            <h3 className="text-white font-medium mb-1">Economia Verificada</h3>
                            <p className="text-[#8E8E93] text-sm">Nossa IA vasculha as bases do Mercado Livre para garantir que você sempre encontre os melhores preços e as marcas mais confiáveis (Cofap, Nakata, Monroe, etc).</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#2C2C2E]/40 border border-white/5">
                        <FolderHeart className="w-6 h-6 text-[#34C759] shrink-0 mt-1" />
                        <div>
                            <h3 className="text-white font-medium mb-1">Histórico Salvo</h3>
                            <p className="text-[#8E8E93] text-sm">Sua conta garante que todas as suas pesquisas fiquem salvas. Assim, você nunca perde aquele link da peça perfeita que demorou a encontrar.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#2C2C2E]/40 border border-white/5">
                        <Search className="w-6 h-6 text-[#0A84FF] shrink-0 mt-1" />
                        <div>
                            <h3 className="text-white font-medium mb-1">Busca por Foto Inteligente</h3>
                            <p className="text-[#8E8E93] text-sm">Pesquise usando a câmera do seu celular! Nosso algoritmo analisa visualmente a peça quebrada e acha uma nova pra você.</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    className="w-full bg-[#FF2D55] hover:bg-[#FF3B30] text-white font-semibold py-4 rounded-2xl transition-all transform active:scale-95 shadow-[0_4px_14px_0_rgba(255,45,85,0.39)]"
                >
                    Começar minha primeira busca
                </button>
            </div>
        </div>
    );
}
