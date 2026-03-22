import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60; // Allow Vercel to run this function for up to 60 seconds (prevents 504 Timeout)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

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

// Pool de User-Agents reais para rotacionar e evitar bloqueio
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

// Extrai o ano da query para validar resultados (ex: "2017", "2011", etc.)
function extractYearFromQuery(query: string): number | null {
    const match = query.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    return match ? parseInt(match[1]) : null;
}

// Extrai motorização da query para validar resultados (ex: "2.0 TFSI", "1.0 turbo")
function extractEngineFromQuery(query: string): string | null {
    const match = query.match(/\b(\d\.\d[\w\s]{0,12})/i);
    return match ? match[1].trim().toLowerCase() : null;
}

// Verifica se o título do produto bate com o ano e motorização da query
function isTitleRelevant(title: string, queryYear: number | null, queryEngine: string | null): boolean {
    const normalizedTitle = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Verificação de ano: o título deve conter o ano da query OU um ano dentro de ±3 anos
    if (queryYear) {
        const titleYears = [...normalizedTitle.matchAll(/\b(19[5-9]\d|20[0-2]\d)\b/g)].map(m => parseInt(m[1]));
        if (titleYears.length > 0) {
            const hasCompatibleYear = titleYears.some(y => Math.abs(y - queryYear) <= 3);
            if (!hasCompatibleYear) return false;
        }
        // Se o título não menciona nenhum ano, não descartamos (produto universal)
    }

    // Verificação de motorização: se a query tem motorização, o título deve conter algo compatível
    if (queryEngine && queryEngine.length > 2) {
        const engineDigits = queryEngine.replace(/[^0-9]/g, '').substring(0, 2); // ex: "20" de "2.0"
        const normalizedEngine = queryEngine.replace(/[^a-z0-9]/g, '');
        // Verificação flexível: qualquer menção à cilindrada ou código do motor
        const hasEngine = normalizedTitle.includes(normalizedEngine) ||
            (engineDigits.length >= 2 && normalizedTitle.includes(engineDigits[0] + '.' + engineDigits[1]));
        if (!hasEngine && queryEngine.length > 4) return false; // Só filtra se a motorização for específica
    }

    return true;
}

async function scrapeML(query: string, marca: string, idSuffix: string, expectedPartName: string) {
    const cleanQuery = query.trim().replace(/\s+/g, ' ');

    // Inclui a marca no termo de busca para diferenciar produtos entre as 3 marcas
    // Isso evita que MANN, Mahle e Hengst retornem o mesmo anúncio
    const queryComMarca = `${cleanQuery} ${marca}`.trim();
    const formattedQuery = queryComMarca.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');

    // Extrai ano e motorização para validação posterior dos resultados
    const queryYear = extractYearFromQuery(query);
    const queryEngine = extractEngineFromQuery(query);

    // URL ordenada por MENOR PREÇO (_OrderId_PRICE) para trazer a oferta mais barata primeiro
    let url = `https://lista.mercadolivre.com.br/${formattedQuery}_OrderId_PRICE_DisplayType_G_NoIndex_True`;
    if (queryYear) {
        url += `#D[A${queryYear - 1}-${queryYear + 1}]`;
    }


    // ✅ Validação multi-palavra: extrai as palavras mais significativas da peça
    // Palavras que NÃO são o substantivo principal (genéricas demais, preposições ou qualidade)
    const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'com', 'para', 'por', 'kit', 'par', 'jogo', 'conjunto', 'novo', 'original']);
    const normalizeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Todas as palavras significativas da peça (≥4 chars, sem stopwords)
    const partWords = normalizeText(expectedPartName)
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w));

    // A palavra PRINCIPAL da peça (primeiro substantivo longo) - OBRIGATÓRIA no título
    // Evita que acessórios/subcomponentes (vedação, tampinha) apareçam no lugar da peça principal
    const GENERIC_QUALIFIERS = new Set(['superior', 'inferior', 'dianteiro', 'traseiro', 'esquerdo', 'direito', 'completo', 'completa', 'alta', 'baixa', 'lado', 'motor', 'cabecote']);
    const mainPartWord = partWords.find(w => !GENERIC_QUALIFIERS.has(w) && w.length >= 5) || partWords[0];

    // Pares conflitantes expandidos: [palavra_da_peca, palavra_inaceitavel_no_titulo]
    const CONFLICTING_PAIRS: Array<[string, string]> = [
        ['junta', 'filtro'],
        ['filtro', 'junta'],
        ['amortecedor', 'pastilha'],
        ['pastilha', 'amortecedor'],
        ['correia', 'filtro'],
        ['vela', 'filtro'],
        ['bomba', 'pastilha'],
        ['reservatorio', 'vedacao'],
        ['reservatorio', 'tampinha'],
        ['reservatorio', 'tampa'],
        ['disco', 'pastilha'],
        ['pastilha', 'disco'],
        ['radiador', 'mangueira'],
        ['rolamento', 'correia'],
    ];

    const isValidProduct = (title: string) => {
        if (!mainPartWord) return true;
        const normalizedTitle = normalizeText(title);

        // REGRA 1: A palavra PRINCIPAL DEVE aparecer no título (obrigatório)
        if (!normalizedTitle.includes(mainPartWord)) return false;

        // REGRA 2: Pares conflitantes - rejeita peças incompatíveis
        for (const [partKey, badWord] of CONFLICTING_PAIRS) {
            const partHasKey = partWords.some(w => w.includes(partKey));
            const titleHasBad = normalizedTitle.includes(badWord);
            const titleHasGood = normalizedTitle.includes(partKey);
            if (partHasKey && titleHasBad && !titleHasGood) return false;
        }

        return true;
    };

    // ✅ Fix 3: Delay aleatório entre 300–800ms para simular comportamento humano
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    // ✅ Fix 1: Seleciona User-Agent aleatório do pool
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
        // ✅ Fix 2: Headers completos simulando navegador real (Chrome no Windows)
        const res = await fetch(url, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': `https://www.google.com/search?q=${encodeURIComponent(cleanQuery + ' mercado livre')}`,
                'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'cross-site',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'Cache-Control': 'max-age=0',
                'Connection': 'keep-alive',
            }
        });

        if (!res.ok) {
            console.warn(`ML retornou status ${res.status} para query: "${query}"`);
        }

        const html = await res.text();

        // Estratégia 1: LD+JSON Graph (funciona para páginas com schema.org)
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
        let scriptMatch;
        let bestJsonProduct = null;

        while ((scriptMatch = scriptRegex.exec(html)) !== null) {
            if (scriptMatch[1].includes('"@graph"') && scriptMatch[1].includes('"Product"')) {
                try {
                    const parsed = JSON.parse(scriptMatch[1]);
                    if (parsed['@graph']) {
                        // ✅ Fix 4: Analisa todos os candidatos e escolhe o mais relevante
                        const products = parsed['@graph'].filter((x: any) =>
                            x['@type'] === 'Product' &&
                            x.offers &&
                            x.offers.price &&
                            isValidProduct(x.name || '')
                        );
                        // Prioriza produto que também valide ano/motorização
                        const bestProduct = products.find((p: any) =>
                            isTitleRelevant(p.name || '', queryYear, queryEngine)
                        ) || products[0];
                        if (bestProduct) {
                            bestJsonProduct = bestProduct;
                            break;
                        }
                    }
                } catch (e) { }
            }
        }

        if (bestJsonProduct && bestJsonProduct.offers && bestJsonProduct.offers.url) {
            return {
                id: (bestJsonProduct.sku || 'ml-json') + '-' + idSuffix,
                title: bestJsonProduct.name,
                price: parseFloat(bestJsonProduct.offers.price),
                link: bestJsonProduct.offers.url.split('?')[0].split('#')[0],
                thumbnail: bestJsonProduct.image || 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png',
                brand: marca,
                coupon: null,
                parcelamento: "Ver na loja"
            };
        }

        // Estratégia 2: Regex por Links de ID do ML
        const rx = /href="(https:\/\/[^"]*mercadolivre\.com\.br\/MLB-[^"]+)"/g;
        let m;

        // ✅ Fix 4: Coleta os top 5 candidatos e escolhe o melhor (não apenas o primeiro)
        const candidates: Array<{
            id: string; title: string; price: number; link: string;
            thumbnail: string; brand: string; coupon: string | null; parcelamento: string;
            relevanceScore: number;
        }> = [];

        while ((m = rx.exec(html)) !== null && candidates.length < 5) {
            const rawLink = m[1];
            const cleanLink = rawLink.split('#')[0].split('?')[0];
            const idx = m.index;
            const block = html.substring(Math.max(0, idx - 800), Math.min(html.length, idx + 1500));

            const titleMatch = block.match(/<h2[^>]*>(.*?)<\/h2>/) || block.match(/alt="([^"]+)"/) || block.match(/title="([^"]+)"/);
            const priceMatch = block.match(/<span class="andes-money-amount__fraction">([0-9.,]+)<\/span>/);
            const imgMatch = block.match(/src="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/) || block.match(/data-src="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/);
            const couponMatch = block.match(/<span class="poly-label__text">([^<]*cupom[^<]*|[^<]*OFF[^<]*)<\/span>/i);
            const parcelMatch = block.match(/<span class="poly-price__installments">([^<]+)<\/span>/);

            if (priceMatch && titleMatch) {
                const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

                if (isValidProduct(title)) {
                    // ✅ Fix 4: Calcula score de relevância do candidato
                    let relevanceScore = 0;
                    if (isTitleRelevant(title, queryYear, queryEngine)) relevanceScore += 10;
                    if (queryYear && title.includes(String(queryYear))) relevanceScore += 5;
                    if (marca && title.toLowerCase().includes(marca.toLowerCase())) relevanceScore += 3;

                    candidates.push({
                        id: cleanLink.split('/')[3] + '-' + idSuffix,
                        title,
                        price: parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')),
                        link: cleanLink,
                        thumbnail: imgMatch ? imgMatch[1] : 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png',
                        brand: marca,
                        coupon: couponMatch ? couponMatch[1].trim() : null,
                        parcelamento: parcelMatch ? parcelMatch[1].replace(/<[^>]+>/g, '').trim() : "À vista",
                        relevanceScore
                    });
                }
            }
        }

        if (candidates.length > 0) {
            // Ordena pelo maior score de relevância e retorna o melhor
            candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
            const best = candidates[0];
            return {
                id: best.id, title: best.title, price: best.price, link: best.link,
                thumbnail: best.thumbnail, brand: best.brand, coupon: best.coupon,
                parcelamento: best.parcelamento
            };
        }

    } catch (error) {
        console.error(`Erro ao fazer scrape no ML para "${query}":`, error);
    }

    // Estratégia 3: Fallback ABSOLUTO - link de busca direta no ML para o usuário
    const fallbackUrl = `https://lista.mercadolivre.com.br/${formattedQuery}_DisplayType_G_NoIndex_True`;
    return {
        id: 'ml-fallback-' + idSuffix,
        title: `Ver as melhores ofertas para ${marca}`,
        price: null,
        link: fallbackUrl,
        thumbnail: 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png',
        brand: marca,
        coupon: null,
        parcelamento: "Pesquisar Preços"
    };
}

async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
    });

    const promptMestre = `
    PERSONA: Você é um Especialista Sênior em Catálogos de Peças Automotivas.
    
    MISSÃO: 
    1. Analisar a pesquisa fornecida: ${query || "Imagem da peça."}.
    2. REGRA ANTI-ALUCINAÇÃO GERAL: Se a pesquisa for GENÉRICA e não especificar modelo exato, ano e motorização:
       - NÃO INVENTE códigos OEM ou da marca. Preencha-os como "Requer modelo exato" ou "Consultar Catálogo".
       - Adicione no "breve_explicativo" um aviso CLARO: "ATENÇÃO: Sua busca foi muito genérica. Para garantir a peça e código corretos, especifique modelo, ano e motor exatos."
       - Use termos abrangentes no Mercado Livre.
    3. REGRA ANTI-ALUCINAÇÃO EXTREMA PARA "codigo_peca" (CÓDIGO DAS MARCAS AFTERMARKET):
       - LLMs (incluindo você) FREQUENTEMENTE ERRAM códigos específicos de fabricantes paralelos (ex: MANN, MAHLE, Hengst, NGK).
       - VOCÊ ESTÁ TERMINANTEMENTE PROIBIDO DE "CHUTAR", APROXIMAR OU DEDUZIR O CÓDIGO DA PEÇA.
       - Por exemplo: O filtro de óleo do motor Audi/VW EA888 2.0 TSI (geração 1 e 2 blindado) geralmente NUNCA É o 'HU 6002 Z', e sim o 'W 719/45' da MANN ou 'OC 795' da MAHLE.
       - SE VOCÊ NÃO TIVER 100% DE CERTEZA ABSOLUTA DE UM CATÁLOGO OFICIAL, É OBRIGATÓRIO PREENCHER O CAMPO "codigo_peca" EXATAMENTE COM O TEXTO: "Consulte o catálogo oficial do fabricante".
       - É infinitamente preferível dizer "Consulte o catálogo" do que dar um código errado que fará o usuário comprar a peça incorreta.
    4. Se a pesquisa FOR ESPECÍFICA (com modelo, ano e motor): Identifique EXATAMENTE UMA peça aplicável, fornecendo o "codigo_oem" correto (este você pode buscar na sua base de dados).
    5. Recomendar as 3 Melhores Marcas PREMIUM disponíveis no Brasil para essa peça.
    6. Para cada marca recomendada (em buscas específicas), você DEVE gerar um "termo_busca_mercadolivre" EXTREMAMENTE ESPECÍFICO (Nome da peça + Modelo + Marca da peça) focando em Lojas Confiáveis.
    7. Forneça um "breve_explicativo" sobre a função e importância dessa peça.
    8. CRÍTICO: RETORNE TODAS AS INFORMAÇÕES EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL (PT-BR).

    REGRAS DE FORMATO JSON - RETORNE APENAS ESTE JSON VÁLIDO (SEM CHAVES EXTRAS):
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico Exato da Peça Singular",
        "breve_explicativo": "Explicação da função da peça (Aviso da regra 2 se genérica)",
        "codigo_oem": "Código da Montadora Principal (ou 'Requer modelo exato')",
        "nome_ingles": "Nome da peça em inglês",
        "veiculo_base": "Modelo exato, ano e motor compatível",
        "validacao_catalogo": "Ex: Catálogo Oficial Volkswagen"
      },
      "intercambiabilidade": [
        "Marca/Modelo (Ano) - Motorização (Informar plug and play)"
      ],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "SE NÃO TIVER CERTEZA ABSOLUTA USE O TEXTO: 'Consulte o catálogo oficial do fabricante'",
          "justificativa": "Por que esta marca?",
          "termo_busca_mercadolivre": "TERMO ESPECÍFICO PARA BUSCA NO ML"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Código OEM ou Nome em inglês",
        "link_busca": "URL de busca AliExpress",
        "recomendacao": "É seguro importar e vale a pena?"
      }
    }
    `;

    let result;
    if (image) {
        try {
            // A imagem já vem comprimida do frontend (Canvas client-side)
            const rawBase64 = image.split(',')[1] || image;
            const imageParts = [{ inlineData: { data: rawBase64, mimeType: "image/jpeg" } }];
            result = await model.generateContent([promptMestre, ...imageParts]);
        } catch (imgError) {
            throw new Error("Falha ao processar a imagem enviada. Certifique-se de ser um formato válido.");
        }
    } else {
        result = await model.generateContent(promptMestre);
    }

    let resultText = result.response.text();
    resultText = resultText.replace(/^\s*\`\`\`json\s*/g, '').replace(/\s*\`\`\`\s*$/g, '').trim();

    try {
        return JSON.parse(resultText) as GeminiResponse;
    } catch (e) {
        throw new Error("Falha na estrutura JSON da IA.");
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

        // 2. Buscar Ofertas Reais Diretamente do Mercado Livre em Paralelo (Bypass de links quebrados)
        const expectedPartName = aiAnalysis.identificacao_tecnica.peca;
        const mlPromises = (aiAnalysis.top_3_marcas || []).map((marcaItem, idx) => {
            if (marcaItem.termo_busca_mercadolivre) {
                return scrapeML(marcaItem.termo_busca_mercadolivre, marcaItem.marca, idx.toString(), expectedPartName);
            }
            return Promise.resolve(null);
        });

        const mlScrapedResults = await Promise.all(mlPromises);
        const mlOffers = mlScrapedResults.filter((result) => result !== null);

        // 3. Consolidar
        const finalResponse = {
            query: query || "Busca por Imagem",
            dados_tecnicos: {
                identificacao_tecnica: aiAnalysis.identificacao_tecnica,
                intercambiabilidade: aiAnalysis.intercambiabilidade,
                top_3_marcas: aiAnalysis.top_3_marcas,
                referencia_aliexpress: aiAnalysis.referencia_aliexpress
            },
            ml_results: mlOffers
        };

        // 4. Salvar Histórico async
        supabase
            .from("search_history")
            .insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse), user_id: user_id || null }])
            .then(({ error }) => { if (error) console.error("Erro ao salvar histórico:", error); });

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
        console.error("Erro na API:", error);

        // Registrar erro no painel do Supabase silenciosamente
        supabase.from('system_errors').insert([{
            error_message: error.message || 'Erro desconhecido na API de Pesquisa',
            context: { origin: 'api_pesquisa', payload: requestContext }
        }]).then();

        return NextResponse.json({ error: "Erro interno.", details: error.message }, { status: 500 });
    }
}

