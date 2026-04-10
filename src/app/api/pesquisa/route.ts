import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

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

// Detecta se a query parece um código de peça (alfanumérico, sem espaços ou com hifens)
function isPartCode(query: string): boolean {
    if (!query) return false;
    const trimmed = query.trim();
    // Padrões comuns de códigos OEM: ex 04E115561B, 33100-KWW-J00, 1J0615301B, W01-358-8041
    return /^[A-Z0-9]{3,}[-]?[A-Z0-9]+$/i.test(trimmed.replace(/\s/g, ''));
}

async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
        console.error("ERRO: GEMINI_API_KEY não encontrada no process.env");
        throw new Error("Erro de Configuração. A chave de API (GEMINI_API_KEY) não foi encontrada no servidor.");
    }

    const MODEL_NAME = "gemini-2.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const buscaPorCodigo = isPartCode(query);

    const promptMestre = `
    Você é um cataloguista técnico automotivo. Sua única tarefa é identificar a peça exata e retornar dados técnicos em JSON.

    PESQUISA DO USUÁRIO: "${query || "Imagem da peça."}"

    ${buscaPorCodigo ? `ATENÇÃO: "${query}" é um CÓDIGO DE PEÇA. Identifique fabricante e tipo pela numeração. O campo codigo_oem deve ser "${query}".` : ''}

    INSTRUÇÕES:
    1. Identifique a peça, o veículo (com ANO e GERAÇÃO obrigatórios) e o código OEM.
    2. Recomende 3 marcas aftermarket com seus códigos de referência cruzada.
    3. Preencha o JSON abaixo. NÃO adicione texto fora do JSON.

    REGRAS CRÍTICAS:
    - Se a pesquisa menciona um ano (ex: "2011"), a geração do veículo DEVE ser identificada (ex: VW Saveiro 2011 = G5).
    - Se a pesquisa menciona uma versão (Cross, GTI, etc.), a peça deve ser específica dessa versão.
    - Forneça códigos reais. Se não souber com certeza, use "Consultar fornecedor".
    - Na montagem do 'termo_busca_mercadolivre', crie a String IDEAL para achar essa peça exata. Use a inteligência para agregar O MÁXIMO DE INFORMAÇÕES VITAIS, preferencialmente unindo: Peça + Veículo + Motor + Ano + Marca Oferecida (ou o Código de Fabricante se ele for comum para buscas). Forme uma string que um comprador experiente digitaria para achar essa peça exata e que traga todos os resultados adequados.

    JSON (retorne SOMENTE isto, sem markdown):
    {
      "identificacao_tecnica": {
        "peca": "Nome da peça",
        "breve_explicativo": "Função da peça e notas de compatibilidade",
        "codigo_oem": "Código OEM da montadora",
        "nome_ingles": "Nome em inglês",
        "veiculo_base": "Marca Modelo Versão Ano Motor (ex: VW Saveiro G5 2011 1.6)",
        "validacao_catalogo": "Fonte de referência"
      },
      "intercambiabilidade": ["Veículo compatível (ano) - motor"],
      "top_3_marcas": [
        {
          "marca": "NOME",
          "codigo_peca": "Código da marca",
          "justificativa": "Motivo da recomendação",
          "termo_busca_mercadolivre": "Termo ideal e preciso para pesquisa desta marca no ML"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Termo em inglês para busca",
        "link_busca": "https://pt.aliexpress.com/w/wholesale-TERMO.html",
        "recomendacao": "Análise custo-benefício"
      }
    }
    `;

    let contents: any[] = [];
    if (image) {
        const rawBase64 = image.split(',')[1] || image;
        contents = [{
            parts: [
                { text: promptMestre },
                { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
            ]
        }];
    } else {
        contents = [{
            parts: [{ text: promptMestre }]
        }];
    }

    const MAX_RETRIES = 3;
    let lastError = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.2,
                    }
                })
            });

            const data = await res.json();

            if (data.error) {
                // Erros de cota ou indisponibilidade temporária (503 / 429)
                const isTransient = data.error.status === 'RESOURCE_EXHAUSTED' || 
                                  data.error.code === 429 || 
                                  data.error.status === 'UNAVAILABLE' || 
                                  data.error.code === 503;

                if (isTransient && i < MAX_RETRIES - 1) {
                    console.warn(`Gemini indisponível (tentativa ${i+1}/${MAX_RETRIES}). Tentando novamente em 1.5s...`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                }

                if (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 429) {
                    throw new Error("O sistema está com muitos acessos no momento. Por favor, aguarde 30 segundos e tente sua busca novamente.");
                }
                throw new Error(`Erro API Google: ${data.error.message} (Status: ${data.error.status})`);
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("A IA não retornou conteúdo válido.");

            // Fallback de segurança para remover markdown residual
            const cleanJson = text.replace(/^\s*```json\s*/g, '').replace(/\s*```\s*$/g, '').trim();
            return JSON.parse(cleanJson) as GeminiResponse;

        } catch (e: any) {
            lastError = e;
            console.error(`Erro na tentativa ${i+1} do Gemini:`, e.message);
            if (i < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                continue;
            }
            throw e;
        }
    }
    throw lastError || new Error("Falha ao comunicar com a Inteligência Artificial após várias tentativas.");
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

        const isUnlimitedUser = 
            user_email === process.env.ADMIN_EMAIL || 
            user_email === 'henrike.henrique.cn94@gmail.com';

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

        const aiAnalysis = await getGeminiAnalysis(query, image);

        const oem = aiAnalysis.identificacao_tecnica?.codigo_oem || '';
        const hasValidOem = oem && oem.length > 3 && !oem.includes('Requer') && !oem.includes('Consultar') && !oem.includes('Consulte') && !oem.includes('N/A');

        const enrichedMarcas = (aiAnalysis.top_3_marcas || []).map((m: any) => {
            // A IA agora gera termo_busca_mercadolivre de forma autônoma e completa.
            // Se ela falhar em gerar, criamos um fallback nativo simplificado.
            let termoComMarca = m.termo_busca_mercadolivre?.trim();
            if (!termoComMarca || termoComMarca.includes('Consultar')) {
                const peca = aiAnalysis.identificacao_tecnica?.peca || '';
                termoComMarca = `${peca} ${m.marca}`.trim();
            }

            return { 
                ...m, 
                marca: m.marca, // Mantém nome original para exibição
                termo_busca_mercadolivre: termoComMarca,
                // Termo extra: código OEM para busca alternativa
                termo_codigo_oem: hasValidOem ? oem : null
            };
        });

        const finalResponse = {
            query: query || "Busca por Imagem",
            dados_tecnicos: {
                identificacao_tecnica: aiAnalysis.identificacao_tecnica,
                intercambiabilidade: aiAnalysis.intercambiabilidade,
                top_3_marcas: enrichedMarcas,
                referencia_aliexpress: aiAnalysis.referencia_aliexpress
            },
            ml_results: []
        };

        if (user_id) {
            try {
                await supabase.from("search_history").delete().eq('user_id', user_id).eq('query', finalResponse.query);
                await supabase.from("search_history").insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse), user_id: user_id }]);

                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                await supabase.from("search_history").delete().eq('user_id', user_id).lt('created_at', thirtyDaysAgo.toISOString());
            } catch (err) {
                console.error("Erro ao salvar histórico:", err);
            }
        }

        if (!user_id && anon_fingerprint) {
            const { data: existing } = await supabase
                .from('anon_search_limits')
                .select('id, search_count')
                .eq('fingerprint', anon_fingerprint)
                .single();

            if (existing) {
                await supabase
                    .from('anon_search_limits')
                    .update({ search_count: existing.search_count + 1, last_search_at: new Date().toISOString() })
                    .eq('fingerprint', anon_fingerprint);
            } else {
                await supabase
                    .from('anon_search_limits')
                    .insert([{ fingerprint: anon_fingerprint, search_count: 1 }]);
            }
        }

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Erro interno na rota /api/pesquisa:", error);

        await supabase.from('system_errors').insert([{
            error_message: error.message || 'Erro desconhecido na API de Pesquisa',
            context: { origin: 'api_pesquisa', payload: requestContext }
        }]);

        return NextResponse.json({ error: error.message || "Erro interno na API de Pesquisa." }, { status: 500 });
    }
}