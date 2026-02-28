import https from 'https';

const queries = [
    'filtro de ar condicionado tracker 2022',
    'bomba d agua hb20 1.0 2018'
];

async function testQuery(query) {
    return new Promise((resolve, reject) => {
        const req = https.request('https://hcautoparts-portal.vercel.app/api/pesquisa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ query }));
        req.end();
    });
}

async function runAll() {
    for (const q of queries) {
        console.log(`\nTesting: "${q}"`);
        try {
            const result = await testQuery(q);
            if (result.error) {
                console.error("  Error:", result.error);
                continue;
            }
            result.ml_results.forEach((item, idx) => {
                console.log(`  [Link ${idx + 1}] -> ${item.link}`);
            });
        } catch (e) {
            console.error("  Failed:", e);
        }
    }
}

runAll();
