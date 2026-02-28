import fetch from "node-fetch";

const queryStr = 'Amortecedor-dianteiro-Corolla-2020-Cofap';
fetch('https://lista.mercadolivre.com.br/' + queryStr)
  .then(res => res.text())
  .then(html => {
    const linkMatch = html.match(/href="(https:\/\/produto\.mercadolivre\.com\.br\/MLB-[^"]+)"/);
    const titleMatch = html.match(/<h2[^>]*ui-search-item__title[^>]*>([^<]+)<\/h2>/i);
    const priceMatch = html.match(/class="andes-money-amount__fraction"[^>]*>([^<]+)<\/span>/i);
    const imgMatch = html.match(/<img[^>]+src="(https:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i);

    console.log('Title:', titleMatch ? titleMatch[1] : 'NOT_FOUND');
    console.log('Link:', linkMatch ? linkMatch[1] : 'NOT_FOUND');
    console.log('Price:', priceMatch ? priceMatch[1] : 'NOT_FOUND');
    console.log('Image:', imgMatch ? imgMatch[1] : 'NOT_FOUND');
  });
