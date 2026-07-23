import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Pide a OpenAI la lista de modelos disponibles para la API key dada.
// Se hace desde el servidor de Next (no desde el navegador) para evitar CORS.
// La key solo viaja localhost -> api.openai.com y no se guarda en ningun lado.

const EXCLUIR =
  /(audio|realtime|image|tts|transcribe|whisper|embed|moderation|dall|search|instruct|computer-use|codex)/i;

export async function POST(req: Request) {
  let body: { apiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const { apiKey } = body;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json({ error: "Falta la API key" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      // La lista de modelos es informacion no sensible, pero aun asi no se cachea.
      cache: "no-store",
    });

    if (res.status === 401) {
      return NextResponse.json(
        { error: "API key inválida (OpenAI respondió 401)" },
        { status: 401 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenAI respondió ${res.status}` },
        { status: 502 },
      );
    }

    const data: { data?: Array<{ id: string }> } = await res.json();
    const modelos = (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => /^(gpt-|o\d)/.test(id) && !EXCLUIR.test(id))
      .sort();

    return NextResponse.json({ modelos });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar a api.openai.com (¿hay internet?)" },
      { status: 502 },
    );
  }
}
