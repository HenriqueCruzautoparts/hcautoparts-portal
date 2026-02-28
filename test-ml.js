
const fs = require("fs");
fetch("https://lista.mercadolivre.com.br/Amortecedor-dianteiro-Corolla-2020-Cofap", {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
})
.then(res => res.text())
.then(html => {
    fs.writeFileSync("ml-dump.html", html);
    console.log("Written to ml-dump.html", html.length);
});

