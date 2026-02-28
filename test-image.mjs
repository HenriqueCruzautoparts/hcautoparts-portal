import https from 'https';
import fs from 'fs';

// Read a dummy small file to act as the image payload
const dummyImageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";

const payload = JSON.stringify({
    query: 'Audi A3 Sportback 8P 2011. Junta cavalete',
    image: dummyImageData
});

const req = https.request('https://hcautoparts-portal.vercel.app/api/pesquisa', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status Code:", res.statusCode);
        console.log("Response:", data);
    });
});

req.on('error', error => {
    console.error("Request failed:", error);
});

req.write(payload);
req.end();
