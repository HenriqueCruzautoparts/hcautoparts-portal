-- Tabela para rastrear limites de pesquisa de usuários anônimos por fingerprint do dispositivo
-- O fingerprint é gerado no cliente (navegador) e persiste mesmo após limpar localStorage

CREATE TABLE IF NOT EXISTS public.anon_search_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,      -- Hash do dispositivo/navegador
    search_count INTEGER DEFAULT 0 NOT NULL, -- Quantas pesquisas foram feitas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_search_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para busca rápida por fingerprint
CREATE INDEX IF NOT EXISTS idx_anon_search_limits_fingerprint ON public.anon_search_limits(fingerprint);

-- RLS
ALTER TABLE public.anon_search_limits ENABLE ROW LEVEL SECURITY;

-- Permite que o sistema (chave anônima) insira e atualize registros
DO $$ BEGIN
    CREATE POLICY "Allow anon insert to anon_search_limits" ON public.anon_search_limits
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow anon select on anon_search_limits" ON public.anon_search_limits
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow anon update to anon_search_limits" ON public.anon_search_limits
        FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
