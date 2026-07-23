import { NextResponse } from "next/server";
import {
  RUNNER,
  extraerErrores,
  resumenFases,
  runPython,
  traducir,
} from "@/lib/panai";

export const runtime = "nodejs";

interface CuerpoEjecutar {
  codigo?: unknown;
  pregunta?: unknown;
  apiKey?: unknown;
  modelo?: unknown;
  llamarModelo?: unknown;
}

export async function POST(req: Request) {
  let body: CuerpoEjecutar;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const { codigo, pregunta, apiKey, modelo, llamarModelo } = body;

  if (typeof codigo !== "string" || !codigo.trim()) {
    return NextResponse.json({ error: "Falta el código fuente PANAI" }, { status: 400 });
  }
  if (typeof pregunta !== "string" || !pregunta.trim()) {
    return NextResponse.json({ error: "Escribe una pregunta para el agente" }, { status: 400 });
  }
  const conModelo = llamarModelo === true;
  if (conModelo && (typeof apiKey !== "string" || !apiKey.trim())) {
    return NextResponse.json(
      { error: "Para llamar al modelo real necesitas pegar tu API key de OpenAI" },
      { status: 400 },
    );
  }

  try {
    // 1) Traducir primero: si el programa tiene errores, se reportan igual
    //    que en /api/traducir y no se ejecuta nada.
    const t = await traducir(codigo);
    if (!t.ok) {
      return NextResponse.json({
        ok: false,
        etapa: "traduccion",
        log: t.stdout,
        fases: resumenFases(t.stdout, false),
        errores: extraerErrores(t.stdout),
      });
    }

    // 2) Ejecutar el codigo generado con el runner.
    //    La API key SOLO se pasa como variable de entorno al proceso hijo;
    //    nunca se escribe a disco ni se registra en logs.
    const env: Record<string, string> = {};
    if (conModelo && typeof apiKey === "string") env.OPENAI_API_KEY = apiKey.trim();
    if (typeof modelo === "string" && modelo.trim()) env.PANAI_MODELO = modelo.trim();

    const args = [RUNNER, t.salidaPath, pregunta];
    if (conModelo) args.push("--modelo");

    const r = await runPython(args, { env, timeoutMs: 120_000 });

    let resultado: unknown = null;
    try {
      resultado = JSON.parse(r.stdout);
    } catch {
      return NextResponse.json(
        {
          error: "El runner no regresó JSON válido",
          detalle: r.stdout || r.stderr,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      etapa: "ejecucion",
      codigoGenerado: t.codigoGenerado,
      fases: resumenFases(t.stdout, true),
      resultado,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "No se pudo ejecutar Python. Verifica que `python` esté en el PATH. " +
          `Detalle: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
