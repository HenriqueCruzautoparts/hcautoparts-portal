import { NextResponse } from "next/server";

export const maxDuration = 30;

// Termos de busca para autopeças populares — rotação para variedade
const SEARCH_TERMS = [
  "filtro de oleo carro",
  "pastilha de freio carro",
  "amortecedor dianteiro",
  "correia dentada kit",
  "vela de ignição",
  "filtro de ar carro",
  "fluido de freio dot",
  "kit embreagem",
  "disco de freio",
  "bomba dagua motor",
  "rolamento roda dianteiro",
  "jogo de vela",
];

const ML_AFFILIATE = "matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG";

// Seleciona N itens aleatórios
function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Monta o link de afiliado para o item ML
function buildPermalink(permalink: string): string {
  try {
    const url = new URL(permalink);
    url.searchParams.set("matt_word", "henriquecruzn");
    url.searchParams.set("matt_tool", "81389334");
    url.searchParams.set("forceInApp", "true");
    url.searchParams.set("ref", "BFOG");
    return url.toString();
  } catch {
    return `${permalink}?${ML_AFFILIATE}`;
  }
}

// Busca itens reais com desconto no ML para um termo
async function fetchMlItemsWithDiscount(term: string): Promise<any[]> {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(term)}&has_pictures=true&limit=8&sort=relevance`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // User-Agent compatível com navegador para evitar bloqueio
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      // Cache de 10 minutos no servidor — evita rate limiting
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.warn(`ML API retornou ${res.status} para termo: "${term}"`);
      return [];
    }

    const data = await res.json();
    const results: any[] = data.results || [];

    // Filtra APENAS itens com desconto real confirmado (original_price > price)
    return results
      .filter(
        (item: any) =>
          item.original_price &&
          item.original_price > item.price &&
          item.price > 0 &&
          item.thumbnail &&
          item.permalink
      )
      .slice(0, 3) // máx 3 por termo para variedade
      .map((item: any) => ({
        id: item.id,
        titulo: item.title,
        categoria: item.category_id || "Autopeças",
        preco_original: item.original_price,
        preco_atual: item.price,
        desconto_percent: Math.round(
          ((item.original_price - item.price) / item.original_price) * 100
        ),
        thumbnail: (item.thumbnail || "").replace("http://", "https://"),
        link_ml: buildPermalink(item.permalink),
        link_shopee: `https://shopee.com.br/search?keyword=${encodeURIComponent(item.title)}`,
        fonte: "ml_real" as const,
        vendedor: item.seller?.nickname || null,
        disponivel: item.available_quantity > 0,
      }));
  } catch (err: any) {
    console.error(`Erro ao buscar ML para "${term}":`, err.message);
    return [];
  }
}

export async function GET() {
  try {
    // Seleciona 4 termos aleatórios para variedade a cada request
    const selectedTerms = pickRandom(SEARCH_TERMS, 4);

    // Busca em paralelo para todos os termos selecionados
    const resultGroups = await Promise.all(
      selectedTerms.map((term) => fetchMlItemsWithDiscount(term))
    );

    // Junta tudo, remove duplicatas por ID e ordena pelo maior desconto
    const seen = new Set<string>();
    const allOffers = resultGroups
      .flat()
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return item.disponivel; // somente itens disponíveis
      })
      .sort((a, b) => b.desconto_percent - a.desconto_percent); // maior desconto primeiro

    if (allOffers.length === 0) {
      // ML API bloqueada neste ambiente — retorna status informativo
      return NextResponse.json(
        {
          ofertas: [],
          total: 0,
          ml_disponivel: false,
          mensagem:
            "A API do Mercado Livre requer autenticação neste ambiente. Configure ML_APP_TOKEN para ativar ofertas reais.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ofertas: allOffers,
      total: allOffers.length,
      ml_disponivel: true,
      gerado_em: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Erro na rota /api/ofertas:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar ofertas.", ofertas: [] },
      { status: 500 }
    );
  }
}
