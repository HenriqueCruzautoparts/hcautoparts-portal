import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getGeminiAnalysis(query) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    const MODEL_NAME = "gemini-2.5-flash"; // Using the latest alias which is always active
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const promptMestre = `
    Você é um cataloguista técnico automotivo. Sua única tarefa é identificar a peça exata e retornar dados técnicos em JSON.
    PESQUISA: "${query}"
    (regras reduzidas para economizar tokens nos testes)
    Retorne apenas JSON válido contendo: "identificacao_tecnica", "intercambiabilidade", "top_3_marcas".
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
    if (data.error) throw new Error(data.error.message + " Status: " + data.error.status);
    
    return data.candidates[0].content.parts[0].text;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
    console.log("Iniciando Bateria de Testes...\n");
    const testCases = [
        "Junta do cabeçote Corolla 2020 2.0",
        "Amortecedor dianteiro Honda Civic 2015",
        "Sensor ABS roda traseira HR-V 2018",
        "Válvula termostática Jeep Renegade 1.8 2019"
    ];

    for (const [i, test] of testCases.entries()) {
        console.log(`[Teste ${i+1}/${testCases.length}] Pesquisando: "${test}"`);
        try {
            const start = Date.now();
            const res = await getGeminiAnalysis(test);
            const time = ((Date.now() - start)/1000).toFixed(2);
            console.log(`✅ Sucesso (${time}s). Retorno tem ${res.length} caracteres.\n`);
        } catch (e) {
            console.error(`❌ Falha: ${e.message}\n`);
        }
        
        if (i < testCases.length - 1) {
            console.log("Aguardando 10 segundos para não estourar a cota da API (Rate Limit)...");
            await sleep(10000); 
        }
    }
}

runTests();
