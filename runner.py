# -*- coding: utf-8 -*-
"""
PANAI - Runner de la pagina de demostracion.

Ejecuta el codigo Python que genero el traductor (el archivo salida.py de un
programa .panai ya traducido) y regresa las respuestas en JSON por stdout,
para que el API route de Next.js las muestre en la pagina.

Uso:
    python runner.py <archivo_generado.py> <pregunta> [--modelo]

- Siempre ejecuta todas las funciones manejar_* (traduccion pura del DSL,
  no necesitan API key).
- Con --modelo ademas llama a responder(), que usa el modelo real de OpenAI
  (requiere OPENAI_API_KEY en el entorno; el modelo se elige con la variable
  PANAI_MODELO, que lee el codigo generado).
"""

import importlib.util
import json
import sys


def main():
    resultado = {
        'directas': [],       # [{funcion, respuesta}] de cada manejar_*
        'modelo': None,       # respuesta del modelo real (si se pidio)
        'error_modelo': None, # mensaje si la llamada al modelo fallo
        'error': None,        # error fatal (no se pudo cargar el modulo)
    }

    try:
        ruta = sys.argv[1]
        pregunta = sys.argv[2]
        llamar_modelo = '--modelo' in sys.argv[3:]

        spec = importlib.util.spec_from_file_location('agente_generado', ruta)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)

        # Todas las funciones manejar_<parametro> del codigo generado
        # (una por cada bloque 'al_recibir' del programa fuente).
        for nombre in sorted(dir(modulo)):
            if nombre.startswith('manejar_'):
                funcion = getattr(modulo, nombre)
                resultado['directas'].append({
                    'funcion': nombre,
                    'respuesta': funcion(pregunta),
                })

        if llamar_modelo:
            try:
                resultado['modelo'] = modulo.responder(pregunta)
            except Exception as e:  # key invalida, sin saldo, modelo inexistente...
                resultado['error_modelo'] = f"{type(e).__name__}: {e}"

    except Exception as e:
        resultado['error'] = f"{type(e).__name__}: {e}"

    print(json.dumps(resultado, ensure_ascii=False))


if __name__ == '__main__':
    main()
