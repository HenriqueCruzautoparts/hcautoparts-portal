'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Lock, Mail, ArrowRight, Loader2, User, Phone, MapPin, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError(null);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar com Google.');
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Digite seu e-mail acima para redefinir a senha.');
            return;
        }
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/resetar-senha`,
            });
            if (error) throw error;
            setMessage('Enviamos um link de recuperação para o seu e-mail!');
        } catch (err: any) {
            setError(err.message || 'Erro ao tentar enviar o e-mail de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    // Extra fields for signup
    const [fullName, setFullName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [cep, setCep] = useState('');
    const [address, setAddress] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressComplement, setAddressComplement] = useState('');

    const [loading, setLoading] = useState(false);
    const [fetchingCep, setFetchingCep] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\\D/g, '');
        setCep(val);

        if (val.length === 8) {
            setFetchingCep(true);
            try {
                const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setAddress(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`);
                } else {
                    setAddress('');
                }
            } catch (err) {
                console.error("Erro ao buscar CEP", err);
            } finally {
                setFetchingCep(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push('/');
            } else {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            whatsapp: whatsapp,
                            cep: cep,
                            address: address,
                            address_number: addressNumber,
                            address_complement: addressComplement
                        },
                        emailRedirectTo: `${window.location.origin}/login`,
                    },
                });
                if (authError) throw authError;

                setMessage('Cadastro realizado com sucesso! Faça login para continuar.');
                setIsLogin(true); // Switch to login view
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro durante a autenticação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-4 selection:bg-[#FF2D55]/30 relative overflow-hidden">
            {/* Decorative Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF2D55] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />

            <div className="z-10 w-full max-w-[500px]">
                {/* Header */}
                <div className="flex flex-col items-center justify-center text-center mb-8">
                    <Link href="/" className="inline-flex items-center justify-center p-2 mb-6 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-sm backdrop-blur-md hover:bg-white/5 transition-colors group cursor-pointer">
                        <Image src="/logo.png" alt="AutoParts AI Logo" width={32} height={32} className="rounded-lg shadow-[0_0_10px_rgba(255,45,85,0.4)] group-hover:scale-110 transition-transform" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                    </h1>
                    <p className="text-[15px] text-[#8E8E93]">
                        {isLogin
                            ? 'Entre para acessar seu histórico de peças.'
                            : 'Junte-se para salvar pesquisas e gerenciar as melhores ofertas.'}
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-[#1C1C1E]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)] max-h-[75vh] overflow-y-auto no-scrollbar">

                    {/* Botão Google */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full mb-6 flex items-center justify-center space-x-3 bg-white hover:bg-gray-100 text-black font-semibold py-3 rounded-2xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Continuar com o Google</span>
                    </button>

                    <div className="relative flex items-center mb-6">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-[#8E8E93] text-sm">ou com e-mail</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {!isLogin && (
                            <>
                                {/* Nome Input */}
                                <div>
                                    <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Nome Completo</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55] transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            required={!isLogin}
                                            placeholder="Seu nome"
                                            className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all"
                                        />
                                    </div>
                                </div>
                                {/* WhatsApp Input */}
                                <div>
                                    <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">WhatsApp</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Phone className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55] transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={whatsapp}
                                            onChange={(e) => setWhatsapp(e.target.value)}
                                            required={!isLogin}
                                            placeholder="(11) 90000-0000"
                                            className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all"
                                        />
                                    </div>
                                </div>
                                {/* Endereço Box */}
                                <div className="p-4 rounded-2xl bg-[#2C2C2E]/30 border border-white/5 space-y-4">
                                    <div className="flex space-x-3">
                                        {/* CEP Input */}
                                        <div className="w-1/2">
                                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">CEP</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    {fetchingCep ? <Loader2 className="h-4 w-4 animate-spin text-[#FF2D55]" /> : <MapPin className="h-4 w-4 text-[#8E8E93] group-focus-within:text-[#FF2D55]" />}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={cep}
                                                    onChange={handleCepChange}
                                                    maxLength={8}
                                                    required={!isLogin}
                                                    placeholder="00000000"
                                                    className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="w-1/2">
                                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Número</label>
                                            <input
                                                type="text"
                                                value={addressNumber}
                                                onChange={(e) => setAddressNumber(e.target.value)}
                                                required={!isLogin}
                                                placeholder="Ex: 123"
                                                className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Endereço Auto</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Home className="h-4 w-4 text-[#8E8E93]" />
                                            </div>
                                            <input
                                                type="text"
                                                value={address}
                                                readOnly
                                                placeholder="Preenchido via CEP"
                                                className="w-full bg-[#1C1C1E] border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-[#8E8E93] text-sm cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Complemento (opcional)</label>
                                        <input
                                            type="text"
                                            value={addressComplement}
                                            onChange={(e) => setAddressComplement(e.target.value)}
                                            placeholder="Apt 42, Bloco B"
                                            className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all text-sm"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">
                                E-mail de Acesso
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55] transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="seu@email.com"
                                    className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">
                                Senha
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55] transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 focus:border-transparent transition-all"
                                />
                            </div>
                            {isLogin && (
                                <div className="flex justify-end mt-2">
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        className="text-[13px] text-[#8E8E93] hover:text-[#FF2D55] transition-colors"
                                    >
                                        Esqueceu sua senha?
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Error/Success Messages */}
                        {error && (
                            <div className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-[14px] leading-snug">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="p-3.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-[14px] leading-snug">
                                {message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center bg-[#FF2D55] hover:bg-[#FF3B30] text-white rounded-2xl p-4 font-semibold text-[16px] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(255,45,85,0.39)] mt-6"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Entrar no Sistema' : 'Criar minha conta'}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle View */}
                    <div className="mt-8 text-center text-[15px]">
                        <span className="text-[#8E8E93]">
                            {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
                        </span>
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                                setMessage(null);
                            }}
                            className="ml-2 font-medium text-[#FF2D55] hover:underline focus:outline-none transition-colors"
                        >
                            {isLogin ? 'Criar agora' : 'Fazer login'}
                        </button>
                    </div>
                </div>
            </div>
            {/* Custom styling to hide scrollbar but keep functionality */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}
