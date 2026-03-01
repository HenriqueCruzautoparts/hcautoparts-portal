'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

export function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Verifica se já está instalado (PWA no modo standalone)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsStandalone(isStandaloneMode);

        // Verifica se é um dispositivo iOS para mostrar a instrução manual
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (!isStandaloneMode) {
            if (isIosDevice) {
                // No iOS não existe o evento 'beforeinstallprompt', então mostramos o banner após alguns segundos
                const hasSeenPrompt = localStorage.getItem('hasSeenInstallPrompt');
                if (!hasSeenPrompt) {
                    setTimeout(() => setShowPrompt(true), 3500);
                }
            } else {
                // No Android/Chrome podemos usar o evento oficial
                const handleBeforeInstallPrompt = (e: any) => {
                    e.preventDefault(); // Impede o mini-infobar padrão de aparecer
                    setDeferredPrompt(e);
                    const hasSeenPrompt = localStorage.getItem('hasSeenInstallPrompt');
                    if (!hasSeenPrompt) {
                        setShowPrompt(true);
                    }
                };

                window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

                return () => {
                    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
                };
            }
        }
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowPrompt(false);
            }
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('hasSeenInstallPrompt', 'true'); // Não mostrar novamente
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="max-w-md mx-auto bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl flex items-start gap-4">
                <div className="flex-1">
                    <h3 className="text-white font-semibold text-[16px] mb-1">
                        Instale o Aplicativo
                    </h3>
                    <p className="text-[#8E8E93] text-[14px] leading-snug mb-4">
                        Adicione o AutoParts AI à sua tela inicial para um acesso mais rápido e focado.
                    </p>

                    {isIOS ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[13px] text-white flex flex-col gap-2">
                            <span className="flex items-center gap-2 text-[#8E8E93]">
                                <Share className="w-5 h-5 text-white" />
                                1. Toque no ícone de Compartilhar
                            </span>
                            <span className="flex items-center gap-2 text-[#8E8E93] ml-[28px]">
                                <span className="font-semibold text-white">2. Adicionar à Tela de Início</span>
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="bg-[#FF2D55] hover:bg-[#FF3B30] text-white px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center w-full gap-2 shadow-lg shadow-[#FF2D55]/20"
                        >
                            <Download className="w-4 h-4" />
                            Instalar Agora
                        </button>
                    )}
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-[#8E8E93] hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Fechar"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
