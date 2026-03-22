'use client';

import { useEffect, useState } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type HistoryItem = {
    id: string;
    query: string;
    created_at: string;
    result: string;
};

interface SearchHistoryProps {
    userId: string | null | undefined;
    onSelect: (query: string, result: string) => void;
}

export function SearchHistory({ userId, onSelect }: SearchHistoryProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            // Aguarda userId estar disponível; se não estiver logado, não busca
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('search_history')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (!error && data) {
                    const uniqueQueries = new Set();
                    const deduplicated: HistoryItem[] = [];
                    for (const item of data) {
                        const lowerQuery = item.query.toLowerCase().trim();
                        if (!uniqueQueries.has(lowerQuery)) {
                            uniqueQueries.add(lowerQuery);
                            deduplicated.push(item);
                            if (deduplicated.length === 4) break;
                        }
                    }
                    setHistory(deduplicated);
                }
            } catch (err) {
                console.error('Erro ao buscar histórico:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [userId]); // Re-executa quando userId mudar (login/logout)

    if (loading || history.length === 0) return null;

    return (
        <div className="max-w-3xl mx-auto w-full mb-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-[#8E8E93]" />
                    <h3 className="text-white font-semibold text-[17px] tracking-tight">Recentes</h3>
                </div>
            </div>
            <div className="bg-[#1C1C1E]/60 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10">
                {history.map((item, index) => (
                    <div key={item.id} className="relative">
                        <button
                            onClick={() => onSelect(item.query, item.result)}
                            className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/5 transition-colors duration-200 group text-left active:bg-white/10"
                        >
                            <div className="truncate pr-4 flex-1">
                                <p className="text-[17px] text-white font-medium truncate group-hover:text-[#FF2D55] transition-colors">
                                    {item.query}
                                </p>
                                <p className="text-[13px] text-[#8E8E93] mt-0.5">
                                    {new Date(item.created_at).toLocaleDateString('pt-BR', {
                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                                <ChevronRight className="w-5 h-5 text-[#8E8E93] group-hover:text-[#FF2D55] transition-colors" />
                            </div>
                        </button>
                        {index < history.length - 1 && (
                            <div className="absolute bottom-0 left-4 right-0 h-[1px] bg-white/5" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
