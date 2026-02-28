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
    onSelect: (query: string, result: string) => void;
}

export function SearchHistory({ onSelect }: SearchHistoryProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            try {
                const { data, error } = await supabase
                    .from('search_history')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(4);

                if (!error && data) {
                    setHistory(data);
                }
            } catch (err) {
                console.error('Erro ao buscar histórico:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, []);

    if (loading || history.length === 0) return null;

    return (
        <div className="max-w-3xl mx-auto w-full mb-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <h3 className="text-gray-900 dark:text-gray-100 font-semibold text-[17px] tracking-tight">Recentes</h3>
                </div>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-black/5 dark:border-white/5">
                {history.map((item, index) => (
                    <div key={item.id} className="relative">
                        <button
                            onClick={() => onSelect(item.query, item.result)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors duration-200 group text-left active:bg-gray-100 dark:active:bg-zinc-800"
                        >
                            <div className="truncate pr-4 flex-1">
                                <p className="text-[17px] text-black dark:text-white font-medium truncate">
                                    {item.query}
                                </p>
                                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {new Date(item.created_at).toLocaleDateString('pt-BR', {
                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-[#007AFF] transition-colors" />
                            </div>
                        </button>
                        {index < history.length - 1 && (
                            <div className="absolute bottom-0 left-4 right-0 h-[1px] bg-gray-100 dark:bg-zinc-800" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
