-- Criação da tabela de histórico de pesquisa
CREATE TABLE public.search_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    query TEXT NOT NULL,
    result TEXT NOT NULL
);

-- Configurar RLS (Row Level Security) para permitir que a chave anônima insira e leia
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção sem autenticação
CREATE POLICY "Allow anonymous inserts" ON public.search_history
    FOR INSERT WITH CHECK (true);

-- Política para permitir leitura sem autenticação
CREATE POLICY "Allow anonymous reads" ON public.search_history
    FOR SELECT USING (true);
