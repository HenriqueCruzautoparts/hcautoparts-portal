import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { error_message, context, user_id } = body;

        const { error } = await supabase
            .from('system_errors')
            .insert([{
                error_message,
                context,
                user_id: user_id || null
            }]);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Falha ao registrar log de erro no Supabase:", err);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
