# -*- coding: utf-8 -*-
"""
PANAI - Backend de la demo web (Flask).

Una sola funcion serverless de Python que atiende los 3 endpoints de la
pagina. Importa el traductor REAL (la copia vendida en api/_panai, que es
identica a la de files/ salvo write_tables=False para Vercel) y corre el
pipeline en el mismo proceso — sin subprocesos, para que funcione igual en
local y en Vercel.

Local:  flask --app api/index run -p 5328   (lo lanza `npm run dev`)
Vercel: se despliega automaticamente como funcion Python.
"""

import contextlib
import importlib.util
import io
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request

from flask import Flask, jsonify, request

# api/_panai contiene la copia del traductor (el guion bajo evita que Vercel
# exponga esos archivos como endpoints). Al agregarla a sys.path, los imports
# internos entre modulos (`from lexer import ...`) funcionan sin cambios.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "_panai"))

from lexer import lexer, reiniciar_lexer, hubo_error_lexico  # noqa: E402
from analizador_sintactico import parser  # noqa: E402
from semantico import analizar_semantica  # noqa: E402
from generador import generar_codigo  # noqa: E402

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Pipeline (mismo orden y mismos mensajes que files/traductor.py)
# ---------------------------------------------------------------------------
def correr_pipeline(codigo_fuente):
    """Corre las 4 fases y regresa (ok, log, codigo_generado, ast)."""
    salida = io.StringIO()
    codigo_generado = None
    ast = None

    with contextlib.redirect_stdout(salida):
        print("--- Fase 1 y 2: Analisis lexico + sintactico (AST) ---")
        reiniciar_lexer()
        ast = parser.parse(codigo_fuente, lexer=lexer)

        if hubo_error_lexico():
            print("\n[ABORTADO] Se encontraron errores lexicos.")
            return False, salida.getvalue(), None, None

        if ast is None:
            print("\n[ABORTADO] Se encontraron errores sintacticos.")
            return False, salida.getvalue(), None, None

        print("\n--- Fase 3: Analisis semantico ---")
        errores = analizar_semantica(ast)
        if errores:
            print("[SEMANTICO] Se encontraron los siguientes errores:")
            for e in errores:
                print(f"  - {e}")
            print("\n[ABORTADO] Corrige los errores semanticos antes de traducir.")
            return False, salida.getvalue(), None, None

        print("[OK] Sin errores semanticos.")
        print("\n--- Fase 4: Generacion de codigo Python ---")
        codigo_generado = generar_codigo(ast)
        print("[OK] Codigo generado exitosamente.")

    return True, salida.getvalue(), codigo_generado, ast


def resumen_fases(log, ok):
    """Estado de cada fase a partir del log (mismo criterio que la UI)."""
    if "Se encontraron errores lexicos" in log:
        return {"lexico": "error", "sintactico": "pendiente",
                "semantico": "pendiente", "generacion": "pendiente"}
    if "Se encontraron errores sintacticos" in log:
        return {"lexico": "ok", "sintactico": "error",
                "semantico": "pendiente", "generacion": "pendiente"}
    if "Corrige los errores semanticos" in log:
        return {"lexico": "ok", "sintactico": "ok",
                "semantico": "error", "generacion": "pendiente"}
    if ok:
        return {"lexico": "ok", "sintactico": "ok",
                "semantico": "ok", "generacion": "ok"}
    return {"lexico": "pendiente", "sintactico": "pendiente",
            "semantico": "pendiente", "generacion": "pendiente"}


def extraer_errores(log):
    """Solo las lineas de error del log, para resaltarlas en la pagina."""
    lineas = []
    for linea in log.splitlines():
        limpia = linea.strip()
        if (linea.startswith("[LEXICO]") or linea.startswith("[SINTACTICO]")
                or limpia.startswith("- ") or linea.startswith("[ABORTADO]")):
            lineas.append(limpia)
    return lineas


# ---------------------------------------------------------------------------
# POST /api/traducir  { codigo }
# ---------------------------------------------------------------------------
@app.route("/api/traducir", methods=["POST"])
def traducir():
    body = request.get_json(silent=True) or {}
    codigo = body.get("codigo")
    if not isinstance(codigo, str) or not codigo.strip():
        return jsonify({"error": "Falta el código fuente PANAI"}), 400

    ok, log, codigo_generado, _ast = correr_pipeline(codigo)
    return jsonify({
        "ok": ok,
        "log": log,
        "codigoGenerado": codigo_generado,
        "fases": resumen_fases(log, ok),
        "errores": extraer_errores(log),
    })


# ---------------------------------------------------------------------------
# POST /api/ejecutar  { codigo, pregunta, apiKey?, modelo?, llamarModelo? }
# ---------------------------------------------------------------------------
@app.route("/api/ejecutar", methods=["POST"])
def ejecutar():
    body = request.get_json(silent=True) or {}
    codigo = body.get("codigo")
    pregunta = body.get("pregunta")
    api_key = body.get("apiKey")
    modelo = body.get("modelo")
    proveedor = body.get("proveedor")
    llamar_modelo = body.get("llamarModelo") is True

    if proveedor not in ("gemini", "openai"):
        proveedor = "gemini"
    if not isinstance(codigo, str) or not codigo.strip():
        return jsonify({"error": "Falta el código fuente PANAI"}), 400
    if not isinstance(pregunta, str) or not pregunta.strip():
        return jsonify({"error": "Escribe una pregunta para el agente"}), 400
    if llamar_modelo and (not isinstance(api_key, str) or not api_key.strip()):
        return jsonify({"error": "Para llamar al modelo real necesitas pegar tu API key"}), 400

    # 1) Traducir. Si hay errores, se reportan igual que en /api/traducir.
    ok, log, codigo_generado, _ast = correr_pipeline(codigo)
    if not ok:
        return jsonify({
            "ok": False,
            "etapa": "traduccion",
            "log": log,
            "fases": resumen_fases(log, False),
            "errores": extraer_errores(log),
        })

    # 2) Ejecutar el codigo generado. La API key SOLO vive como variable de
    #    entorno durante esta peticion; se restaura el entorno al terminar.
    resultado = {"directas": [], "modelo": None, "error_modelo": None, "error": None}
    entorno_previo = {
        "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY"),
        "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY"),
        "PANAI_MODELO": os.environ.get("PANAI_MODELO"),
        "PANAI_PROVEEDOR": os.environ.get("PANAI_PROVEEDOR"),
    }
    try:
        os.environ["PANAI_PROVEEDOR"] = proveedor
        if llamar_modelo:
            clave_env = "GEMINI_API_KEY" if proveedor == "gemini" else "OPENAI_API_KEY"
            os.environ[clave_env] = api_key.strip()
        if isinstance(modelo, str) and modelo.strip():
            os.environ["PANAI_MODELO"] = modelo.strip()

        # El codigo generado lee PANAI_MODELO al importarse, por eso el env
        # se define ANTES de cargar el modulo.
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "agente_generado.py")
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(codigo_generado)

            spec = importlib.util.spec_from_file_location("agente_generado", ruta)
            modulo = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(modulo)

            for nombre in sorted(dir(modulo)):
                if nombre.startswith("manejar_"):
                    funcion = getattr(modulo, nombre)
                    resultado["directas"].append({
                        "funcion": nombre,
                        "respuesta": funcion(pregunta),
                    })

            if llamar_modelo:
                try:
                    resultado["modelo"] = modulo.responder(pregunta)
                except Exception as e:  # key invalida, sin saldo, modelo inexistente...
                    resultado["error_modelo"] = f"{type(e).__name__}: {e}"
    except Exception as e:
        resultado["error"] = f"{type(e).__name__}: {e}"
    finally:
        for clave, valor in entorno_previo.items():
            if valor is None:
                os.environ.pop(clave, None)
            else:
                os.environ[clave] = valor

    return jsonify({
        "ok": True,
        "etapa": "ejecucion",
        "codigoGenerado": codigo_generado,
        "fases": resumen_fases(log, True),
        "resultado": resultado,
    })


# ---------------------------------------------------------------------------
# POST /api/modelos  { apiKey, proveedor }
# Consulta la lista de modelos del proveedor elegido. Ambos exponen el mismo
# formato (Gemini via su endpoint OpenAI-compatible).
# ---------------------------------------------------------------------------
EXCLUIR_OPENAI = re.compile(
    r"(audio|realtime|image|tts|transcribe|whisper|embed|moderation|dall|search|instruct|computer-use|codex)",
    re.IGNORECASE,
)
INCLUIR_OPENAI = re.compile(r"^(gpt-|o\d)")

EXCLUIR_GEMINI = re.compile(
    r"(embedding|imagen|veo|tts|audio|live|robotics|learnlm|aqa|vision|image)",
    re.IGNORECASE,
)


@app.route("/api/modelos", methods=["POST"])
def modelos():
    body = request.get_json(silent=True) or {}
    api_key = body.get("apiKey")
    proveedor = body.get("proveedor")
    if proveedor not in ("gemini", "openai"):
        proveedor = "gemini"
    if not isinstance(api_key, str) or not api_key.strip():
        return jsonify({"error": "Falta la API key"}), 400

    url = (
        "https://generativelanguage.googleapis.com/v1beta/openai/models"
        if proveedor == "gemini"
        else "https://api.openai.com/v1/models"
    )
    nombre_proveedor = "Gemini" if proveedor == "gemini" else "OpenAI"

    peticion = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {api_key.strip()}"},
    )
    try:
        with urllib.request.urlopen(peticion, timeout=15) as respuesta:
            data = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return jsonify({"error": f"API key inválida ({nombre_proveedor} respondió {e.code})"}), 401
        return jsonify({"error": f"{nombre_proveedor} respondió {e.code}"}), 502
    except Exception:
        return jsonify({"error": f"No se pudo contactar a {nombre_proveedor} (¿hay internet?)"}), 502

    ids = []
    for m in data.get("data", []):
        # Gemini regresa ids como "models/gemini-2.5-flash": se quita el prefijo.
        mid = m.get("id", "").removeprefix("models/")
        if proveedor == "gemini":
            if mid.startswith("gemini") and not EXCLUIR_GEMINI.search(mid):
                ids.append(mid)
        else:
            if INCLUIR_OPENAI.search(mid) and not EXCLUIR_OPENAI.search(mid):
                ids.append(mid)

    return jsonify({"modelos": sorted(set(ids))})
