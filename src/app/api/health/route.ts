import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const maxDuration = 15;

export async function GET() {
    const timestamp = new Date().toISOString();
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // 1. Check Database (Supabase)
    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('cupons')
            .select('id', { count: 'exact', head: true });
        const latency = Date.now() - start;

        if (error) {
            checks.database = { status: 'error', error: error.message, latency_ms: latency };
            overallStatus = 'critical';
        } else {
            checks.database = { status: 'ok', latency_ms: latency };
        }
    } catch (err: any) {
        checks.database = { status: 'error', error: err.message };
        overallStatus = 'critical';
    }

    // 2. Check Coupons Status (active vs expired)
    try {
        const today = new Date().toISOString().split('T')[0];

        const { count: activeCount } = await supabase
            .from('cupons')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
            .gte('data_validade', today);

        const { count: expiredCount } = await supabase
            .from('cupons')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
            .lt('data_validade', today);

        const { count: totalCount } = await supabase
            .from('cupons')
            .select('*', { count: 'exact', head: true });

        checks.coupons = {
            status: (activeCount ?? 0) > 0 ? 'ok' : 'warning',
            active: activeCount ?? 0,
            expired: expiredCount ?? 0,
            total: totalCount ?? 0
        };

        if ((activeCount ?? 0) === 0) {
            overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
        }
    } catch (err: any) {
        checks.coupons = { status: 'error', error: err.message };
        overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
    }

    // 3. Check Gemini API Key
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        checks.gemini_api = { status: 'error', error: 'GEMINI_API_KEY não configurada' };
        overallStatus = 'critical';
    } else {
        checks.gemini_api = { status: 'ok', key_configured: true };
    }

    // 4. Check Recent Errors (last 24h)
    try {
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { data: recentErrors, count } = await supabase
            .from('system_errors')
            .select('error_message, created_at', { count: 'exact' })
            .gte('created_at', yesterday.toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

        checks.recent_errors = {
            status: (count ?? 0) > 10 ? 'warning' : 'ok',
            count_24h: count ?? 0,
            latest: recentErrors?.slice(0, 3).map(e => ({
                message: e.error_message?.substring(0, 120),
                at: e.created_at
            })) || []
        };

        if ((count ?? 0) > 10) {
            overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
        }
    } catch (err: any) {
        checks.recent_errors = { status: 'error', error: err.message };
    }

    // 5. Check Auth Service
    try {
        const start = Date.now();
        const { error } = await supabase.auth.getSession();
        const latency = Date.now() - start;
        checks.auth_service = { status: error ? 'error' : 'ok', latency_ms: latency };
        if (error) {
            overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
        }
    } catch (err: any) {
        checks.auth_service = { status: 'error', error: err.message };
        overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
    }

    return NextResponse.json({
        status: overallStatus,
        timestamp,
        version: '1.1',
        checks
    });
}
