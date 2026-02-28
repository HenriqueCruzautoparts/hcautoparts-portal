import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const envFile = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envFile.match(/GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        tools: [{ googleSearch: {} }]
    });
    try {
        const res = await model.generateContent('Acesse a internet. Pesquise no Google e encontre 3 URLs EXATAS REAIS e ativas de compras no Mercado Livre (que comecem com https://produto.mercadolivre.com.br/MLB-) para a busca: Amortecedor dianteiro Corolla 2020 Cofap. Retorne apenas as URLs separadas por linha, sem formatar como JSON nem Markdown, APENAS texto limpo das URLs reais. É expressamente importante que as URLs sejam produtos reais e existam.');
        console.log("Response text:");
        console.log(res.response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
