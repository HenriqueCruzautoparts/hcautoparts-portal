import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60; // Allow Vercel to run this function for up to 60 seconds (prevents 504 Timeout)


interface GeminiResponse {
    identificacao_tecnica: {
        peca: string;
        breve_explicativo: string;
        codigo_oem: string;
        nome_ingles: string;
        veiculo_base: string;
        validacao_catalogo: string;
    };
    intercambiabilidade: string[];
    top_3_marcas: Array<{
        marca: string;
        codigo_peca: string;
        justificativa: string;
        termo_busca_mercadolivre: string;
    }>;
    referencia_aliexpress: {
        termo_busca: string;
        link_busca: string;
        recomendacao: string;
    };
}


async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error("Erro de Configuração. A chave de API (GEMINI_API_KEY) não foi encontrada no servidor.");
    }
    
    const MODEL_NAME = "gemini-2.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const promptMestre = `
    PERSONA: Você é um Especialista Sênior em Catálogos de Peças Automotivas com acesso a bancos de dados oficiais de todas as montadoras.
    
    MISSÃO: Analisar a pesquisa: "${query || "Imagem da peça."}" e recomendar as 3 MELHORES MARCAS de peças aftermarket.

    REGRA 1 — ANTI-ALUCINAÇÃO GERAL:
    Se a pesquisa for GENÉRICA (sem modelo exato, ano e motorização):
    - NÃO INVENTE códigos OEM ou da marca. Use "Requer modelo exato" ou "Consultar Catálogo".
    - Adicione AVISO no "breve_explicativo": "ATENÇÃO: Busca genérica. Especifique modelo, ano e motor para código exato."
    - Use termos AMPLOS nos links do Mercado Livre (sem marca específica).

    REGRA 2 — CÓDIGOS DE PEÇA (OBRIGATÓRIO):
    - É SEU DEVER OBRIGATÓRIO fornecer o Código OEM genuíno e o Código da Marca Aftermarket correspondente. 
    - O painel é usado por mecânicos que precisam do CÓDIGO EXATO para compra. 
    - EVITE ao máximo "Consulte o catálogo". Pesquise em sua base interna até encontrar o código de referência cruzada correto para cada uma das 3 marcas.

    REGRA 3 — TERMOS DE BUSCA NO MERCADO LIVRE:
    - O campo "termo_busca_mercadolivre" será usado diretamente na API de busca do ML.
    - DEVE SER EXTREMAMENTE ENXUTO. Máximo de 4 palavras-chave. Nada de hifens.
    - Foque APENAS: Peça Principal + Modelo Principal + Marca Aftermarket
    - NUNCA inclua palavras genéricas como "para", "de", "do", "original", "genuíno", etc.
    
    Exemplos CORRETOS:
    - "pastilha freio golf textar"
    - "bomba combustivel audi continental"
    - "filtro oleo corsa mann"

    REGRA 4 — INTERCAMBIABILIDADE:
    - Liste APENAS veículos com CONFIRMAÇÃO de compatibilidade cruzada (plug and play).
    - NÃO liste veículos "possivelmente compatíveis".

    REGRA 5 — FORMATO:
    - RETORNE APENAS JSON VÁLIDO, SEM texto antes ou depois, SEM blocos de código (sem \`\`\`json).
    - TODOS os campos em Português do Brasil (PT-BR).

    JSON OBRIGATÓRIO:
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico Exato",
        "breve_explicativo": "Função e importância da peça. Aviso de busca genérica se aplicável.",
        "codigo_oem": "Código da Montadora EXATO ou 'Requer modelo exato'",
        "nome_ingles": "Nome em inglês",
        "veiculo_base": "Modelo exato com carroceria, ano e motor",
        "validacao_catalogo": "Catálogo Oficial [Montadora]"
      },
      "intercambiabilidade": [
        "Marca/Modelo/Carroceria (Ano) - Motorização — Plug and Play confirmed"
      ],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "Código exato OU 'Consulte o catálogo oficial do fabricante'",
          "justificativa": "Motivo técnico da recomendação",
          "termo_busca_mercadolivre": "[peça] [modelo] [marca]"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Código OEM ou nome em inglês",
        "link_busca": "https://pt.aliexpress.com/w/wholesale-[termo-busca-encoded].html",
        "recomendacao": "Análise objetiva de custo-benefício e riscos da importação"
      }
    }
    `;

    let contents: any[] = [];
    if (image) {
        const rawBase64 = image.split(',')[1] || image;
        contents = [{
            parts: [
                { text: promptMestre.replace('\${query || "Imagem da peça."}', query || 'Analise esta imagem.') },
                { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
            ]
        }];
    } else {
        contents = [{
            parts: [{ text: promptMestre.replace('\${query || "Imagem da peça."}', query) }]
        }];
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await res.json();
        
        if (data.error) {
            if (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 429) {
                throw new Error("Servidores da Inteligência Artificial sobrecarregados no momento. Por favor, aguarde 1 a 2 minutos e tente novamente.");
            }
            throw new Error(`Erro API Google: ${data.error.message} (Status: ${data.error.status})`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("A IA não retornou conteúdo válido.");

        const cleanJson = text.replace(/^\s*\`\`\`json\s*/g, '').replace(/\s*\`\`\`\s*$/g, '').trim();
        return JSON.parse(cleanJson) as GeminiResponse;
    } catch (e: any) {
        console.error("Erro na análise do Gemini:", e);
        throw e;
    }
}

export async function POST(req: Request) {
    let requestContext: any = {};
    try {
        const payload = await req.json();
        requestContext = payload;
        const { query, image, user_id, user_email, anon_fingerprint } = payload;

        if (!query && !image) {
            return NextResponse.json({ error: "A query de pesquisa ou imagem é obrigatória." }, { status: 400 });
        }

        const isUnlimitedUser = user_email === 'henrike.henrique.cn94@gmail.com';

        // Limite Mensal para usuários logados
        if (user_id && !isUnlimitedUser) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count } = await supabase
                .from('search_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user_id)
                .gte('created_at', startOfMonth.toISOString());

            if (count && count >= 15) {
                return NextResponse.json({ error: "Você atingiu o limite mensal de 15 pesquisas gratuitas da Conta Base. Faça upgrade para continuar economizando!" }, { status: 403 });
            }
        }

        // ✅ Limite persistente para usuários ANÔNIMOS por fingerprint (lado servidor)
        // Isso impede o bypass por limpeza de localStorage ou troca de aba/dia
        if (!user_id && anon_fingerprint) {
            const { data: anonRecord } = await supabase
                .from('anon_search_limits')
                .select('id, search_count')
                .eq('fingerprint', anon_fingerprint)
                .single();

            if (anonRecord && anonRecord.search_count >= 5) {
                return NextResponse.json({
                    error: "Você já utilizou suas 5 pesquisas gratuitas. Crie sua conta gratuitamente para continuar pesquisando sem limites!",
                    require_signup: true
                }, { status: 403 });
            }
        }

        // 1. Obter Inteligência do Gemini
        const aiAnalysis = await getGeminiAnalysis(query, image);

        // 2. Consolidar apenas a Inteligência Artifical (ML será carregado pelo frontend)
        const finalResponse = {
            query: query || "Busca por Imagem",
            dados_tecnicos: {
                identificacao_tecnica: aiAnalysis.identificacao_tecnica,
                intercambiabilidade: aiAnalysis.intercambiabilidade,
                top_3_marcas: aiAnalysis.top_3_marcas,
                referencia_aliexpress: aiAnalysis.referencia_aliexpress
            },
            ml_results: [] // Opcional, mantido como array vazio para compatibilidade inicial do frontend
        };

        // 4. Salvar Histórico async (evitando duplicatas para usuários logados) e Manutenção do DB
        if (user_id) {
            const saveHistory = async () => {
                try {
                    // Remove busca anterior idêntica para não poluir o histórico com repetidas
                    await supabase.from("search_history").delete().eq('user_id', user_id).eq('query', finalResponse.query);
                    await supabase.from("search_history").insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse), user_id: user_id }]);
                    
                    // Método Anti-Erro: Expurgo Automático do Banco (mantendo-o "leve")
                    // Deleta pesquisas com mais de 30 dias do usuário silenciosamente
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    await supabase.from("search_history").delete().eq('user_id', user_id).lt('created_at', thirtyDaysAgo.toISOString());
                } catch (err) {
                    console.error("Erro ao salvar histórico/limpar banco:", err);
                }
            };
            saveHistory();
        }

        // ✅ Incrementa ou cria o contador de pesquisas anônimas no servidor
        if (!user_id && anon_fingerprint) {
            const { data: existing } = await supabase
                .from('anon_search_limits')
                .select('id, search_count')
                .eq('fingerprint', anon_fingerprint)
                .single();

            if (existing) {
                supabase
                    .from('anon_search_limits')
                    .update({ search_count: existing.search_count + 1, last_search_at: new Date().toISOString() })
                    .eq('fingerprint', anon_fingerprint)
                    .then();
            } else {
                supabase
                    .from('anon_search_limits')
                    .insert([{ fingerprint: anon_fingerprint, search_count: 1 }])
                    .then();
            }
        }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Erro interno na rota /api/pesquisa:", error);

        // Registrar erro no painel do Supabase silenciosamente
        supabase.from('system_errors').insert([{
            error_message: error.message || 'Erro desconhecido na API de Pesquisa',
            context: { origin: 'api_pesquisa', payload: requestContext }
        }]).then();

        return NextResponse.json({ error: error.message || "Erro interno na API de Pesquisa." }, { status: 500 });
    }
}

