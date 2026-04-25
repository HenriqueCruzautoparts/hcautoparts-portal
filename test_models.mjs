import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listModels() {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const models = data.models.map(m => m.name);
        console.log("Modelos Disponíveis:");
        console.log(models);
        
        // Let's also do a quick generation test on the primary candidate
        const testModel = models.find(m => m.includes('1.5-flash')) || models.find(m => m.includes('pro')) || models[0];
        console.log("Testando com:", testModel);
        
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/${testModel}:generateContent?key=${apiKey}`;
        const res = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{parts: [{text: "Hello"}]}]
            })
        });
        const testData = await res.json();
        if(testData.error) {
            console.error("Erro no teste:", testData.error);
        } else {
            console.log("Sucesso no teste!");
        }
    } catch (e) {
        console.error("Erro ao listar modelos:", e);
    }
}
listModels();
