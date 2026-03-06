'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, User, Phone, MapPin, CreditCard, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'subscription'>('details');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        whatsapp: '',
        cep: '',
        address: '',
        address_number: '',
        address_complement: ''
    });

    useEffect(() => {
        async function fetchProfile() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            setUser(session.user);

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            setProfile(profileData);
            if (profileData) {
                setEditForm({
                    full_name: profileData.full_name || '',
                    whatsapp: profileData.whatsapp || '',
                    cep: profileData.cep || '',
                    address: profileData.address || '',
                    address_number: profileData.address_number || '',
                    address_complement: profileData.address_complement || ''
                });
            }
            setLoading(false);
        }

        fetchProfile();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Verifica se o perfil existe
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();

            let saveError;

            if (existingProfile) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: editForm.full_name,
                        whatsapp: editForm.whatsapp,
                        cep: editForm.cep,
                        address: editForm.address,
                        address_number: editForm.address_number,
                        address_complement: editForm.address_complement
                    })
                    .eq('id', user.id);
                saveError = error;
            } else {
                const { error } = await supabase
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        full_name: editForm.full_name,
                        whatsapp: editForm.whatsapp,
                        cep: editForm.cep,
                        address: editForm.address,
                        address_number: editForm.address_number,
                        address_complement: editForm.address_complement
                    }]);
                saveError = error;
            }

            if (saveError) {
                console.error("Detalhes do erro do Supabase:", saveError);
                throw saveError;
            }

            // Update local profile state
            setProfile({ ...profile, ...editForm });
            setIsEditing(false);
        } catch (err: any) {
            console.error("Erro ao salvar perfil:", err);
            alert("Não foi possível salvar as alterações. " + (err.message || ''));
        } finally {
            setSaving(false);
        }
    };

    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        setEditForm({ ...editForm, cep: val });

        if (val.length === 8) {
            try {
                const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setEditForm(prev => ({
                        ...prev,
                        address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`
                    }));
                }
            } catch (err) {
                console.error("Erro ao buscar CEP", err);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-[#FF2D55]/20 border-t-[#FF2D55] rounded-full animate-spin" />
                <p className="text-[#8E8E93] font-medium text-[15px]">Carregando seu perfil...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#FF2D55]/30 p-4">
            <div className="max-w-2xl mx-auto py-10">
                {/* Header Back Button */}
                <Link href="/" className="inline-flex items-center text-[#8E8E93] hover:text-white transition-colors mb-8 group">
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    Voltar para Início
                </Link>

                {/* Profile Header Block */}
                <div className="flex flex-col sm:flex-row items-center sm:space-x-5 space-y-4 sm:space-y-0 mb-8 text-center sm:text-left">
                    <div className="w-20 h-20 shrink-0 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center shadow-lg">
                        <User className="w-10 h-10 text-[#FF2D55]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1 truncate">
                            {profile?.full_name || 'Usuário AutoParts'}
                        </h1>
                        <p className="text-[#8E8E93] text-[15px] truncate">{user?.email}</p>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:ml-auto w-full sm:w-auto">
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1C1C1E] text-[#FF3B30] hover:bg-[#FF3B30]/20 font-medium text-[15px] transition-colors border border-white/5 shadow-sm"
                        >
                            <LogOut className="w-4 h-4 mr-2" /> Sair
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 mb-6 bg-[#1C1C1E]/60 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-2.5 rounded-xl font-medium text-[15px] transition-all ${activeTab === 'details' ? 'bg-[#3A3A3C] text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'}`}
                    >
                        Detalhes da Conta
                    </button>
                    <button
                        onClick={() => setActiveTab('subscription')}
                        className={`flex-1 py-2.5 rounded-xl font-medium text-[15px] transition-all ${activeTab === 'subscription' ? 'bg-[#3A3A3C] text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'}`}
                    >
                        Assinatura / Plano
                    </button>
                </div>

                {/* Tab Content */}
                <div className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                    {activeTab === 'details' ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                <h2 className="text-xl font-bold text-white">
                                    Informações Pessoais
                                </h2>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-sm text-[#FF2D55] font-medium hover:text-[#FF3B30] transition-colors bg-[#FF2D55]/10 px-4 py-1.5 rounded-full"
                                    >
                                        Editar Perfil
                                    </button>
                                ) : (
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                // Reset form
                                                if (profile) {
                                                    setEditForm({
                                                        full_name: profile.full_name || '',
                                                        whatsapp: profile.whatsapp || '',
                                                        cep: profile.cep || '',
                                                        address: profile.address || '',
                                                        address_number: profile.address_number || '',
                                                        address_complement: profile.address_complement || ''
                                                    });
                                                }
                                            }}
                                            className="text-sm text-[#8E8E93] hover:text-white transition-colors"
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={saving}
                                            className="text-sm text-white font-medium bg-[#FF2D55] hover:bg-[#FF3B30] px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
                                        >
                                            {saving ? 'Salvando...' : 'Salvar Tudo'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <span className="block text-sm font-medium text-[#8E8E93] mb-1">Nome Completo</span>
                                    <div className={`flex items-center text-white bg-[#2C2C2E]/40 border ${isEditing ? 'border-[#FF2D55]/50 ring-1 ring-[#FF2D55]/20' : 'border-white/5'} rounded-xl px-4 py-3 transition-all`}>
                                        <User className="w-5 h-5 mr-3 text-[#FF2D55]/50" />
                                        {isEditing ? (
                                            <input
                                                value={editForm.full_name}
                                                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                                className="w-full bg-transparent border-none outline-none text-white focus:ring-0 p-0"
                                                placeholder="Seu nome completo"
                                            />
                                        ) : (
                                            profile?.full_name || 'Não informado'
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-[#8E8E93] mb-1">WhatsApp</span>
                                    <div className={`flex items-center text-white bg-[#2C2C2E]/40 border ${isEditing ? 'border-[#FF2D55]/50 ring-1 ring-[#FF2D55]/20' : 'border-white/5'} rounded-xl px-4 py-3 transition-all`}>
                                        <Phone className="w-5 h-5 mr-3 text-[#FF2D55]/50" />
                                        {isEditing ? (
                                            <input
                                                value={editForm.whatsapp}
                                                onChange={e => setEditForm({ ...editForm, whatsapp: e.target.value })}
                                                className="w-full bg-transparent border-none outline-none text-white focus:ring-0 p-0"
                                                placeholder="(11) 90000-0000"
                                            />
                                        ) : (
                                            profile?.whatsapp || 'Não informado'
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="block text-sm font-medium text-[#8E8E93] mb-1">Moradia / Entrega</span>
                                    <div className={`flex items-start text-white bg-[#2C2C2E]/40 border ${isEditing ? 'border-[#FF2D55]/50 ring-1 ring-[#FF2D55]/20' : 'border-white/5'} rounded-xl px-4 py-3 transition-all`}>
                                        <MapPin className="w-5 h-5 mr-3 mt-1.5 text-[#FF2D55]/50 flex-shrink-0" />
                                        {isEditing ? (
                                            <div className="w-full space-y-3">
                                                <div className="flex space-x-3">
                                                    <div className="w-1/3">
                                                        <label className="text-xs text-[#8E8E93]">CEP</label>
                                                        <input
                                                            value={editForm.cep}
                                                            onChange={handleCepChange}
                                                            maxLength={8}
                                                            className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF2D55]/50"
                                                            placeholder="00000000"
                                                        />
                                                    </div>
                                                    <div className="w-2/3">
                                                        <label className="text-xs text-[#8E8E93]">Endereço (Auto)</label>
                                                        <input
                                                            value={editForm.address}
                                                            readOnly
                                                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-[#8E8E93] cursor-not-allowed"
                                                            placeholder="Rua, Bairro..."
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex space-x-3">
                                                    <div className="w-1/4">
                                                        <label className="text-xs text-[#8E8E93]">Número</label>
                                                        <input
                                                            value={editForm.address_number}
                                                            onChange={e => setEditForm({ ...editForm, address_number: e.target.value })}
                                                            className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF2D55]/50"
                                                            placeholder="123"
                                                        />
                                                    </div>
                                                    <div className="w-3/4">
                                                        <label className="text-xs text-[#8E8E93]">Complemento</label>
                                                        <input
                                                            value={editForm.address_complement}
                                                            onChange={e => setEditForm({ ...editForm, address_complement: e.target.value })}
                                                            className="w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF2D55]/50"
                                                            placeholder="Apto 42"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <p>{profile?.address ? `${profile.address}, ${profile.address_number}` : 'Endereço não informado'}</p>
                                                <p className="text-[#8E8E93] text-sm mt-0.5">Complemento: {profile?.address_complement || 'Nenhum'}</p>
                                                <p className="text-[#8E8E93] text-sm mt-0.5">CEP: {profile?.cep || 'Não informado'}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#FF2D55]/10 border border-[#FF2D55]/20 flex items-center justify-center mb-6">
                                <CreditCard className="w-8 h-8 text-[#FF2D55]" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Plano Atual: Gratuito</h2>
                            <p className="text-[#8E8E93] max-w-sm mb-8">
                                Em breve disponibilizaremos planos de assinatura para pesquisas ilimitadas e alertas de preços em tempo real!
                            </p>
                            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl px-6 py-3 font-semibold text-[15px] transition-all duration-300">
                                Aguarde as Novidades
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
