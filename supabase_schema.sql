-- Criação da tabela de histórico de pesquisa
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    query TEXT NOT NULL,
    result TEXT NOT NULL
);

-- Configurar RLS (Row Level Security) para permitir que a chave anônima insira e leia
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Política para permitir inserção sem autenticação
    CREATE POLICY "Allow anonymous inserts" ON public.search_history
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    -- Política para permitir leitura sem autenticação
    CREATE POLICY "Allow anonymous reads" ON public.search_history
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Criação da tabela de Perfis do Usuário (SaaS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    whatsapp TEXT,
    cep TEXT,
    address TEXT,
    address_number TEXT,
    address_complement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ BEGIN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Criação da tabela de Logs do Sistema (Erros)
CREATE TABLE IF NOT EXISTS public.system_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o sistema (anônimo ou logado) insira logs
DO $$ BEGIN
    CREATE POLICY "Allow inserts to system_errors" ON public.system_errors
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Gatilho de Automação: Criar perfil de usuário automaticamente ao se registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, whatsapp, cep, address, address_number, address_complement)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(new.raw_user_meta_data->>'cep', ''),
    COALESCE(new.raw_user_meta_data->>'address', ''),
    COALESCE(new.raw_user_meta_data->>'address_number', ''),
    COALESCE(new.raw_user_meta_data->>'address_complement', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
