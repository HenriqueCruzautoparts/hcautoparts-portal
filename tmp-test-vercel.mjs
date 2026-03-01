import https from 'https';
import fs from 'fs';
const req = https.request('https://hcautoparts-portal.vercel.app/api/pesquisa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => fs.writeFileSync('error-vercel2.json', data, 'utf-8'));
});
req.write(JSON.stringify({ query: 'golf gti 2015 jogo de velas' }));
req.end();
