-- ================================================================
-- CORREÇÃO COMPLETA DA TABELA DE CUPONS — AutoParts Portal
-- Recria cupons com links reais do Mercado Livre + afiliado
-- ================================================================

-- Criação da tabela de Cupons (caso não exista)
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    codigo TEXT NOT NULL,
    link TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    data_validade DATE DEFAULT (CURRENT_DATE + INTERVAL '60 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configura RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow anonymous reads on cupons" ON public.cupons
        FOR SELECT USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Garante coluna data_validade existe (migração segura)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cupons' AND column_name='data_validade'
    ) THEN
        ALTER TABLE public.cupons ADD COLUMN data_validade DATE DEFAULT (CURRENT_DATE + INTERVAL '60 days');
    END IF;
END $$;

-- Remove cupons antigos com links incorretos e insere cupons corrigidos
DELETE FROM public.cupons WHERE link NOT LIKE 'http%';

-- Insere cupons CORRIGIDOS com URLs reais do Mercado Livre + afiliado
-- (somente se não existir nenhum cupom válido)
DO $$
DECLARE
  v_affiliate TEXT := 'matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG';
  v_validade DATE := CURRENT_DATE + INTERVAL '60 days';
BEGIN
  -- Sempre insere os cupons padrão (garante que existam após DELETE acima)
  INSERT INTO public.cupons (titulo, descricao, codigo, link, ativo, ordem, data_validade) VALUES
  (
    'Mercado Livre — Autopeças',
    '10% OFF em peças acima de R$200',
    'AUTO10',
    'https://lista.mercadolivre.com.br/autopecas?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 1, v_validade
  ),
  (
    'Freios e Suspensão',
    'Frete Grátis + 5% Extra em Pastilhas',
    'FREIOS5',
    'https://lista.mercadolivre.com.br/pastilha-de-freio?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 2, v_validade
  ),
  (
    'Kit Revisão — Óleo e Filtros',
    'Kits de Revisão com 15% OFF via App',
    'REVISAO15',
    'https://lista.mercadolivre.com.br/kit-revisao-oleo-filtro?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 3, v_validade
  ),
  (
    'Primeira Compra',
    'R$30 de desconto na primeira compra',
    'BEMVINDO30',
    'https://lista.mercadolivre.com.br/autopecas?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 4, v_validade
  ),
  (
    'Pneus — Aros 14 a 17',
    'Frete Grátis em pneus selecionados',
    'PNEUSFREE',
    'https://lista.mercadolivre.com.br/pneu-automotivo?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 5, v_validade
  ),
  (
    'Baterias Moura e Heliar',
    '5% de cashback na troca de bateria',
    'BATERIA5',
    'https://lista.mercadolivre.com.br/bateria-de-carro?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 6, v_validade
  ),
  (
    'Elétrica Automotiva',
    '12% OFF em sensores e alternadores',
    'ELETRICA12',
    'https://lista.mercadolivre.com.br/eletrica-automotiva?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 7, v_validade
  ),
  (
    'Motor e Transmissão',
    'Frete Grátis em peças de motor acima de R$150',
    'MOTOR150',
    'https://lista.mercadolivre.com.br/pecas-motor?matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG',
    true, 8, v_validade
  )
  ON CONFLICT DO NOTHING;
END $$;
