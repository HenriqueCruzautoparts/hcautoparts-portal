import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
    console.warn("Faltam variáveis de ambiente do Supabase. Verifique seu arquivo .env.local.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
