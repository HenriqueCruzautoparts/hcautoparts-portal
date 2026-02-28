
const query = encodeURIComponent("site:produto.mercadolivre.com.br Amortecedor Corolla 2020 Cofap");
fetch("https://html.duckduckgo.com/html/?q=" + query, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  }
})
  .then(res => res.text())
  .then(html => {
     let match = html.match(/href="([^"]+produto\.mercadolivre\.com\.br\/MLB[^"]+)"/);
     if(match) console.log("Link DDG:", match[1]);
     else console.log("No match", html.length);
  });

