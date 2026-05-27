import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

async function getAutodiagAnalysis(
  veiculo: string,
  problema: string,
  dtcs: string[],
  liveData: string,
  attachments?: {type: 'image'|'pdf'; base64: string}[]
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("Erro de Configuração: GEMINI_API_KEY não encontrada.");
  }

  const MODEL_NAME = "gemini-2.5-flash";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const dtcsList = dtcs.length > 0 ? dtcs.join(", ") : "Nenhum código informado";
  const liveDataSection = liveData?.trim()
    ? `\n**DADOS DO SCANNER (Live Data):**\n${liveData}`
    : "";

  const hasImages = attachments?.some(a => a.type === 'image') ?? false;
  const hasPdfs = attachments?.some(a => a.type === 'pdf') ?? false;
  const hasAttachments = attachments && attachments.length > 0;

  const prompt = `
Você é um Especialista Sênior em Diagnóstico Automotivo. Atua como parceiro técnico para oficinas profissionais.
Conhecimento: injeção eletrônica, redes CAN, sistemas mecânicos, OBDII e protocolos proprietários (VAG, Ford, Toyota).

**VEÍCULO:** ${veiculo || "Não especificado"}
**PROBLEMA:** ${problema || "Não descrito"}
**DTCs:** ${dtcsList}
${liveDataSection}
${hasAttachments ? `**ARQUIVOS ANEXADOS:** ${attachments!.length} arquivo(s) (${attachments!.map(a => a.type === 'pdf' ? 'PDF' : 'Imagem').join(', ')}) — Analise todos.` : ""}

Resposta OBRIGATÓRIA: seja CONCISO e DIRETO. Máximo 120 palavras por seção. Use bullet points. Sem texto genérico ou introduções desnecessárias.

Use EXATAMENTE este formato Markdown:

---

## 📋 RESUMO (máx. 3 linhas)
(Contexto técnico do problema apresentado)

---

## 🔍 ANÁLISE TÉCNICA
${dtcs.length > 0 ? `### Códigos de Falha (DTCs)
- **[CÓDIGO]** — Significado + condição de disparo + primário ou sintomático` : ""}
${liveData ? `### Live Data
- Analise cada parâmetro. Destaque valores suspeitos com **negrito**.` : ""}
${hasImages ? `### Análise Visual
- Liste desgastes, vazamentos, carbonização, fraturas ou montagem incorreta vistos nas imagens.` : ""}
${hasPdfs ? `### Relatório PDF
- Extraia os dados relevantes do PDF e analise tecnicamente.` : ""}

---

## 🧠 HIPÓTESES (ordem decrescente de probabilidade)
1. **[Causa mais provável]** — justificativa técnica objetiva
2. **[Segunda hipótese]** — justificativa técnica objetiva
3. **[Terceira hipótese]** — se aplicável

---

## 🛠️ ROTEIRO DE TESTES (mais simples primeiro)
1. **[Teste 1]** — O que testar + como + valor esperado
2. **[Teste 2]** — O que testar + como + valor esperado
3. **[Teste 3]** — O que testar + como + valor esperado

---

## ⚠️ NOTA TÉCNICA
- Problemas crônicos conhecidos neste modelo
- Alertas sobre peças que NÃO devem ser trocadas sem diagnóstico comprovado
- Ferramentas específicas necessárias (se houver)

---

Responda em Português do Brasil.
  `;

  // Monta as parts: texto do prompt + todos os arquivos (imagens e PDFs)
  const parts: any[] = [{ text: prompt }];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      const rawBase64 = att.base64.split(',')[1] || att.base64;
      if (att.type === 'image') {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: rawBase64 } });
      } else if (att.type === 'pdf') {
        parts.push({ inline_data: { mime_type: 'application/pdf', data: rawBase64 } });
      }
    }
  }

  const contents = [{ parts }];

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
    const { veiculo, problema, dtcs, liveData, attachments, image, user_id, user_email, anon_fingerprint } = payload;

    // Compatibilidade retroativa: suporta campo `image` (antigo) e novo `attachments`
    const finalAttachments: {type: 'image'|'pdf'; base64: string}[] = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      finalAttachments.push(...attachments);
    } else if (image) {
      finalAttachments.push({ type: 'image', base64: image });
    }

    if (!problema?.trim() && finalAttachments.length === 0) {
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
      finalAttachments.length > 0 ? finalAttachments : undefined
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
