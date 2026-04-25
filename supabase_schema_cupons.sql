-- Criação da tabela de Cupons
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    codigo TEXT NOT NULL,
    link TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    data_validade DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurar RLS (Row Level Security) para permitir que qualquer usuário (logado ou não) leia os cupons
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Política para permitir leitura sem autenticação
    CREATE POLICY "Allow anonymous reads on cupons" ON public.cupons
        FOR SELECT USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Inserir alguns cupons de exemplo (se a tabela estiver vazia)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cupons) THEN
    -- Inserir do Mercado Livre que já existiam
    INSERT INTO public.cupons (titulo, descricao, codigo, link, ativo, ordem) VALUES
    ('Mercado Livre - Auto', '10% OFF em Autopeças Acima de R$200', 'AUTO10', 'acessorios para veiculos', true, 1),
    ('Freios e Suspensão', 'Frete Grátis + 5% Extra em Pastilhas', 'FREIOS5', 'pastilha de freio', true, 2),
    ('Óleo e Filtros', 'Kits de Revisão com 15% OFF (Via App)', 'REVISAO15', 'kit revisao oleo', true, 3),
    ('Acessórios Internos', 'R$30 de Desconto na primeira compra', 'BEMVINDO30', 'acessorios carros', true, 4);
    
    -- Inserir alguns novos para dar diversificação
    INSERT INTO public.cupons (titulo, descricao, codigo, link, ativo, ordem) VALUES
    ('Pneus Diversos', 'Frete Grátis em Pneus aros 14 a 17', 'PNEUSFREE', 'pneu automotivo', true, 5),
    ('Baterias Moura/Heliar', '5% de volta comprando a base de troca', 'BATERIA5', 'bateria de carro', true, 6);
  END IF;
END $$;
