'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Verificar se temos uma sessão de recovery via URL (o Supabase trata automaticamente e cria a sessão temporary)
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                // Aqui o usuario esta autenticado temporariamente com permissão de trocar a senha
                console.log('Modo de recuperação de senha ativo.');
            }
        });
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (password.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: password });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar a senha. O link pode ter expirado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-4">
            <div className="z-10 w-full max-w-[400px]">
                <div className="flex flex-col items-center justify-center text-center mb-8">
                    <div className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-sm">
                        <KeyRound className="w-8 h-8 text-[#FF2D55]" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Redefinir Senha</h1>
                    <p className="text-[15px] text-[#8E8E93]">
                        Crie uma nova senha forte para acessar sua conta.
                    </p>
                </div>

                <div className="bg-[#1C1C1E]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                    {success ? (
                        <div className="text-center">
                            <div className="p-4 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] mb-6">
                                Senha atualizada com sucesso! Redirecionando para o login...
                            </div>
                            <Link href="/login" className="text-[#FF2D55] hover:text-white transition-colors">
                                Ir para o login agora
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Nova Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55]" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Confirmar Nova Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF2D55]" />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FF2D55]/50 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-[14px]">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center bg-[#FF2D55] hover:bg-[#FF3B30] text-white rounded-2xl p-4 font-semibold text-[16px] transition-all disabled:opacity-50 mt-6"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
