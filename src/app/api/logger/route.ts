import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { error_message, context, user_id, severity } = body;

        // Enriquecer o contexto com metadados do servidor
        const enrichedContext = {
            ...context,
            server_timestamp: new Date().toISOString(),
            user_agent: req.headers.get('user-agent')?.substring(0, 200) || 'unknown',
            referer: req.headers.get('referer')?.substring(0, 200) || null,
            severity: severity || 'error', // 'info' | 'warning' | 'error' | 'critical'
        };

        const { error } = await supabase
            .from('system_errors')
            .insert([{
                error_message: (error_message || 'Erro desconhecido').substring(0, 1000),
                context: enrichedContext,
                user_id: user_id || null
            }]);

        if (error) {
            console.error("Supabase insert error:", error.message);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Falha ao registrar log de erro no Supabase:", err?.message || err);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
