
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function run() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
  });
  const res = await model.generateContent("Encontre 3 links EXATOS de compra (URLs que comecem com produto.mercadolivre.com.br/MLB) para Amortecedor Dianteiro Corolla 2020 Cofap. Retorne APENAS os 3 links separados por linha.");
  console.log(res.response.text());
}
run().catch(console.error);

