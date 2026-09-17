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

// Modelos em ordem de prioridade — tenta o mais capaz primeiro e desce até conseguir resposta
const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
];

async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
        console.error("ERRO: GEMINI_API_KEY não encontrada no process.env");
        throw new Error("Erro de Configuração. A chave de API (GEMINI_API_KEY) não foi encontrada no servidor.");
    }

    const buscaPorCodigo = isPartCode(query);

    const promptMestre = `
    Você é um cataloguista técnico automotivo sênior com 20 anos de experiência. Sua tarefa é identificar a peça exata e retornar dados técnicos precisos em JSON.

    PESQUISA DO USUÁRIO: "${query || "Imagem da peça."}"

    ${buscaPorCodigo ? `ATENÇÃO: "${query}" é um CÓDIGO DE PEÇA. Identifique fabricante e tipo pela numeração. O campo codigo_oem deve ser exatamente "${query}".` : ''}

    INSTRUÇÕES OBRIGATÓRIAS:
    1. Identifique a peça com MÁXIMA precisão — inclua veículo completo (marca, modelo, geração, ano, motor).
    2. Recomende 3 marcas aftermarket reconhecidas com seus códigos de referência cruzada REAIS.
    3. Retorne SOMENTE o JSON abaixo. ZERO texto fora do JSON.

    REGRAS CRÍTICAS DE QUALIDADE:
    - Se mencionar ano (ex: "2011"), identifique a geração OBRIGATORIAMENTE (ex: VW Saveiro 2011 = G5).
    - Se mencionar versão (Cross, GTI, Titanium, etc.), a peça deve ser ESPECÍFICA dessa versão.
    - Códigos OEM e de marca devem ser REAIS e verificáveis. Se não souber com certeza, escreva "Consultar fornecedor".
    - intercambiabilidade: liste APENAS veículos com compatibilidade técnica comprovada, nunca suposições.

    REGRAS CRÍTICAS PARA termo_busca_mercadolivre:
    - O termo deve ter entre 4 e 8 palavras. Nunca menos que 4 (vago) nem mais que 8 (longo demais).
    - SEMPRE incluir: [nome da peça] + [modelo do veículo] + [geração ou ano] + [cilindrada/motor se relevante].
    - Quando a marca tem código conhecido no mercado (ex: "mahle OC127"), inclua o código no termo.
    - Use o código OEM no termo quando ele for comumente buscado (curto, alfanumérico, ex: "1J0615301B").
    - NUNCA use termos genéricos sem especificação de veículo.
    - ❌ ERRADO: "filtro oleo", "pastilha freio dianteira", "amortecedor"
    - ✅ CERTO: "filtro oleo gol g5 1.6 2009 2013 mahle", "pastilha freio dianteira hb20 1.0 2012 2019 fras-le", "amortecedor dianteiro saveiro g6 1.6 cofap"
    - Para busca por código OEM: "[código OEM] [nome da peça] [modelo]" — ex: "1K0498099E cubo roda polo 1.6"

    JSON (retorne SOMENTE isto, sem markdown, sem texto antes ou depois):
    {
      "identificacao_tecnica": {
        "peca": "Nome técnico completo da peça",
        "breve_explicativo": "Função técnica da peça, quando substituir e notas de compatibilidade específicas",
        "codigo_oem": "Código OEM da montadora (exato)",
        "nome_ingles": "Nome técnico em inglês",
        "veiculo_base": "Marca Modelo Geração Ano Motor (ex: VW Saveiro G5 2011 1.6 8V)",
        "validacao_catalogo": "Fonte de referência (ex: Catálogo MAHLE 2024, TecDoc)"
      },
      "intercambiabilidade": ["Veículo compatível Geração (ano início-fim) - motor"],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "Código real desta marca para esta peça",
          "justificativa": "Motivo técnico objetivo da recomendação (qualidade, disponibilidade, custo-benefício)",
          "termo_busca_mercadolivre": "Termo preciso de 4-8 palavras para busca desta marca específica no ML"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Termo em inglês para busca no AliExpress (nome técnico + veículo em inglês)",
        "link_busca": "https://pt.aliexpress.com/w/wholesale-TERMO-EM-INGLES.html",
        "recomendacao": "Análise objetiva de custo-benefício e riscos de importação para esta peça específica"
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

    // Tenta cada modelo disponível em sequência (fallback automático)
    for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
        const modelName = GEMINI_MODELS[modelIndex];
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const MAX_RETRIES = 2;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
                    const isQuotaError =
                        data.error.status === 'RESOURCE_EXHAUSTED' ||
                        data.error.code === 429;
                    const isTransient =
                        isQuotaError ||
                        data.error.status === 'UNAVAILABLE' ||
                        data.error.code === 503;

                    if (isQuotaError) {
                        // Cota esgotada neste modelo — tenta o próximo imediatamente
                        console.warn(`Modelo ${modelName} com cota esgotada (429). Tentando próximo modelo...`);
                        break; // sai do loop de tentativas, vai para próximo modelo
                    }

                    if (isTransient && attempt < MAX_RETRIES - 1) {
                        const delay = 1500 * Math.pow(2, attempt); // backoff: 1.5s, 3s
                        console.warn(`Modelo ${modelName} indisponível (tentativa ${attempt + 1}). Aguardando ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    throw new Error(`Erro API Google: ${data.error.message} (Status: ${data.error.status})`);
                }

                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error("A IA não retornou conteúdo válido.");

                // Remove markdown residual caso venha
                const cleanJson = text.replace(/^\s*```json\s*/g, '').replace(/\s*```\s*$/g, '').trim();
                return JSON.parse(cleanJson) as GeminiResponse;

            } catch (e: any) {
                // Se for erro de cota (429), sai do loop interno para tentar próximo modelo
                if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
                    console.warn(`Erro de cota no modelo ${modelName}. Próximo modelo...`);
                    break;
                }
                console.error(`Erro na tentativa ${attempt + 1} do modelo ${modelName}:`, e.message);
                if (attempt < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                }
                // Última tentativa deste modelo — vai para próximo
                if (modelIndex < GEMINI_MODELS.length - 1) {
                    console.warn(`Falha no modelo ${modelName}. Tentando próximo...`);
                    break;
                }
                throw e;
            }
        }
    }

    // Todos os modelos falharam
    throw new Error("O sistema de IA está temporariamente sobrecarregado. Por favor, aguarde alguns minutos e tente novamente. Se o problema persistir, os servidores da Google podem estar com alta demanda.");}


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