"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { EJEMPLOS } from "@/lib/ejemplos";

type EstadoFase = "ok" | "error" | "pendiente";

interface Fases {
  lexico: EstadoFase;
  sintactico: EstadoFase;
  semantico: EstadoFase;
  generacion: EstadoFase;
}

interface RespuestaTraducir {
  ok: boolean;
  log: string;
  stderr?: string;
  codigoGenerado: string | null;
  fases: Fases;
  errores: string[];
  error?: string;
}

interface Directa {
  funcion: string;
  respuesta: string;
}

interface ResultadoRunner {
  directas: Directa[];
  modelo: string | null;
  error_modelo: string | null;
  error: string | null;
}

interface RespuestaEjecutar {
  ok: boolean;
  etapa?: "traduccion" | "ejecucion";
  log?: string;
  fases?: Fases;
  errores?: string[];
  codigoGenerado?: string;
  resultado?: ResultadoRunner;
  error?: string;
  detalle?: string;
}

const FASES_INICIALES: Fases = {
  lexico: "pendiente",
  sintactico: "pendiente",
  semantico: "pendiente",
  generacion: "pendiente",
};

const NOMBRES_FASE: Array<[keyof Fases, string]> = [
  ["lexico", "Léxico"],
  ["sintactico", "Sintáctico"],
  ["semantico", "Semántico"],
  ["generacion", "Generación"],
];

type Proveedor = "gemini" | "openai";

// Modelos comunes por proveedor para el menú desplegable. Con «Cargar
// modelos» la lista se reemplaza por los disponibles reales para tu API key.
const MODELOS_BASE: Record<Proveedor, string[]> = {
  gemini: [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
  ],
  openai: [
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5",
    "gpt-5.1",
  ],
};

const INFO_PROVEEDOR: Record<
  Proveedor,
  { nombre: string; urlKey: string; urlKeyCorta: string; nota: string; placeholder: string }
> = {
  gemini: {
    nombre: "Gemini",
    urlKey: "https://aistudio.google.com/apikey",
    urlKeyCorta: "aistudio.google.com/apikey",
    nota: "gratis, con tu cuenta de Google",
    placeholder: "AIza…",
  },
  openai: {
    nombre: "OpenAI",
    urlKey: "https://platform.openai.com/api-keys",
    urlKeyCorta: "platform.openai.com/api-keys",
    nota: "requiere saldo en la cuenta",
    placeholder: "sk-…",
  },
};

function EstadoBadge({ estado }: { estado: EstadoFase }) {
  if (estado === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#00f0e0]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#00776e]">
        ✓ ok
      </span>
    );
  }
  if (estado === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">
        ✗ error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
      —
    </span>
  );
}

export default function Home() {
  const [codigo, setCodigo] = useState(EJEMPLOS[0].codigo);
  const [ejemploActivo, setEjemploActivo] = useState<string | null>(EJEMPLOS[0].id);

  const [traduccion, setTraduccion] = useState<RespuestaTraducir | null>(null);
  const [cargandoTraducir, setCargandoTraducir] = useState(false);
  const [tab, setTab] = useState<"codigo" | "log">("codigo");

  const [pregunta, setPregunta] = useState(
    "Tengo examen de calculo, como puedo estudiar?",
  );
  const [proveedor, setProveedor] = useState<Proveedor>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState(MODELOS_BASE.gemini[0]);
  const [modelos, setModelos] = useState<string[]>([]);
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [llamarModelo, setLlamarModelo] = useState(false);

  const [ejecucion, setEjecucion] = useState<RespuestaEjecutar | null>(null);
  const [cargandoEjecutar, setCargandoEjecutar] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);

  // La key se conserva solo en sessionStorage (misma pestaña) para que un
  // refresh accidental durante la presentación no obligue a pegarla de nuevo.
  // Se guarda una key por proveedor (Gemini y OpenAI usan keys distintas).
  useEffect(() => {
    setApiKey(sessionStorage.getItem(`panai_api_key_${proveedor}`) ?? "");
  }, [proveedor]);
  useEffect(() => {
    if (apiKey) sessionStorage.setItem(`panai_api_key_${proveedor}`, apiKey);
    else sessionStorage.removeItem(`panai_api_key_${proveedor}`);
  }, [apiKey, proveedor]);

  // Al cambiar de proveedor: modelo por defecto de ese proveedor y se
  // descarta la lista cargada del proveedor anterior.
  const cambiarProveedor = (p: Proveedor) => {
    setProveedor(p);
    setModelos([]);
    setModelo(MODELOS_BASE[p][0]);
  };

  const fases = ejecucion?.fases ?? traduccion?.fases ?? FASES_INICIALES;

  const cargarEjemplo = (id: string) => {
    const ej = EJEMPLOS.find((e) => e.id === id);
    if (!ej) return;
    setCodigo(ej.codigo);
    setEjemploActivo(id);
    setTraduccion(null);
    setEjecucion(null);
    setAviso(null);
  };

  const traducirAhora = useCallback(async () => {
    setCargandoTraducir(true);
    setAviso(null);
    setEjecucion(null);
    try {
      const res = await fetch("/api/traducir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const data: RespuestaTraducir = await res.json();
      if (data.error) {
        setAviso(data.error);
        setTraduccion(null);
      } else {
        setTraduccion(data);
        setTab(data.ok ? "codigo" : "log");
      }
    } catch (e) {
      setAviso(`No se pudo contactar al servidor: ${String(e)}`);
    } finally {
      setCargandoTraducir(false);
    }
  }, [codigo]);

  const cargarModelos = async () => {
    if (!apiKey.trim()) {
      setAviso("Pega primero tu API key para consultar tus modelos disponibles.");
      return;
    }
    setCargandoModelos(true);
    setAviso(null);
    try {
      const res = await fetch("/api/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, proveedor }),
      });
      const data: { modelos?: string[]; error?: string } = await res.json();
      if (data.error) {
        setAviso(data.error);
      } else if (data.modelos?.length) {
        setModelos(data.modelos);
        if (!data.modelos.includes(modelo)) setModelo(data.modelos[0]);
      } else {
        setAviso("El proveedor no regresó modelos de chat para esta key.");
      }
    } catch (e) {
      setAviso(`No se pudo contactar al servidor: ${String(e)}`);
    } finally {
      setCargandoModelos(false);
    }
  };

  const ejecutar = async () => {
    setCargandoEjecutar(true);
    setAviso(null);
    try {
      const res = await fetch("/api/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, pregunta, apiKey, modelo, proveedor, llamarModelo }),
      });
      const data: RespuestaEjecutar = await res.json();
      if (data.error) {
        setAviso(data.error + (data.detalle ? ` — ${data.detalle}` : ""));
        setEjecucion(null);
      } else {
        setEjecucion(data);
        if (data.etapa === "traduccion") {
          setTraduccion({
            ok: false,
            log: data.log ?? "",
            codigoGenerado: null,
            fases: data.fases ?? FASES_INICIALES,
            errores: data.errores ?? [],
          });
          setTab("log");
        } else if (data.codigoGenerado) {
          setTraduccion({
            ok: true,
            log: "",
            codigoGenerado: data.codigoGenerado,
            fases: data.fases ?? FASES_INICIALES,
            errores: [],
          });
          setTab("codigo");
        }
      }
    } catch (e) {
      setAviso(`No se pudo contactar al servidor: ${String(e)}`);
    } finally {
      setCargandoEjecutar(false);
    }
  };

  // Ctrl+Enter en el editor = Traducir
  const onKeyDownEditor = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void traducirAhora();
    }
  };

  const resultado = ejecucion?.resultado;

  return (
    <>
      {/* ─────────────── Navbar ─────────────── */}
      <div className="fixed inset-x-0 top-0 z-50">
        {/* Línea de acento con el gradiente del logo */}
        <div className="h-1 w-full bg-gradient-to-r from-[#00f0e0] via-[#2060f0] to-[#5020f0]" />
        <nav className="border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <a href="#" className="flex items-center" aria-label="PANAI — inicio">
              <Image
                src="/panai-logo-light.png"
                alt="PANAI"
                width={73}
                height={60}
                priority
                className="h-9 w-auto"
              />
            </a>
            <div className="flex items-center gap-1 sm:gap-4">
              <a
                href="#traductor"
                className="hidden px-2 py-1 text-sm text-slate-600 transition-colors hover:text-slate-900 md:inline-block"
              >
                Traductor
              </a>
              <a
                href="#probar"
                className="hidden px-2 py-1 text-sm text-slate-600 transition-colors hover:text-slate-900 md:inline-block"
              >
                Probar el agente
              </a>
              <a
                href="#como-funciona"
                className="hidden px-2 py-1 text-sm text-slate-600 transition-colors hover:text-slate-900 md:inline-block"
              >
                Cómo funciona
              </a>
              <a href="#traductor" className="btn-grad rounded-full px-4 py-1.5 text-xs">
                Demo en vivo
              </a>
            </div>
          </div>
        </nav>
      </div>

    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-28 pb-10 sm:px-6">
      {/* ─────────────── Hero ─────────────── */}
      <header className="mb-14 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            UAM Cuajimalpa · Unidad de enseñanza: Traductores
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Describe tu agente de IA.
            <br />
            <span className="grad-text">El traductor lo convierte en Python.</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-500">
            PANAI es un lenguaje declarativo para definir agentes de IA. Esta
            página ejecuta el traductor real (hecho con PLY) en cada petición:
            léxico, sintaxis, semántica y generación de código.
          </p>
        </div>

        {/* Tarjeta del pipeline con borde de gradiente */}
        <div className="rounded-2xl bg-gradient-to-br from-[#00f0e0] via-[#2060f0] to-[#5020f0] p-[1.5px] shadow-md">
          <div className="rounded-[calc(1rem-1.5px)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Pipeline en vivo
            </p>
            <div className="mt-4 space-y-3">
              {NOMBRES_FASE.map(([clave, nombre], i) => (
                <div key={clave} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#00f0e0] via-[#2060f0] to-[#5020f0] font-mono text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{nombre}</span>
                  </div>
                  <EstadoBadge estado={fases[clave]} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────── Avisos ─────────────── */}
      {aviso && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {aviso}
        </div>
      )}

      {/* ─────────────── Ejemplos ─────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {EJEMPLOS.map((ej) => (
          <button
            key={ej.id}
            onClick={() => cargarEjemplo(ej.id)}
            title={ej.descripcion}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              ejemploActivo === ej.id
                ? "border-[#00c2b5] bg-[#00f0e0]/10 text-[#00776e]"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span
              aria-hidden
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                ej.esError ? "bg-rose-400" : "bg-[#00c2b5]"
              }`}
            />
            {ej.nombre}
          </button>
        ))}
      </div>

      {/* ─────────────── Editor + Salida ─────────────── */}
      <section id="traductor" className="grid scroll-mt-24 gap-5 lg:grid-cols-2">
        {/* Editor */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-3">
              {/* Puntos decorativos con los colores del logo */}
              <span aria-hidden className="flex gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-[#00f0e0]" />
                <i className="h-2.5 w-2.5 rounded-full bg-[#2060f0]" />
                <i className="h-2.5 w-2.5 rounded-full bg-[#5020f0]" />
              </span>
              <h2 className="font-mono text-xs text-slate-500">programa.panai</h2>
            </div>
            <button
              onClick={() => void traducirAhora()}
              disabled={cargandoTraducir}
              className="btn-grad rounded-full px-5 py-1.5 text-sm"
            >
              {cargandoTraducir ? "Traduciendo…" : "Traducir"}
            </button>
          </div>
          <textarea
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value);
              setEjemploActivo(null);
            }}
            onKeyDown={onKeyDownEditor}
            spellCheck={false}
            className="h-[28rem] w-full resize-none bg-slate-50 p-5 font-mono text-[13px] leading-relaxed text-slate-800 outline-none"
            aria-label="Editor del programa PANAI"
          />
          <div className="border-t border-slate-200 px-5 py-2 text-[11px] text-slate-400">
            Ctrl + Enter para traducir
          </div>
        </div>

        {/* Salida */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2">
            {(
              [
                ["codigo", "Código Python"],
                ["log", "Log del traductor"],
              ] as const
            ).map(([id, etiqueta]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  tab === id
                    ? "tab-activa font-medium text-slate-900"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {traduccion && !traduccion.ok && traduccion.errores.length > 0 && (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                Errores — no se generó código
              </p>
              <ul className="space-y-1">
                {traduccion.errores.map((e, i) => (
                  <li key={i} className="font-mono text-xs leading-relaxed text-rose-700">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <pre className="h-[28rem] flex-1 overflow-auto bg-slate-50 p-5 font-mono text-[13px] leading-relaxed text-slate-800">
            {tab === "codigo"
              ? traduccion?.codigoGenerado ??
                (traduccion && !traduccion.ok
                  ? "El programa tiene errores — revisa el log."
                  : "Presiona «Traducir» para ver el código generado.")
              : traduccion?.log || "Presiona «Traducir» para ver el log fase por fase."}
          </pre>
        </div>
      </section>

      {/* ─────────────── Ejecución en vivo ─────────────── */}
      <section
        id="probar"
        className="mt-5 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-3">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gradient-to-b from-[#00f0e0] to-[#5020f0]" />
          <h2 className="text-sm font-semibold text-slate-800">Probar el agente</h2>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {/* Configuración */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">
                Mensaje para el agente
              </label>
              <input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#2060f0]"
                placeholder="Escribe la entrada del evento al_recibir…"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={llamarModelo}
                onChange={(e) => setLlamarModelo(e.target.checked)}
                className="accent-[#2060f0]"
              />
              Llamar al modelo real (Gemini u OpenAI)
            </label>

            {llamarModelo && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">Proveedor</label>
                  <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                    {(["gemini", "openai"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => cambiarProveedor(p)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          proveedor === p
                            ? "btn-grad"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {INFO_PROVEEDOR[p].nombre}
                        {p === "gemini" && (
                          <span className={proveedor === p ? " opacity-80" : " text-slate-400"}>
                            {" "}· gratis
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">
                    API key de {INFO_PROVEEDOR[proveedor].nombre}{" "}
                    <span className="text-slate-400">
                      · solo se usa en tu máquina, nunca se guarda
                    </span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-800 outline-none transition-colors focus:border-[#2060f0]"
                    placeholder={INFO_PROVEEDOR[proveedor].placeholder}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Obtenla en{" "}
                    <a
                      href={INFO_PROVEEDOR[proveedor].urlKey}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#009e93] underline decoration-[#00c2b5]/40 hover:text-[#00776e]"
                    >
                      {INFO_PROVEEDOR[proveedor].urlKeyCorta}
                    </a>{" "}
                    ({INFO_PROVEEDOR[proveedor].nota})
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">
                    Modelo{" "}
                    {modelos.length > 0 && (
                      <span className="text-[#009e93]">
                        · {modelos.length} disponibles con tu key
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-800 outline-none transition-colors focus:border-[#2060f0]"
                    >
                      {(modelos.length > 0 ? modelos : MODELOS_BASE[proveedor])
                        .concat(
                          (modelos.length > 0 ? modelos : MODELOS_BASE[proveedor]).includes(modelo)
                            ? []
                            : [modelo],
                        )
                        .map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => void cargarModelos()}
                      disabled={cargandoModelos}
                      title="Consulta qué modelos puede usar tu API key y actualiza la lista"
                      className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
                    >
                      {cargandoModelos ? "…" : "Cargar modelos"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => void ejecutar()}
              disabled={cargandoEjecutar}
              className="btn-grad rounded-full px-6 py-2.5 text-sm"
            >
              {cargandoEjecutar ? "Ejecutando…" : "Traducir y ejecutar"}
            </button>
          </div>

          {/* Resultados */}
          <div className="space-y-3">
            {!resultado && (
              <div className="flex h-full min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                Aquí aparecerán las respuestas del agente
              </div>
            )}

            {resultado?.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Error al ejecutar el código generado: {resultado.error}
              </div>
            )}

            {resultado && !resultado.error && (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#009e93]">
                    Regla del DSL — sin IA
                  </p>
                  {resultado.directas.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Este agente no declaró bloques{" "}
                      <span className="font-mono">al_recibir</span>.
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {resultado.directas.map((d) => (
                        <li key={d.funcion} className="text-sm">
                          <span className="font-mono text-[11px] text-slate-500">
                            {d.funcion}()
                          </span>
                          <p className="mt-0.5 text-slate-800">{d.respuesta}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {llamarModelo && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#2060f0]">
                      Modelo · {modelo}
                    </p>
                    {resultado.error_modelo ? (
                      <p className="text-sm text-amber-700">
                        La llamada al modelo falló: {resultado.error_modelo}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {resultado.modelo}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────── Cómo funciona (landing) ─────────────── */}
      <section id="como-funciona" className="mt-24 scroll-mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            ¿Qué es <span className="grad-text">PANAI</span>?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Un lenguaje de dominio específico (DSL) para describir agentes de IA
            de forma declarativa: defines el objetivo, la personalidad, las
            herramientas, la memoria y las reglas de respuesta de tu agente — y
            el traductor lo convierte en un programa Python listo para
            conectarse a un modelo de lenguaje. Sin escribir una sola línea de
            Python a mano.
          </p>
        </div>

        {/* Las 4 fases */}
        <div className="mt-12">
          <h3 className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Cómo funciona — las 4 fases del traductor
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                num: "01",
                titulo: "Análisis léxico",
                archivo: "lexer.py",
                desc: "Convierte el texto fuente en tokens: palabras reservadas, identificadores, cadenas y símbolos. Detecta caracteres ilegales.",
              },
              {
                num: "02",
                titulo: "Análisis sintáctico",
                archivo: "analizador_sintactico.py",
                desc: "Valida que los tokens sigan la gramática del lenguaje y construye el AST (árbol de sintaxis abstracta) del programa.",
              },
              {
                num: "03",
                titulo: "Análisis semántico",
                archivo: "semantico.py",
                desc: "Recorre el AST y verifica 7 reglas de significado: propiedades únicas, sin duplicados y verificación de ámbito en los eventos.",
              },
              {
                num: "04",
                titulo: "Generación de código",
                archivo: "generador.py",
                desc: "Recorre el AST validado y emite Python ejecutable: el agente, sus reglas traducidas a if/else reales y la llamada al modelo.",
              },
            ].map((f) => (
              <div
                key={f.num}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00f0e0] via-[#2060f0] to-[#5020f0] font-mono text-sm font-bold text-white">
                  {f.num}
                </span>
                <h4 className="mt-3 text-sm font-semibold text-slate-800">
                  {f.titulo}
                </h4>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {f.archivo}
                </p>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Si una fase falla, el pipeline se detiene ahí y reporta el error —
            nunca se genera código a partir de un programa inválido.
          </p>
        </div>

        {/* De DSL a Python */}
        <div className="mt-16">
          <h3 className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Traducción directa — del DSL a Python real
          </h3>
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="border-b border-slate-200 px-4 py-2 font-mono text-[11px] text-slate-500">
                tutor.panai
              </p>
              <pre className="overflow-x-auto bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">{`al_recibir pregunta {
  si contiene(pregunta, "examen") entonces
    responder "Repasemos conceptos.";
  sino
    responder "Te explico paso a paso.";
  fin
}`}</pre>
            </div>
            <span aria-hidden className="grad-text mx-auto text-2xl font-bold lg:rotate-0">
              →
            </span>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="border-b border-slate-200 px-4 py-2 font-mono text-[11px] text-slate-500">
                salida.py — generado automáticamente
              </p>
              <pre className="overflow-x-auto bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">{`def manejar_pregunta(pregunta):
    if "examen" in pregunta:
        return "Repasemos conceptos."
    else:
        return "Te explico paso a paso."`}</pre>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-slate-400">
            El condicional <span className="font-mono">si / sino</span> del DSL se
            convierte en un <span className="font-mono">if / else</span> real, y{" "}
            <span className="font-mono">contiene(x, &quot;…&quot;)</span> en el operador{" "}
            <span className="font-mono">in</span> de Python. Esta parte funciona
            sin IA: es traducción pura, verificable línea por línea.
          </p>
        </div>

        {/* Características */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              titulo: "Errores con contexto",
              desc: "Cada fase reporta sus propios errores con línea y explicación: carácter ilegal, token inesperado o regla semántica violada.",
            },
            {
              titulo: "Código listo para IA",
              desc: "El Python generado incluye el agente completo y la conexión al modelo (Gemini u OpenAI): el prompt se arma con el objetivo, personalidad, reglas y memoria del DSL.",
            },
            {
              titulo: "Proveedor y modelo intercambiables",
              desc: "Con variables de entorno (PANAI_PROVEEDOR, PANAI_MODELO) el mismo programa traducido puede usar Gemini (gratis) u OpenAI, sin volver a traducir.",
            },
          ].map((c) => (
            <div
              key={c.titulo}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span aria-hidden className="block h-1 w-8 rounded-full bg-gradient-to-r from-[#00f0e0] to-[#5020f0]" />
              <h4 className="mt-3 text-sm font-semibold text-slate-800">{c.titulo}</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Tecnologías */}
        <p className="mt-10 text-center text-[11px] text-slate-400">
          Construido con{" "}
          <span className="text-slate-600">Python + PLY (Lex/Yacc)</span> para el
          traductor · <span className="text-slate-600">Next.js</span> para esta
          demo · <span className="text-slate-600">Gemini / OpenAI API</span> para
          la ejecución del agente
        </p>
      </section>

      {/* ─────────────── Pie ─────────────── */}
      <footer className="mt-14">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#2060f0]/40 to-transparent" />
        <div className="flex flex-col items-center gap-4 pt-8 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/uam-logo.png"
            alt="Universidad Autónoma Metropolitana — Unidad Cuajimalpa"
            className="h-10 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Universidad Autónoma Metropolitana · Unidad Cuajimalpa
            <br />
            Unidad de Enseñanza: Traductores — pipeline real: lexer → parser (AST) →
            semántico → generador
          </p>
        </div>
      </footer>
    </main>
    </>
  );
}
