// Utilerias del lado del servidor para invocar el traductor PANAI (Python).
// La pagina NO reimplementa el traductor: cada peticion escribe el programa
// fuente a un archivo temporal y ejecuta el MISMO `traductor.py` de la
// entrega, capturando su salida.

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Carpeta donde vive el traductor de la entrega (lexer.py, traductor.py...). */
export const FILES_DIR = path.resolve(process.cwd(), "..", "files");

/** Script que ejecuta el codigo generado y regresa JSON (vive junto a la demo). */
export const RUNNER = path.resolve(process.cwd(), "runner.py");

const PYTHON = process.env.PANAI_PYTHON ?? "python";

export interface ResultadoPython {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runPython(
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<ResultadoPython> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, args, {
      cwd: FILES_DIR, // para que `from lexer import ...` resuelva
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        ...opts.env,
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), opts.timeoutMs ?? 60_000);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export interface ResultadoTraduccion extends ResultadoPython {
  ok: boolean;
  codigoGenerado: string | null;
  /** Ruta del .py generado (solo si ok), para poder ejecutarlo despues. */
  salidaPath: string;
}

/** Corre el pipeline completo (lexico -> sintactico -> semantico -> generacion). */
export async function traducir(codigo: string): Promise<ResultadoTraduccion> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "panai-"));
  const fuente = path.join(dir, "programa.panai");
  const salida = path.join(dir, "salida.py");
  await fs.writeFile(fuente, codigo, "utf-8");

  const res = await runPython(["traductor.py", fuente, salida]);

  let codigoGenerado: string | null = null;
  if (res.code === 0) {
    codigoGenerado = await fs.readFile(salida, "utf-8");
  }
  return { ...res, ok: res.code === 0, codigoGenerado, salidaPath: salida };
}

export type EstadoFase = "ok" | "error" | "pendiente";

export interface Fases {
  lexico: EstadoFase;
  sintactico: EstadoFase;
  semantico: EstadoFase;
  generacion: EstadoFase;
}

/**
 * Deduce el estado de cada fase a partir del log de traductor.py.
 * El pipeline se detiene en la primera fase con error, asi que las fases
 * posteriores quedan "pendiente" (no alcanzadas).
 */
export function resumenFases(log: string, ok: boolean): Fases {
  const errLexico = log.includes("Se encontraron errores lexicos");
  const errSintactico = log.includes("Se encontraron errores sintacticos");
  const errSemantico = log.includes("Corrige los errores semanticos");

  if (errLexico) {
    return { lexico: "error", sintactico: "pendiente", semantico: "pendiente", generacion: "pendiente" };
  }
  if (errSintactico) {
    return { lexico: "ok", sintactico: "error", semantico: "pendiente", generacion: "pendiente" };
  }
  if (errSemantico) {
    return { lexico: "ok", sintactico: "ok", semantico: "error", generacion: "pendiente" };
  }
  if (ok) {
    return { lexico: "ok", sintactico: "ok", semantico: "ok", generacion: "ok" };
  }
  // Fallo inesperado (p.ej. Python no encontrado): nada se puede afirmar.
  return { lexico: "pendiente", sintactico: "pendiente", semantico: "pendiente", generacion: "pendiente" };
}

/** Extrae solo las lineas de error del log, para resaltarlas en la pagina. */
export function extraerErrores(log: string): string[] {
  return log
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.startsWith("[LEXICO]") ||
        l.startsWith("[SINTACTICO]") ||
        l.trimStart().startsWith("- ") || // detalle de errores semanticos
        l.startsWith("[ABORTADO]"),
    )
    .map((l) => l.trim());
}
