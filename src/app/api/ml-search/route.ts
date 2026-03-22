import { NextResponse } from "next/server";

export const maxDuration = 30;

const ML_APP_ID = process.env.ML_APP_ID;
const ML_SECRET_KEY = process.env.ML_SECRET_KEY;


let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getMlAppToken(): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    try {
        const res = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: ML_APP_ID || '',
                client_secret: ML_SECRET_KEY || ''
            }),
            signal: AbortSignal.timeout(8000)
        });
        const data = await res.json();
        if (data.access_token) {
            cachedToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in - 600) * 1000;
            return cachedToken;
        }
    } catch {}
    return null;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '8');

    if (!query) {
        return NextResponse.json({ error: 'Parâmetro q obrigatório' }, { status: 400 });
    }

    const token = await getMlAppToken();

    // Tentativa 1: API oficial com token App
    if (token) {
        try {
            const encodedQ = encodeURIComponent(query);
            const mlRes = await fetch(
                `https://api.mercadolibre.com/sites/MLB/search?q=${encodedQ}&limit=${limit}&sort=price_asc`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0',
                    },
                    signal: AbortSignal.timeout(10000)
                }
            );
            if (mlRes.ok) {
                const data = await mlRes.json();
                const results = data.results || [];
                if (results.length > 0) {
                    return NextResponse.json({ results, total: data.paging?.total || 0 });
                }
            }
        } catch {}
    }

    // Tentativa 2: API do app mobile do ML (endpoint diferente, sem WAF tão restritivo)
    try {
        const encodedQ = encodeURIComponent(query);
        const mobileRes = await fetch(
            `https://apiseller.mercadolivre.com.br/v1/buyer/search?q=${encodedQ}&limit=${limit}&sort=price_asc&site_id=MLB`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'MercadoLivre/7.20.0 (Android 12; Samsung SM-G998B)',
                    'x-channel-id': 'ML_ANDROID'
                },
                signal: AbortSignal.timeout(8000)
            }
        );
        if (mobileRes.ok) {
            const data = await mobileRes.json();
            const results = data.results || data.items || [];
            if (results.length > 0) {
                return NextResponse.json({ results });
            }
        }
    } catch {}

    // Tentativa 3: Scraping da página de resultados HTML do ML para extrair JSON embutido
    try {
        const encodedQ = encodeURIComponent(query);
        const htmlRes = await fetch(
            `https://www.mercadolivre.com.br/busca?q=${encodedQ}&sort=price_asc`,
            {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Cache-Control': 'no-cache',
                },
                signal: AbortSignal.timeout(12000)
            }
        );
        
        if (htmlRes.ok) {
            const html = await htmlRes.text();
            
            // Extrai o JSON embutido no HTML da página de busca
            const jsonMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]+?});/) ||
                              html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/) ||
                              html.match(/initialState\s*=\s*({[\s\S]+?});/);
            
            if (jsonMatch) {
                try {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    // Tenta encontrar os resultados em locais comuns do JSON do ML
                    const rawResults = 
                        jsonData?.initialState?.results ||
                        jsonData?.props?.pageProps?.results ||
                        jsonData?.results ||
                        [];
                    
                    if (rawResults.length > 0) {
                        const results = rawResults.slice(0, limit).map((item: any) => ({
                            id: item.id,
                            title: item.title,
                            price: item.price || item.prices?.amount,
                            thumbnail: item.thumbnail || item.picture,
                            permalink: item.permalink || item.url,
                            installments: item.installments
                        }));
                        return NextResponse.json({ results, source: 'html_scrape' });
                    }
                } catch {}
            }

            // Se não encontrar o JSON embutido, tenta extrair os produtos direto do HTML
            const results = [];
            const regex = /"id":"(MLB\d+)","title":"([^"]+)",[\s\S]*?"price":(\d+(?:\.\d+)?)/g;
            let m;
            let i = 0;
            while ((m = regex.exec(html)) !== null && i < limit) {
                results.push({
                    id: m[1] + '_' + i,
                    title: m[2],
                    price: parseFloat(m[3]),
                    thumbnail: null,
                    permalink: `https://www.mercadolivre.com.br/p/${m[1]}`
                });
                i++;
            }
            if (results.length > 0) {
                return NextResponse.json({ results, source: 'html_regex' });
            }
        }
    } catch (err: any) {
        console.error('Erro no scraping HTML:', err.message);
    }

    return NextResponse.json({ error: 'Não foi possível obter resultados do ML', results: [] }, { status: 200 });
}
