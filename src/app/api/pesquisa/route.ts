import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
    2. Consultar obrigatoriamente o site Baixe Catálogo (https://www.baixecatalogo.com.br/) como fonte primária de pesquisa aprofundada para validar códigos de fabricantes oficiais, especificações técnicas e garantir a exatidão da aplicação.
    3. Identificar intercambiabilidade (plataformas compartilhadas) visando economia, cruzando os dados do OEM com os catálogos pesquisados.
    4. Recomendar as 3 Melhores Marcas do mercado nacional/global para a aplicação exata.
    5. Para cada marca, realizar uma busca rigorosa na web em tempo real para fornecer os 2 melhores preços encontrados, focando estritamente em entregar a opção de menor preço absoluto com links diretos, válidos e clicáveis de compra (priorizando Mercado Livre), além das condições de parcelamento e eventuais cupons/descontos.
    6. Identificar referências e disponibilidade no AliExpress para peças onde a importação oferece grande vantagem.

    REGRAS OBRIGATÓRIAS:
    1. Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido. NUNCA formatação de markdown fora do JSON.
    2. O JSON DEVE ter EXATAMENTE a seguinte estrutura restrita com essas chaves e formatação de texto limpa:
    {
      "identificacao_tecnica": {
        "peca": "Nome Técnico em Português",
        "codigo_oem": "Código da Montadora Principal",
        "nome_ingles": "Termo técnico exato em inglês",
        "veiculo_base": "Modelo identificado e observações sobre a versão",
        "validacao_catalogo": "Informar em qual catálogo de fabricante no baixecatalogo.com.br a peça foi validada"
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
              "parcelamento": "em até 10x de R$ 45,00",
              "cupom": "Informar cupom, desconto no PIX ou Não localizado",
              "link": "URL VÁLIDA e DIRETA do anúncio com o menor preço (ex: Mercado Livre)"
            },
            {
              "tipo": "Loja Oficial/Alternativa Segura",
              "preco": 480.00,
              "parcelamento": "em até 12x de R$ 40,00",
              "cupom": "Informar cupom, desconto no PIX ou Não localizado",
              "link": "URL VÁLIDA e DIRETA do produto"
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
    NOTA 1: Você DEVE usar sua ferramenta de Google Search para recuperar links reais do mercadolivre.com.br ou amazon. Nunca deduzir ou inventar URLs. A "Opção 1" de cada marca DEVE obrigatoriamente ser a do MENOR PREÇO.
    NOTA 2: "top_3_marcas" DEVE ser um array contendo as 3 melhores marcas sendo 1 Original, 1 Primeira Linha e 1 Custo Beneficio, contendo 2 opções de compra (link real) cada.
    NOTA 3: Os textos NÃO DEVEM conter tags HTML.
    NOTA 4: Sempre realize buscas prévias no baixecatalogo.com.br. Busque intercambiabilidade agressivamente (ex: VW/Audi/Porsche). Nas "Top 3", priorize (Bosch, Mahle, Mann, NGK, Ina, SKF, Bilstein, Denso, Valeo, TRW, Nakata).

    TEXTO FORNECIDO PELO USUÁRIO (Placa, Chassi ou Descrição): ${query || "Apenas análise visual."}
    `;

    let result;
    if (image) {
        const imageParts = [{
            inlineData: {
                data: image.split(',')[1] || image,
                mimeType: "image/jpeg"
            }
        }];
        result = await model.generateContent([promptMestre, ...imageParts]);
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
