import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function deep() {
  const { data } = await supabase.from('search_history').select('*').order('created_at', { ascending: false }).limit(10);
  let out = "";
  (data || []).forEach((d, i) => {
    out += `\n=== [${i+1}] QUERY: "${d.query}" — ${new Date(d.created_at).toLocaleString('pt-BR')} ===\n`;
    try {
      const r = typeof d.result === 'string' ? JSON.parse(d.result) : d.result;

      if (r.dados_tecnicos?.identificacao_tecnica) {
        const id = r.dados_tecnicos.identificacao_tecnica;
        out += `  PEÇA: ${id.peca}\n`;
        out += `  OEM: ${id.codigo_oem}\n`;
        out += `  VEÍCULO: ${id.veiculo_base}\n`;
      }

      if (r.dados_tecnicos?.top_3_marcas) {
        out += `  TOP 3 MARCAS:\n`;
        r.dados_tecnicos.top_3_marcas.forEach((m, j) => {
          out += `    [${j}] ${m.marca} | cod: ${m.codigo_peca} | TERMO_ML: "${m.termo_busca_mercadolivre || 'AUSENTE'}"\n`;
        });
      }
    } catch(e) { out += `  ERRO PARSE: ${e.message}\n`; }
  });
  fs.writeFileSync('deep_analysis_v2.log', out, 'utf-8');
  console.log("Salvo em deep_analysis_v2.log");
  console.log(out);
}
deep();
