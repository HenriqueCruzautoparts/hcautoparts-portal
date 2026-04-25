import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSearches() {
  const { data, error } = await supabase.from('search_history').select('*').order('created_at', { ascending: false }).limit(5);
  let out = "";
  if (error) out = "Error: " + error.message;
  else if (data) {
    data.forEach((d) => {
        out += `Data: ${new Date(d.created_at).toLocaleString('pt-BR')}\n`;
        out += `Query: ${d.query}\n`;
        try {
            const res = typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
            const t = res.dados_tecnicos?.identificacao_tecnica;
            if (t) out += `Peça: ${t.peca} | OEM: ${t.codigo_oem}\nExplicativo: ${t.breve_explicativo}\n`;
            res.dados_tecnicos?.top_3_marcas?.forEach((m, i) => {
                out += ` [${i+1}] Marca: ${m.marca} | Cod: ${m.codigo_peca} | Termo: ${m.termo_busca_mercadolivre}\n`;
            });
        } catch(e) { out += "Erro no parse\n"; }
        out += `------------------------\n`;
    });
  }
  fs.writeFileSync('c:\\Users\\Henrique Cruz\\.gemini\\antigravity\\scratch\\autoparts-portal\\searches.log', out, 'utf-8');
}
checkSearches();
