import https from 'https';

const req = https.request('https://hcautoparts-portal.vercel.app/api/pesquisa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json);
            } else {
                console.log("=== TECHNICAL DATA ===");
                console.log("Part:", json.dados_tecnicos.identificacao_tecnica.peca);
                console.log("\n=== ML LINKS ===");
                json.ml_results.forEach((item, index) => {
                    console.log(`[${index + 1}] Brand: ${item.brand}`);
                    console.log(`    Link: ${item.link}`);
                    console.log(`    Price: R$ ${item.price}`);
                    console.log(`    Coupon: ${item.coupon}`);
                    console.log(`    Installment: ${item.parcelamento}`);
                });
            }
        } catch (e) {
            console.error("Failed to parse JSON response:", data);
        }
    });
});

req.on('error', error => {
    console.error("Request failed:", error);
});

req.write(JSON.stringify({ query: 'amortecedor dianteiro gol g5' }));
req.end();
