import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

async function getAutodiagAnalysis(
  veiculo: string,
  problema: string,
  dtcs: string[],
  liveData: string,
  image?: string
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("Erro de Configuração: GEMINI_API_KEY não encontrada.");
  }

  const MODEL_NAME = "gemini-2.5-flash";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const dtcsList = dtcs.length > 0 ? dtcs.join(", ") : "Nenhum código informado";
  const liveDataSection = liveData?.trim()
    ? `\n**DADOS DO SCANNER (Live Data fornecido pelo técnico):**\n${liveData}`
    : "";

  const prompt = `
Você é um Especialista Sênior em Diagnóstico Automotivo e Engenharia Mecânica. 
Sua função é atuar como parceiro técnico avançado para oficinas mecânicas profissionais.
Você possui conhecimento profundo em injeção eletrônica, redes CAN, sistemas mecânicos (motor/câmbio), e protocolos de comunicação (OBDII e proprietários como VAG, Ford, Toyota).

**VEÍCULO:** ${veiculo || "Não especificado"}
**DESCRIÇÃO DO PROBLEMA:** ${problema}
**CÓDIGOS DE FALHA (DTCs):** ${dtcsList}
${liveDataSection}
${image ? "**IMAGEM:** O técnico enviou uma foto para análise visual." : ""}

Analise toda a informação acima e responda OBRIGATORIAMENTE usando EXATAMENTE este formato de resposta em Markdown:

---

## 📋 RESUMO DO PROBLEMA

(Breve descrição técnica do que foi apresentado — máximo 3 linhas)

---

## 🔍 ANÁLISE TÉCNICA

${dtcs.length > 0 ? `### Análise dos Códigos de Falha (DTCs)
Para cada DTC informado, explique:
- **[CÓDIGO]** — Significado técnico completo + condição exata de disparo (o que a ECU precisa ver para gravar o erro) + classificação (Atual/Pendente/Histórico típico) + se é falha primária ou sintomática

Se houver múltiplos códigos, identifique a falha raiz e as falhas consequentes.` : ""}

${liveData ? `### Análise de Coerência dos Dados (Live Data)
Analise cada parâmetro fornecido verificando a plausibilidade física e coerência entre eles.
Destaque qualquer valor suspeito ou fora de especificação.` : ""}

${image ? `### Análise Visual
Identifique desgastes, vazamentos, carbonização, rupturas ou montagens incorretas visíveis na imagem.` : ""}

---

## 🧠 HIPÓTESES DIAGNÓSTICAS

Liste em ordem de probabilidade (da mais provável para menos provável), com justificativa técnica para cada uma:

1. **[Causa mais provável]** — justificativa técnica detalhada
2. **[Segunda hipótese]** — justificativa técnica
3. **[Terceira hipótese]** — justificativa técnica (se aplicável)

---

## 🛠️ ROTEIRO DE TESTES SUGERIDO

Liste os testes em ordem lógica de execução (do mais simples/barato ao mais complexo):

1. **Teste 1** — [O que testar, como testar, quais valores esperar]
2. **Teste 2** — [O que testar, como testar, quais valores esperar]
3. **Teste 3** — [O que testar, como testar, quais valores esperar]
(adicione mais testes se necessário)

---

## ⚠️ NOTA TÉCNICA

Inclua aqui:
- Problemas crônicos conhecidos neste modelo/motor (TSBs, recalls, falhas de projeto)
- Particularidades do sistema que o técnico deve conhecer antes de iniciar
- Avisos sobre peças que NÃO devem ser trocadas sem diagnóstico comprovado
- Ferramentas específicas necessárias (se houver)

---

Responda em Português do Brasil. Seja direto e técnico. Não use linguagem genérica ou respostas vagas.
  `;

  let contents: any[];
  if (image) {
    const rawBase64 = image.split(",")[1] || image;
    contents = [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
      ]
    }];
  } else {
    contents = [{ parts: [{ text: prompt }] }];
  }

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
          }
        })
      });

      const data = await res.json();

      if (data.error) {
        const isTransient =
          data.error.status === "RESOURCE_EXHAUSTED" ||
          data.error.code === 429 ||
          data.error.status === "UNAVAILABLE" ||
          data.error.code === 503;

        if (isTransient && i < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }

        if (data.error.status === "RESOURCE_EXHAUSTED" || data.error.code === 429) {
          throw new Error("O sistema está sobrecarregado. Aguarde 30 segundos e tente novamente.");
        }
        throw new Error(`Erro API Gemini: ${data.error.message}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("A IA não retornou conteúdo válido.");

      return text;

    } catch (e: any) {
      lastError = e;
      if (i < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error("Falha ao comunicar com a IA após várias tentativas.");
}

export async function POST(req: Request) {
  let requestContext: any = {};
  try {
    const payload = await req.json();
    requestContext = payload;
    const { veiculo, problema, dtcs, liveData, image, user_id, user_email, anon_fingerprint } = payload;

    if (!problema?.trim() && !image) {
      return NextResponse.json(
        { error: "Descreva o problema ou envie uma imagem para o diagnóstico." },
        { status: 400 }
      );
    }

    // Controle de limite — mesmo sistema da pesquisa padrão
    const isUnlimitedUser =
      user_email === process.env.ADMIN_EMAIL ||
      user_email === "henrike.henrique.cn94@gmail.com";

    if (user_id && !isUnlimitedUser) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("search_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user_id)
        .gte("created_at", startOfMonth.toISOString());

      if (count && count >= 15) {
        return NextResponse.json(
          { error: "Você atingiu o limite mensal de 15 consultas. Faça upgrade para continuar!" },
          { status: 403 }
        );
      }
    }

    if (!user_id && anon_fingerprint) {
      const { data: anonRecord } = await supabase
        .from("anon_search_limits")
        .select("id, search_count")
        .eq("fingerprint", anon_fingerprint)
        .single();

      if (anonRecord && anonRecord.search_count >= 5) {
        return NextResponse.json(
          {
            error: "Você já utilizou suas 5 consultas gratuitas. Crie sua conta para continuar!",
            require_signup: true
          },
          { status: 403 }
        );
      }
    }

    const veiculoString = veiculo
      ? `${veiculo.montadora || ""} ${veiculo.modelo || ""} ${veiculo.ano || ""} ${veiculo.motor || ""}`.trim()
      : "";

    const analise = await getAutodiagAnalysis(
      veiculoString,
      problema || "",
      dtcs || [],
      liveData || "",
      image
    );

    // Salva no histórico se usuário logado
    if (user_id) {
      try {
        const queryLabel = `[AutoDiag] ${veiculoString || "Veículo"} — ${(problema || "").substring(0, 60)}`;
        await supabase.from("search_history").insert([{
          query: queryLabel,
          result: JSON.stringify({ analise_tecnica: analise, tipo: "autodiag" }),
          user_id
        }]);
      } catch (_) {
        // Falha silenciosa no histórico não bloqueia o resultado
      }
    }

    // Atualiza contador anônimo
    if (!user_id && anon_fingerprint) {
      const { data: existing } = await supabase
        .from("anon_search_limits")
        .select("id, search_count")
        .eq("fingerprint", anon_fingerprint)
        .single();

      if (existing) {
        await supabase
          .from("anon_search_limits")
          .update({ search_count: existing.search_count + 1, last_search_at: new Date().toISOString() })
          .eq("fingerprint", anon_fingerprint);
      } else {
        await supabase
          .from("anon_search_limits")
          .insert([{ fingerprint: anon_fingerprint, search_count: 1 }]);
      }
    }

    return NextResponse.json({ analise, veiculo: veiculoString });

  } catch (error: any) {
    console.error("Erro na rota /api/autodiag:", error);

    try {
      await supabase.from("system_errors").insert([{
        error_message: error.message || "Erro desconhecido no AutoDiag",
        context: { origin: "api_autodiag", payload: requestContext }
      }]);
    } catch (_) {}

    return NextResponse.json(
      { error: error.message || "Erro interno no AutoDiag." },
      { status: 500 }
    );
  }
}
