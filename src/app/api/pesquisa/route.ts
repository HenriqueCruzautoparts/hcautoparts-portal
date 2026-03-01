import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Jimp } from "jimp";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

interface GeminiResponse {
    identificacao_tecnica: {
        peca: string;
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

async function scrapeML(query: string, marca: string, idSuffix: string) {
    const formattedQuery = query.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
    const url = `https://lista.mercadolivre.com.br/${formattedQuery}_DisplayType_G_NoIndex_True`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            }
        });
        const html = await res.text();

        // Estratégia 1: Tenta o Fallback do LD+JSON Graph (Funciona para páginas ofuscadas de resultados)
        const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
        let scriptMatch;
        let jsonPayload = null;

        while ((scriptMatch = scriptRegex.exec(html)) !== null) {
            // Mercado Livre injeta os produtos em um schema.org Graph Array
            if (scriptMatch[1].includes('"@graph"') && scriptMatch[1].includes('"Product"')) {
                try {
                    const parsed = JSON.parse(scriptMatch[1]);
                    if (parsed['@graph']) {
                        const products = parsed['@graph'].filter((x: any) => x['@type'] === 'Product' && x.offers && x.offers.price);
                        if (products.length > 0) {
                            jsonPayload = products[0];
                            break;
                        }
                    }
                } catch (e) { }
            }
        }

        if (jsonPayload && jsonPayload.offers && jsonPayload.offers.url) {
            return {
                id: (jsonPayload.sku || 'ml-json') + '-' + idSuffix,
                title: jsonPayload.name,
                price: parseFloat(jsonPayload.offers.price),
                link: jsonPayload.offers.url.split('?')[0].split('#')[0],
                thumbnail: jsonPayload.image || 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png',
                brand: marca,
                coupon: null,
                parcelamento: "Ver na loja"
            };
        }

        // Estratégia 2: Regex Universal Baseado em Links de ID (Funciona para listas padrão)
        const rx = /href="(https:\/\/[^"]*mercadolivre\.com\.br\/MLB-[^"]+)"/g;
        let m;
        while ((m = rx.exec(html)) !== null) {
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
                return {
                    id: cleanLink.split('/')[3] + '-' + idSuffix,
                    title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
                    price: parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')),
                    link: cleanLink,
                    thumbnail: imgMatch ? imgMatch[1] : 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png',
                    brand: marca,
                    coupon: couponMatch ? couponMatch[1].trim() : null,
                    parcelamento: parcelMatch ? parcelMatch[1].replace(/<[^>]+>/g, '').trim() : "À vista"
                };
            }
        }

    } catch (error) {
        console.error(`Erro ao fazer scrape no ML para "${query}":`, error);
    }

    // Estratégia 3: Fallback ABSOLUTO - Se o ML bloquear o IP ou não achar nada, retorna a URL de busca direta para o usuário não ficar sem link
    return {
        id: 'ml-fallback-' + idSuffix,
        title: `Ver as melhores ofertas para ${marca}`,
        price: null,
        link: url, // Link direto para a página de pesquisa do ML
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
    1. Analisar a peça fornecida: ${query || "Imagem da peça."}.
    2. Identificar exatamente o carro, ano, motor e peça necessária.
    3. Recomendar as 3 Melhores Marcas PREMIUM disponíveis no Brasil.
    4. Para cada marca recomendada, você DEVE gerar um "termo_busca_mercadolivre" EXTREMAMENTE ESPECÍFICO (Ex: "lanterna traseira palio 2010 magneti marelli") para que nosso robô busque o menor preço real no sistema da loja.
    5. CRÍTICO: RETORNE TODAS AS INFORMAÇÕES, DESCRIÇÕES E JUSTIFICATIVAS EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL (PT-BR).

    REGRAS DE FORMATO JSON - VOCÊ DEVE RETORNAR APENAS ESTE JSON VÁLIDO:
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico Exato em Português",
        "codigo_oem": "Código da Montadora Principal",
        "nome_ingles": "Nome da peça em inglês (Apenas neste campo)",
        "veiculo_base": "Modelo exato, ano e motorização compatível (em português)",
        "validacao_catalogo": "Ex: Catálogo Oficial Volkswagen"
      },
      "intercambiabilidade": [
        "Marca/Modelo (Ano) - Motorização (Informar plug and play)"
      ],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "Código do Fabricante",
          "justificativa": "Por que esta marca?",
          "termo_busca_mercadolivre": "TERMO HIPER ESPECÍFICO PARA BUSCA NO MERCADO LIVRE (Ex: amortecedor dianteiro gol g5 2010 cofap)"
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Código OEM ou Nome em inglês",
        "link_busca": "URL de busca AliExpress",
        "recomendacao": "É seguro importar?"
      }
    }
    `;

    let result;
    if (image) {
        try {
            const rawBase64 = image.split(',')[1] || image;
            const imageBuffer = Buffer.from(rawBase64, 'base64');
            const jimpImage = await Jimp.read(imageBuffer);
            jimpImage.scaleToFit({ w: 800, h: 800 });
            const compressedBuffer = await jimpImage.getBuffer("image/jpeg");
            const imageParts = [{ inlineData: { data: compressedBuffer.toString('base64'), mimeType: "image/jpeg" } }];
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
    try {
        const { query, image } = await req.json();

        if (!query && !image) {
            return NextResponse.json({ error: "A query de pesquisa ou imagem é obrigatória." }, { status: 400 });
        }

        // 1. Obter Inteligência do Gemini
        const aiAnalysis = await getGeminiAnalysis(query, image);

        // 2. Buscar Ofertas Reais Diretamente do Mercado Livre em Paralelo (Bypass de links quebrados)
        const mlPromises = (aiAnalysis.top_3_marcas || []).map((marcaItem, idx) => {
            if (marcaItem.termo_busca_mercadolivre) {
                return scrapeML(marcaItem.termo_busca_mercadolivre, marcaItem.marca, idx.toString());
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
            .insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse) }])
            .then(({ error }) => { if (error) console.error("Erro ao salvar histórico:", error); });

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Erro na API:", error);
        return NextResponse.json({ error: "Erro interno.", details: error.message }, { status: 500 });
    }
}
