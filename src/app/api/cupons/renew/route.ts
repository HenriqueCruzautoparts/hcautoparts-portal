import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 15;

// GET — Renova automaticamente cupons que vencem nos próximos N dias
// Pode ser chamado por cron job ou manualmente
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get("x-admin-email") || searchParams.get("admin_email");
    const diasParaVencer = parseInt(searchParams.get("dias") || "7");
    const renovarPor = parseInt(searchParams.get("renovar_por") || "60");

    // Validação de admin (skip em ambiente de desenvolvimento)
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && adminEmail !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const hoje = new Date();
    const limiteVencimento = new Date();
    limiteVencimento.setDate(hoje.getDate() + diasParaVencer);

    const hojeSql = hoje.toISOString().split("T")[0];
    const limiteSql = limiteVencimento.toISOString().split("T")[0];

    // Busca cupons ativos que vencem em breve OU já vencidos
    const { data: cuponsParaRenovar, error: fetchError } = await supabase
      .from("cupons")
      .select("id, titulo, codigo, data_validade")
      .eq("ativo", true)
      .lte("data_validade", limiteSql);

    if (fetchError) throw fetchError;

    if (!cuponsParaRenovar || cuponsParaRenovar.length === 0) {
      return NextResponse.json({
        renovados: 0,
        mensagem: `Nenhum cupom vence nos próximos ${diasParaVencer} dias.`,
        verificado_em: new Date().toISOString(),
      });
    }

    // Nova data de validade
    const novaValidade = new Date();
    novaValidade.setDate(novaValidade.getDate() + renovarPor);
    const novaValidadeSql = novaValidade.toISOString().split("T")[0];

    const ids = cuponsParaRenovar.map((c) => c.id);

    const { error: updateError } = await supabase
      .from("cupons")
      .update({ data_validade: novaValidadeSql })
      .in("id", ids);

    if (updateError) throw updateError;

    return NextResponse.json({
      renovados: cuponsParaRenovar.length,
      nova_validade: novaValidadeSql,
      cupons_renovados: cuponsParaRenovar.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        codigo: c.codigo,
        validade_anterior: c.data_validade,
      })),
      verificado_em: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Erro na renovação de cupons:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao renovar cupons." },
      { status: 500 }
    );
  }
}
