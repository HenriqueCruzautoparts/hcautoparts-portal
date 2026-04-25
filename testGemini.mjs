import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getGeminiAnalysis(query) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) throw new Error("Sem Chave");
    
    const MODEL_NAME = "gemini-2.5-flash";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const promptMestre = `
    Você é um cataloguista técnico automotivo. Sua única tarefa é identificar a peça exata e retornar dados técnicos em JSON.

    PESQUISA DO USUÁRIO: "${query}"

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

    const contents = [{ parts: [{ text: promptMestre }] }];

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    return data.candidates[0].content.parts[0].text;
}

getGeminiAnalysis("Kit válvulas Audi A3 Sportback 2010 2.0 TFSI").then(console.log).catch(console.error);
