import { useState, useEffect } from 'react';
import { X, Phone, MapPin, Loader2, Home, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CompleteProfileModalProps {
    isOpen: boolean;
    onComplete: () => void;
}

export function CompleteProfileModal({ isOpen, onComplete }: CompleteProfileModalProps) {
    const [isMounted, setIsMounted] = useState(false);
    
    const [whatsapp, setWhatsapp] = useState('');
    const [cep, setCep] = useState('');
    const [address, setAddress] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressComplement, setAddressComplement] = useState('');

    const [loading, setLoading] = useState(false);
    const [fetchingCep, setFetchingCep] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
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

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Usuário não logado.");

            // 1. Atualiza nos metadados ocultos do Auth (usado para decidir esconder esse pop-up)
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    whatsapp: whatsapp,
                    cep: cep,
                    address: address,
                    address_number: addressNumber,
                    address_complement: addressComplement
                }
            });
            if (authError) throw authError;

            // 2. Atualiza (ou insere) na tabela pública Profiles (lida na tela de Perfil e outras)
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                    whatsapp: whatsapp,
                    cep: cep,
                    address: address,
                    address_number: addressNumber,
                    address_complement: addressComplement
                }, { onConflict: 'id' });
            
            if (profileError) {
                console.error("Erro ao salvar no profile:", profileError);
                // Não falha o fluxo se der erro apenas aqui, pois no auth já salvou
            }

            onComplete();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar os dados. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <div className="relative w-full max-w-lg bg-[#1C1C1E] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-300 z-10 max-h-[90vh] overflow-y-auto no-scrollbar">
                
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-gradient-to-br from-[#FF9F0A]/20 to-[#FF9F0A]/10 rounded-2xl border border-[#FF9F0A]/30">
                        <CheckCircle2 className="w-10 h-10 text-[#FF9F0A]" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Falta Pouco!</h2>
                    <p className="text-[#8E8E93] text-sm">
                        Para encontrarmos as peças mais próximas a você, complete os dados de entrega.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* WhatsApp Input */}
                    <div>
                        <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">WhatsApp</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Phone className="h-5 w-5 text-[#8E8E93] group-focus-within:text-[#FF9F0A] transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.value)}
                                required
                                placeholder="(11) 90000-0000"
                                className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF9F0A]/50 transition-all"
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
                                        {fetchingCep ? <Loader2 className="h-4 w-4 animate-spin text-[#FF9F0A]" /> : <MapPin className="h-4 w-4 text-[#8E8E93] group-focus-within:text-[#FF9F0A]" />}
                                    </div>
                                    <input
                                        type="text"
                                        value={cep}
                                        onChange={handleCepChange}
                                        maxLength={8}
                                        required
                                        placeholder="00000000"
                                        className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF9F0A]/50 transition-all text-sm"
                                    />
                                </div>
                            </div>
                            <div className="w-1/2">
                                <label className="block text-sm font-medium text-[#E5E5EA] mb-2 px-1">Número</label>
                                <input
                                    type="text"
                                    value={addressNumber}
                                    onChange={(e) => setAddressNumber(e.target.value)}
                                    required
                                    placeholder="Ex: 123"
                                    className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF9F0A]/50 transition-all text-sm"
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
                                className="w-full bg-[#2C2C2E]/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#FF9F0A]/50 transition-all text-sm"
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
                        className="w-full flex items-center justify-center bg-[#FF9F0A] hover:bg-[#FF9F0A]/90 text-white rounded-2xl p-4 font-semibold text-[16px] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(255,159,10,0.39)] mt-6"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar e Continuar'}
                    </button>
                </form>
            </div>
            
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
