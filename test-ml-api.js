const https = require('https');

https.get('https://api.mercadolibre.com/sites/MLB/search?q=lanterna+traseira+palio+2010&limit=1', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        const json = JSON.parse(data);
        if (json.results && json.results.length > 0) {
            const item = json.results[0];
            console.log('Found Item:');
            console.log('Title:', item.title);
            console.log('Price:', item.price);
            console.log('Link:', item.permalink);
        } else {
            console.log('No results or error:', json);
        }
    });
}).on('error', (e) => {
    console.error(e);
});
