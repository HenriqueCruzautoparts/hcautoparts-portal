import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 15;

const ML_AFFILIATE = "matt_word=henriquecruzn&matt_tool=81389334&forceInApp=true&ref=BFOG";

// Monta URL do ML com afiliado a partir de um termo de busca
function buildMlUrl(termo: string): string {
  const slug = termo.trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `https://lista.mercadolivre.com.br/${slug}?${ML_AFFILIATE}`;
}

// GET — Lista cupons ativos e válidos (público)
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("cupons")
      .select("*")
      .eq("ativo", true)
      .gte("data_validade", today)
      .order("ordem", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      cupons: data || [],
      total: data?.length || 0,
      gerado_em: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao buscar cupons." },
      { status: 500 }
    );
  }
}

// POST — Cria novo cupom (somente admin)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { admin_email, titulo, descricao, codigo, link, termo_ml, ordem, dias_validade } = body;

    // Validação simples de admin
    if (admin_email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (!titulo || !descricao || !codigo) {
      return NextResponse.json(
        { error: "Campos obrigatórios: titulo, descricao, codigo." },
        { status: 400 }
      );
    }

    // Se veio um termo_ml em vez de link direto, monta a URL
    const linkFinal = link || (termo_ml ? buildMlUrl(termo_ml) : null);
    if (!linkFinal) {
      return NextResponse.json(
        { error: "Informe link ou termo_ml para o cupom." },
        { status: 400 }
      );
    }

    const dias = parseInt(dias_validade) || 30;
    const validade = new Date();
    validade.setDate(validade.getDate() + dias);
    const dataValidade = validade.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("cupons")
      .insert([{
        titulo,
        descricao,
        codigo: codigo.toUpperCase().trim(),
        link: linkFinal,
        ativo: true,
        ordem: ordem || 99,
        data_validade: dataValidade,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cupom: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao criar cupom." },
      { status: 500 }
    );
  }
}

// PATCH — Renova ou atualiza cupom (somente admin)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { admin_email, id, dias_validade, ativo, titulo, descricao, link, termo_ml } = body;

    if (admin_email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "ID do cupom obrigatório." }, { status: 400 });
    }

    const updates: Record<string, any> = {};

    if (dias_validade) {
      const novaValidade = new Date();
      novaValidade.setDate(novaValidade.getDate() + parseInt(dias_validade));
      updates.data_validade = novaValidade.toISOString().split("T")[0];
    }
    if (typeof ativo === "boolean") updates.ativo = ativo;
    if (titulo) updates.titulo = titulo;
    if (descricao) updates.descricao = descricao;
    if (link) updates.link = link;
    if (termo_ml) updates.link = buildMlUrl(termo_ml);

    const { data, error } = await supabase
      .from("cupons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cupom: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao atualizar cupom." },
      { status: 500 }
    );
  }
}

// DELETE — Desativa cupom (soft delete, somente admin)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const adminEmail = req.headers.get("x-admin-email");

    if (adminEmail !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "ID do cupom obrigatório." }, { status: 400 });
    }

    const { error } = await supabase
      .from("cupons")
      .update({ ativo: false })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Cupom desativado." });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao desativar cupom." },
      { status: 500 }
    );
  }
}
