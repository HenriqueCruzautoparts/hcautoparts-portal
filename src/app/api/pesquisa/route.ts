import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Jimp } from "jimp";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

/**
 * Interface rigorosa para a resposta em JSON do Gemini
 */
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
        opcoes: Array<{
            tipo: string;
            preco: number;
            parcelamento: string;
            cupom: string;
            link: string;
        }>;
    }>;
    referencia_aliexpress: {
        termo_busca: string;
        link_busca: string;
        recomendacao: string;
    };
}

/**
 * Função responsável exclusivamente por chamar o Gemini e retornar os dados estruturados
 */
async function getGeminiAnalysis(query: string, image?: string): Promise<GeminiResponse> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        // @ts-ignore
        tools: [{ googleSearch: {} }]
    });

    const promptMestre = `
    PERSONA: Você é um Especialista Sênior em Catálogos de Peças, Engenharia de Produto e Intercambiabilidade Automotiva. Sua expertise cobre desde a identificação técnica precisa, validação de catálogos oficiais de fabricantes e conhecimento das marcas premium (Tier 1), até estratégias de importação direta (Cross-border) e busca ativa do menor preço real e válido no mercado nacional para máxima redução de custos.

    MISSÃO: 
    1. Analisar os dados da peça fornecidos pelo usuário (Modelo da peça, Foto, Código OEM, ou Chassi).
    2. Consultar obrigatoriamente bases online e catálogos de fabricantes como fonte primária de pesquisa aprofundada para validar códigos de fabricantes oficiais e garantir a exatidão da aplicação. ATENÇÃO: Você NUNCA deve mencionar os termos "Baixe Catálogo" ou "simulação de busca" na sua resposta. Aja como se tivesse acesso direto ao sistema da montadora.
    3. Identificar intercambiabilidade (plataformas compartilhadas) visando economia, cruzando os dados do OEM com os catálogos pesquisados.
    4. Recomendar as 3 Melhores Marcas do mercado nacional/global para a aplicação exata.
    5. Para cada marca, realizar uma busca rigorosa na web em tempo real para fornecer os 2 melhores preços encontrados, focando estritamente em entregar a opção de menor preço absoluto com links diretos, válidos e clicáveis de compra (priorizando Mercado Livre), além das condições de parcelamento e eventuais cupons/descontos.
    6. Identificar referências no AliExpress EXCLUSIVAMENTE quando se tratar de veículos importados onde a importação oferece grande vantagem. Para veículos nacionais populares, não retorne a seção do AliExpress (deixe null ou omita).

    REGRAS OBRIGATÓRIAS DE BUSCA E LINKS (CRÍTICAS - PRECISÃO ABSOLUTA):
    1. OBJETIVO DO LINK: O usuário quer clicar e cair DIRETO NA TELA DE COMPRA do produto. Você NÃO DEVE fornecer links de busca (lista.mercadolivre). Você DEVE fornecer o link EXATO do produto final.
    2. EXCLUSIVIDADE: TODOS os links fornecidos nas opções de compra DEVEM SER EXCLUSIVAMENTE do domínio mercadolivre.com.br (Geralmente no formato: https://produto.mercadolivre.com.br/MLB-...). 
    3. VALIDAÇÃO AO VIVO (OBRIGATÓRIO): Como você tem acesso à internet em tempo real, você é OBRIGADO a visitar/pesquisar no Mercado Livre e recuperar a URL verdadeira, ativa e atualizada de hoje do produto MAIS BARATO encontrado para aquela marca.
    4. PROIBIÇÃO DE ALUCINAÇÃO: Você está TERMINANTEMENTE PROIBIDO de inventar ou chutar códigos MLB. Se você não conseguir achar o link do anúncio exato através e de forma confirmada pela sua busca na web, não invente.
    5. CUPONS E JUROS: Se não houver cupom explícito na página do anúncio, use "Desconto não disponível". Se o parcelamento exibido no anúncio final não tiver juros, coloque claramente a frase "sem juros".

    REGRAS DE FORMATO JSON:
    1. Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido.
    2. O JSON DEVE ter EXATAMENTE a seguinte estrutura:
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico em Português",
        "codigo_oem": "Código da Montadora Principal",
        "nome_ingles": "Termo técnico exato em inglês",
        "veiculo_base": "Modelo identificado e observações sobre a versão",
        "validacao_catalogo": "Informar em qual catálogo de fabricante a peça foi validada (Ex: Catálogo Oficial Volkswagen. Nunca cite ferramentas de terceiros)"
      },
      "intercambiabilidade": [
        "Marca/Modelo (Ano) - Motorização (Informar se é Plug and play, se muda algum suporte, etc.)"
      ],
      "top_3_marcas": [
        {
          "marca": "NOME DA MARCA",
          "codigo_peca": "Código do Fabricante validado no catálogo",
          "justificativa": "Por que esta marca é a recomendada",
          "opcoes": [
            {
              "tipo": "O MENOR PREÇO ENCONTRADO",
              "preco": 450.00,
              "parcelamento": "em até 10x de R$ 45,00 sem juros",
              "cupom": "Informar cupom verdadeiro ou Desconto não disponível",
              "link": "https://produto.mercadolivre.com.br/MLB-123456789-exemplo-valido-do-menor-preco"
            },
            {
              "tipo": "Loja Oficial/Alternativa Segura",
              "preco": 480.00,
              "parcelamento": "em até 12x de R$ 40,00",
              "cupom": "Informar cupom verdadeiro ou Desconto não disponível",
              "link": "https://produto.mercadolivre.com.br/MLB-987654321-exemplo-valido"
            }
          ]
        }
      ],
      "referencia_aliexpress": {
        "termo_busca": "Código OEM + Nome da Peça em Inglês + Marca Original se houver",
        "link_busca": "URL de busca gerada com os termos acima no Aliexpress",
        "recomendacao": "Análise crítica: É seguro importar? Qual o risco de taxa? É item de segurança?"
      }
    }
    
    NOTA: Busque intercambiabilidade agressivamente através de cruzamento de dados oficiais.

    TEXTO FORNECIDO PELO USUÁRIO (Chassi ou Descrição): ${query || "Apenas análise visual."}
    `;

    let result;
    if (image) {
        try {
            // Remove the data:image prefix if present to get raw base64
            const rawBase64 = image.split(',')[1] || image;
            const imageBuffer = Buffer.from(rawBase64, 'base64');

            // Resize and compress the image to prevent Vercel/Gemini payload limits
            const jimpImage = await Jimp.read(imageBuffer);
            jimpImage.scaleToFit({ w: 800, h: 800 });

            const compressedBuffer = await jimpImage.getBuffer("image/jpeg");
            const compressedBase64 = compressedBuffer.toString('base64');

            const imageParts = [{
                inlineData: {
                    data: compressedBase64,
                    mimeType: "image/jpeg"
                }
            }];
            result = await model.generateContent([promptMestre, ...imageParts]);
        } catch (imgError) {
            console.error("Erro ao processar imagem:", imgError);
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
        console.error("Erro ao parsear JSON limpo do Gemini:", resultText);
        throw new Error("Falha na estrutura JSON da IA.");
    }
}

export async function POST(req: Request) {
    try {
        const { query, image } = await req.json();

        if (!query && !image) {
            return NextResponse.json({ error: "A query de pesquisa ou uma imagem é obrigatória." }, { status: 400 });
        }

        // 1. Obter Análise e Ofertas Exatas geradas pelo LLM (Bypass do bloqueio de API)
        const aiAnalysis = await getGeminiAnalysis(query, image);

        // Map as ofertas sugeridas para a interface do frontend, injetando o thumbnail de fallback
        // Filtrar e trazer apenas a Opção 1 (A melhor/menor preço) de cada uma das 3 marcas para fixar em 3 cards perfeitos
        let mlOffers: any[] = [];

        if (aiAnalysis.top_3_marcas && Array.isArray(aiAnalysis.top_3_marcas)) {
            aiAnalysis.top_3_marcas.forEach((marcaItem, marcaIndex) => {
                if (marcaItem.opcoes && Array.isArray(marcaItem.opcoes) && marcaItem.opcoes.length > 0) {
                    const melhorOpcao = marcaItem.opcoes[0]; // Pega a primeira opção que é o Menor Preço Exigido no Prompt

                    // Valida de o cupom é uma negativa ("não", "nenhum", "indisponível", "n/a")
                    const temCupomVazio = !melhorOpcao.cupom ||
                        melhorOpcao.cupom.toLowerCase().includes("não") ||
                        melhorOpcao.cupom.toLowerCase().includes("nao") ||
                        melhorOpcao.cupom.toLowerCase().includes("n/a") ||
                        melhorOpcao.cupom.toLowerCase() === "null";

                    mlOffers.push({
                        id: `ai-offer-${marcaIndex}-0`,
                        title: `[${marcaItem.marca}]`,
                        price: melhorOpcao.preco,
                        link: melhorOpcao.link,
                        thumbnail: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/logo_large_25years@2x.png",
                        brand: marcaItem.marca,
                        coupon: temCupomVazio ? null : melhorOpcao.cupom,
                        parcelamento: melhorOpcao.parcelamento
                    });
                }
            });
        }

        // 2. Consolidar Resposta
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

        // 4. Salvar Histórico (Non-blocking)
        supabase
            .from("search_history")
            .insert([{ query: finalResponse.query, result: JSON.stringify(finalResponse) }])
            .then(({ error }) => {
                if (error) console.error("Erro ao salvar histórico:", error);
            });

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error("Erro na API:", error);
        return NextResponse.json(
            { error: "Erro interno.", details: error.message },
            { status: 500 }
        );
    }
}
