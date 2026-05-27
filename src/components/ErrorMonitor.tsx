'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield, Database, Cpu, Ticket, Bug } from 'lucide-react';

interface HealthCheck {
    status: 'healthy' | 'degraded' | 'critical';
    timestamp: string;
    version: string;
    checks: {
        database?: { status: string; latency_ms?: number; error?: string };
        coupons?: { status: string; active?: number; expired?: number; total?: number; error?: string };
        gemini_api?: { status: string; error?: string };
        recent_errors?: { status: string; count_24h?: number; latest?: Array<{ message: string; at: string }>; error?: string };
        auth_service?: { status: string; latency_ms?: number; error?: string };
    };
}

const STATUS_COLORS = {
    healthy: { bg: 'bg-[#34C759]', text: 'text-[#34C759]', border: 'border-[#34C759]/30', glow: 'shadow-[0_0_12px_rgba(52,199,89,0.4)]' },
    degraded: { bg: 'bg-[#FF9500]', text: 'text-[#FF9500]', border: 'border-[#FF9500]/30', glow: 'shadow-[0_0_12px_rgba(255,149,0,0.4)]' },
    critical: { bg: 'bg-[#FF3B30]', text: 'text-[#FF3B30]', border: 'border-[#FF3B30]/30', glow: 'shadow-[0_0_12px_rgba(255,59,48,0.4)]' },
};

const CHECK_ICONS: Record<string, any> = {
    database: Database,
    coupons: Ticket,
    gemini_api: Cpu,
    recent_errors: Bug,
    auth_service: Shield,
};

const CHECK_LABELS: Record<string, string> = {
    database: 'Banco de Dados',
    coupons: 'Cupons',
    gemini_api: 'API Gemini (IA)',
    recent_errors: 'Erros Recentes',
    auth_service: 'Autenticação',
};

export function ErrorMonitor({ userEmail }: { userEmail?: string | null }) {
    const [health, setHealth] = useState<HealthCheck | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastChecked, setLastChecked] = useState<string>('');
    const [hasNewIssue, setHasNewIssue] = useState(false);

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'henrike.henrique.cn94@gmail.com';
    const isAdmin = userEmail === adminEmail;

    const fetchHealth = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        try {
            const res = await fetch('/api/health', { cache: 'no-store' });
            const data: HealthCheck = await res.json();

            // Detectar se houve mudança de status (para animar o ícone)
            if (health && data.status !== health.status && data.status !== 'healthy') {
                setHasNewIssue(true);
                setTimeout(() => setHasNewIssue(false), 5000);
            }

            setHealth(data);
            setLastChecked(new Date().toLocaleTimeString('pt-BR'));
        } catch (err) {
            setHealth({
                status: 'critical',
                timestamp: new Date().toISOString(),
                version: '?',
                checks: {
                    database: { status: 'error', error: 'Falha ao conectar com o servidor' }
                }
            });
        } finally {
            setLoading(false);
        }
    }, [isAdmin, health]);

    useEffect(() => {
        if (!isAdmin) return;

        // Primeira verificação imediata
        fetchHealth();

        // Polling a cada 60 segundos
        const interval = setInterval(fetchHealth, 60000);
        return () => clearInterval(interval);
    }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isAdmin || !health) return null;

    const colors = STATUS_COLORS[health.status];
    const statusLabel = health.status === 'healthy' ? 'Saudável' : health.status === 'degraded' ? 'Degradado' : 'Crítico';

    return (
        <>
            {/* Floating Indicator Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-[9999] w-12 h-12 rounded-full ${colors.bg}/20 border ${colors.border} backdrop-blur-xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${colors.glow} ${hasNewIssue ? 'animate-bounce' : ''}`}
                title={`Status do Sistema: ${statusLabel}`}
            >
                <div className={`w-3 h-3 rounded-full ${colors.bg} ${health.status !== 'healthy' ? 'animate-pulse' : ''}`} />
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-20 right-6 z-[9999] w-[360px] max-h-[520px] bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className={`flex items-center justify-between p-4 border-b border-white/10`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl ${colors.bg}/15 flex items-center justify-center`}>
                                {health.status === 'healthy' ? (
                                    <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
                                ) : health.status === 'degraded' ? (
                                    <AlertTriangle className={`w-4 h-4 ${colors.text}`} />
                                ) : (
                                    <XCircle className={`w-4 h-4 ${colors.text}`} />
                                )}
                            </div>
                            <div>
                                <h3 className={`text-[14px] font-bold ${colors.text}`}>
                                    Sistema {statusLabel}
                                </h3>
                                <p className="text-[11px] text-[#8E8E93]">
                                    v{health.version} · {lastChecked}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); fetchHealth(); }}
                                className="p-2 rounded-lg hover:bg-white/10 text-[#8E8E93] hover:text-white transition-colors"
                                title="Atualizar"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-lg hover:bg-white/10 text-[#8E8E93] hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Checks List */}
                    <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                        {Object.entries(health.checks).map(([key, check]) => {
                            const Icon = CHECK_ICONS[key] || Activity;
                            const label = CHECK_LABELS[key] || key;
                            const isOk = check.status === 'ok';
                            const isWarning = check.status === 'warning';

                            return (
                                <div
                                    key={key}
                                    className={`rounded-xl p-3 border transition-colors ${isOk ? 'bg-[#2C2C2E]/40 border-white/5' : isWarning ? 'bg-[#FF9500]/5 border-[#FF9500]/20' : 'bg-[#FF3B30]/5 border-[#FF3B30]/20'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <Icon className={`w-4 h-4 ${isOk ? 'text-[#34C759]' : isWarning ? 'text-[#FF9500]' : 'text-[#FF3B30]'}`} />
                                            <span className="text-[13px] font-medium text-white">{label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(check as any).latency_ms !== undefined && (
                                                <span className="text-[10px] text-[#8E8E93] font-mono">{(check as any).latency_ms}ms</span>
                                            )}
                                            <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-[#34C759]' : isWarning ? 'bg-[#FF9500] animate-pulse' : 'bg-[#FF3B30] animate-pulse'}`} />
                                        </div>
                                    </div>

                                    {/* Extra info for coupons */}
                                    {key === 'coupons' && (check as any).active !== undefined && (
                                        <div className="mt-2 flex gap-3 text-[11px]">
                                            <span className="text-[#34C759]">✓ {(check as any).active} ativos</span>
                                            {((check as any).expired ?? 0) > 0 && (
                                                <span className="text-[#FF9500]">⚠ {(check as any).expired} vencidos</span>
                                            )}
                                            <span className="text-[#8E8E93]">Total: {(check as any).total}</span>
                                        </div>
                                    )}

                                    {/* Extra info for errors */}
                                    {key === 'recent_errors' && (check as any).count_24h !== undefined && (
                                        <div className="mt-2">
                                            <span className={`text-[11px] ${((check as any).count_24h ?? 0) > 5 ? 'text-[#FF9500]' : 'text-[#8E8E93]'}`}>
                                                {(check as any).count_24h} erro(s) nas últimas 24h
                                            </span>
                                            {(check as any).latest && (check as any).latest.length > 0 && (
                                                <div className="mt-1.5 space-y-1">
                                                    {(check as any).latest.map((err: any, i: number) => (
                                                        <div key={i} className="text-[10px] text-[#8E8E93] bg-black/30 rounded-lg px-2 py-1.5 font-mono break-all">
                                                            <span className="text-[#FF3B30]/80">{new Date(err.at).toLocaleTimeString('pt-BR')}</span>
                                                            {' '}{err.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Error message */}
                                    {check.error && (
                                        <p className="mt-1.5 text-[11px] text-[#FF3B30]/80 font-mono break-all">{check.error}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
