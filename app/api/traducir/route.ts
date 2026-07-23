import { NextResponse } from "next/server";
import { extraerErrores, resumenFases, traducir } from "@/lib/panai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { codigo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const { codigo } = body;
  if (typeof codigo !== "string" || !codigo.trim()) {
    return NextResponse.json(
      { error: "Falta el código fuente PANAI" },
      { status: 400 },
    );
  }

  try {
    const r = await traducir(codigo);
    return NextResponse.json({
      ok: r.ok,
      log: r.stdout,
      stderr: r.stderr,
      codigoGenerado: r.codigoGenerado,
      fases: resumenFases(r.stdout, r.ok),
      errores: extraerErrores(r.stdout),
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
