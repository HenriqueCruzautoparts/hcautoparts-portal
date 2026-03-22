'use client';

import { ChevronLeft, LifeBuoy, Mail, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function SupportPage() {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        setTimeout(() => {
            setStatus('success');
            setSubject('');
            setMessage('');
            setTimeout(() => setStatus('idle'), 5000);
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#FF2D55]/30 p-4">
            <div className="max-w-2xl mx-auto py-10">

                {/* Header com logo */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="inline-flex items-center text-[#8E8E93] hover:text-white transition-colors group">
                        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                        Voltar para Início
                    </Link>
                    <Link href="/" className="inline-flex items-center justify-center p-2 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-sm backdrop-blur-md hover:bg-white/5 transition-colors group">
                        <Image src="/logo.png" alt="AutoParts AI Logo" width={28} height={28} className="rounded-lg shadow-[0_0_10px_rgba(255,45,85,0.4)] group-hover:scale-110 transition-transform" />
                        <span className="ml-2 text-sm font-semibold text-white tracking-tight">AutoParts AI</span>
                    </Link>
                </div>

                <div className="flex flex-col items-center justify-center text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-[#32ADE6]/10 border border-[#32ADE6]/20 flex items-center justify-center mb-4">
                        <LifeBuoy className="w-8 h-8 text-[#32ADE6]" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Central de Suporte</h1>
                    <p className="text-[#8E8E93] text-[15px] max-w-md">
                        Encontrou algum problema nas pesquisas ou precisa de ajuda com a sua conta? Nossa equipe está pronta para auxiliar.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* WhatsApp */}
                    <a
                        href="https://wa.me/5563981144408"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center hover:border-[#34C759]/30 transition-colors group"
                    >
                        <MessageSquare className="w-6 h-6 text-[#34C759] mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-white mb-1">WhatsApp</h3>
                        <p className="text-sm text-[#8E8E93] mb-4">Atendimento rápido das 08h às 18h.</p>
                        <span className="w-full py-2.5 rounded-xl bg-[#34C759]/10 text-[#34C759] font-medium group-hover:bg-[#34C759]/20 transition-colors text-center">
                            Conversar Agora
                        </span>
                    </a>

                    {/* E-mail */}
                    <a
                        href="mailto:suporte@hcautoparts.com.br"
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center hover:border-[#FFCC00]/30 transition-colors group"
                    >
                        <Mail className="w-6 h-6 text-[#FFCC00] mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="font-semibold text-white mb-1">E-mail</h3>
                        <p className="text-sm text-[#8E8E93] mb-4">Para dúvidas mais detalhadas ou parcerias.</p>
                        <span className="w-full py-2.5 rounded-xl bg-[#FFCC00]/10 text-[#FFCC00] font-medium group-hover:bg-[#FFCC00]/20 transition-colors text-center">
                            Enviar E-mail
                        </span>
                    </a>
                </div>

                {/* Contact Form */}
                <div className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                    <h2 className="text-xl font-bold text-white mb-6">Deixe sua mensagem</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Assunto</label>
                            <input
                                type="text"
                                required
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all"
                                placeholder="Do que você precisa?"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Mensagem</label>
                            <textarea
                                required
                                rows={4}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all resize-none"
                                placeholder="Descreva seu problema ou dúvida em detalhes..."
                            />
                        </div>

                        {status === 'success' && (
                            <div className="p-3.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-[14px] leading-snug">
                                Mensagem enviada com sucesso! Retornaremos o mais breve possível.
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'sending'}
                            className="w-full flex items-center justify-center bg-[#FF2D55] hover:bg-[#FF3B30] text-white rounded-2xl p-4 font-semibold text-[16px] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 mt-2"
                        >
                            {status === 'sending' ? 'Enviando...' : 'Enviar Mensagem'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
