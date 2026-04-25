import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSearches() {
  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error("Error fetching:", error);
    return;
  }
  
  if (!data || data.length === 0) {
      console.log("Nenhuma pesquisa encontrada.");
      return;
  }
  
  data.forEach((d, index) => {
      console.log(`\n[${index + 1}] Data:`, new Date(d.created_at).toLocaleString('pt-BR'));
      console.log("Query pesquisada:", d.query);
      try {
         const res = typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
         if (res && res.dados_tecnicos) {
             console.log("Identificação Técnica - Peça:", res.dados_tecnicos.identificacao_tecnica?.peca);
             console.log("Identificação Técnica - OEM:", res.dados_tecnicos.identificacao_tecnica?.codigo_oem);
             console.log("Marcas recomendadas:");
             res.dados_tecnicos.top_3_marcas?.forEach((m, i) => {
                 console.log(`  ${i+1}. Marca: ${m.marca} | Cod: ${m.codigo_peca} | Termo ML: ${m.termo_busca_mercadolivre}`);
             });
         }
      } catch(e) {
          console.log("Erro ao fazer o parse do resultado.");
      }
      console.log("---------------------------------------------------");
  });
}

checkSearches();
