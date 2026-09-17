/**
 * auto-renew-cupons.mjs
 * 
 * Script de automação para renovar cupons que vencem em breve.
 * 
 * USO MANUAL:
 *   node scripts/auto-renew-cupons.mjs
 * 
 * AUTOMAÇÃO (GitHub Actions / Vercel Cron):
 *   - Configure como cron job para rodar semanalmente
 *   - Ou adicione ao vercel.json como Vercel Cron Job
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const DIAS_PARA_VENCER = 7;   // renova cupons que vencem em até 7 dias
const RENOVAR_POR = 60;       // renova por 60 dias

if (!ADMIN_EMAIL) {
  console.error('❌ ADMIN_EMAIL não encontrado no .env.local');
  process.exit(1);
}

async function renovarCupons() {
  console.log('\n🎟️  AutoParts — Renovação Automática de Cupons');
  console.log(`📅 ${new Date().toLocaleString('pt-BR')}\n`);

  const url = `${BASE_URL}/api/cupons/renew?dias=${DIAS_PARA_VENCER}&renovar_por=${RENOVAR_POR}&admin_email=${encodeURIComponent(ADMIN_EMAIL)}`;

  try {
    console.log(`🔄 Chamando: ${url}`);
    
    const res = await fetch(url, {
      headers: { 'x-admin-email': ADMIN_EMAIL }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Erro na API:', data.error);
      process.exit(1);
    }

    if (data.renovados === 0) {
      console.log(`✅ ${data.mensagem}`);
    } else {
      console.log(`✅ ${data.renovados} cupom(ns) renovado(s) até ${data.nova_validade}\n`);
      data.cupons_renovados.forEach(c => {
        console.log(`   • ${c.titulo} (${c.codigo})`);
        console.log(`     Validade anterior: ${c.validade_anterior} → Nova: ${data.nova_validade}`);
      });
    }

    console.log(`\n⏱️  Verificado em: ${data.verificado_em}`);
  } catch (err) {
    console.error('❌ Falha ao conectar com a API:', err.message);
    console.log('ℹ️  Certifique-se de que o servidor Next.js está rodando em:', BASE_URL);
    process.exit(1);
  }
}

renovarCupons();
