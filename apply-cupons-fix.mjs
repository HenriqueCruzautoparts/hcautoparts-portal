/**
 * apply-cupons-fix.mjs
 * Aplica correção dos cupons via Supabase REST API (sem conexão direta ao Postgres)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não encontrados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ML_AFFILIATE = 'matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG';
const VALIDADE = new Date();
VALIDADE.setDate(VALIDADE.getDate() + 60);
const DATA_VALIDADE = VALIDADE.toISOString().split('T')[0];

const cupons = [
  { titulo: 'Mercado Livre — Autopeças', descricao: '10% OFF em peças acima de R$200', codigo: 'AUTO10', link: `https://lista.mercadolivre.com.br/autopecas?${ML_AFFILIATE}`, ativo: true, ordem: 1, data_validade: DATA_VALIDADE },
  { titulo: 'Freios e Suspensão', descricao: 'Frete Grátis + 5% Extra em Pastilhas', codigo: 'FREIOS5', link: `https://lista.mercadolivre.com.br/pastilha-de-freio?${ML_AFFILIATE}`, ativo: true, ordem: 2, data_validade: DATA_VALIDADE },
  { titulo: 'Kit Revisão — Óleo e Filtros', descricao: 'Kits de Revisão com 15% OFF via App', codigo: 'REVISAO15', link: `https://lista.mercadolivre.com.br/kit-revisao-oleo-filtro?${ML_AFFILIATE}`, ativo: true, ordem: 3, data_validade: DATA_VALIDADE },
  { titulo: 'Primeira Compra', descricao: 'R$30 de desconto na primeira compra', codigo: 'BEMVINDO30', link: `https://lista.mercadolivre.com.br/autopecas?${ML_AFFILIATE}`, ativo: true, ordem: 4, data_validade: DATA_VALIDADE },
  { titulo: 'Pneus — Aros 14 a 17', descricao: 'Frete Grátis em pneus selecionados', codigo: 'PNEUSFREE', link: `https://lista.mercadolivre.com.br/pneu-automotivo?${ML_AFFILIATE}`, ativo: true, ordem: 5, data_validade: DATA_VALIDADE },
  { titulo: 'Baterias Moura e Heliar', descricao: '5% de cashback na troca de bateria', codigo: 'BATERIA5', link: `https://lista.mercadolivre.com.br/bateria-de-carro?${ML_AFFILIATE}`, ativo: true, ordem: 6, data_validade: DATA_VALIDADE },
  { titulo: 'Elétrica Automotiva', descricao: '12% OFF em sensores e alternadores', codigo: 'ELETRICA12', link: `https://lista.mercadolivre.com.br/eletrica-automotiva?${ML_AFFILIATE}`, ativo: true, ordem: 7, data_validade: DATA_VALIDADE },
  { titulo: 'Motor e Transmissão', descricao: 'Frete Grátis em peças de motor acima de R$150', codigo: 'MOTOR150', link: `https://lista.mercadolivre.com.br/pecas-motor?${ML_AFFILIATE}`, ativo: true, ordem: 8, data_validade: DATA_VALIDADE },
];

async function main() {
  console.log('\n🎟️  AutoParts — Aplicando correção dos cupons via Supabase REST\n');

  // 1. Busca todos os cupons existentes
  const { data: existing, error: fetchErr } = await supabase
    .from('cupons')
    .select('id, codigo, link');

  if (fetchErr) {
    console.error('❌ Erro ao buscar cupons:', fetchErr.message);
    process.exit(1);
  }

  console.log(`📋 Cupons existentes: ${existing?.length || 0}`);

  // 2. Remove cupons com links incorretos (que não começam com http)
  const invalidos = existing?.filter(c => !c.link?.startsWith('http')) || [];
  if (invalidos.length > 0) {
    const ids = invalidos.map(c => c.id);
    const { error: delErr } = await supabase.from('cupons').delete().in('id', ids);
    if (delErr) {
      console.warn('⚠️  Erro ao remover cupons inválidos:', delErr.message);
    } else {
      console.log(`🗑️  Removidos ${invalidos.length} cupons com links incorretos`);
    }
  }

  // 3. Renova validade de cupons válidos que já existem (por código)
  const existingCodes = new Set((existing || []).map(c => c.codigo));
  let renovados = 0;
  for (const cod of existingCodes) {
    const cuponBase = cupons.find(c => c.codigo === cod);
    if (cuponBase) {
      const { error } = await supabase
        .from('cupons')
        .update({ link: cuponBase.link, data_validade: DATA_VALIDADE, ativo: true })
        .eq('codigo', cod);
      if (!error) renovados++;
    }
  }
  if (renovados > 0) console.log(`✅ Atualizados/renovados: ${renovados} cupons existentes`);

  // 4. Insere cupons novos (que não existiam)
  const novos = cupons.filter(c => !existingCodes.has(c.codigo));
  if (novos.length > 0) {
    const { error: insErr } = await supabase.from('cupons').insert(novos);
    if (insErr) {
      console.error('❌ Erro ao inserir novos cupons:', insErr.message);
    } else {
      console.log(`➕ Inseridos ${novos.length} novos cupons`);
    }
  }

  // 5. Lista resultado final
  const { data: final } = await supabase
    .from('cupons')
    .select('titulo, codigo, link, data_validade, ativo')
    .order('ordem');

  console.log('\n📋 Cupons finais no banco:');
  (final || []).forEach(c => {
    const ok = c.link?.startsWith('http') ? '✅' : '❌';
    const ativo = c.ativo ? '🟢' : '🔴';
    console.log(`  ${ok} ${ativo} ${c.titulo} (${c.codigo}) → válido até ${c.data_validade}`);
    console.log(`     Link: ${c.link?.substring(0, 70)}...`);
  });

  console.log('\n✨ Correção concluída!\n');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
