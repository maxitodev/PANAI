# -*- coding: utf-8 -*-
"""
PANAI - Generador de codigo Python (Entrega final)
Unidad de Ensenanza: Traductores

Tecnica de traduccion: GENERACION DE CODIGO (no interpretacion ni
visualizacion). A partir del AST ya validado semanticamente, se arma un
string con codigo Python ejecutable, siguiendo el mismo formato que se
propuso como salida esperada en la Entrega I: un @dataclass AgentePANAI,
las funciones para construir las instrucciones del modelo, y la llamada
al modelo de OpenAI.

Ademas -y esto es nuevo respecto a la Entrega I- se traduce directamente
cada bloque 'al_recibir ... si/sino ... fin' del AST a una funcion Python
con un if/else real. Esto es la generacion de codigo mas literal: el
condicional del DSL se convierte en un condicional de Python, y
'contiene(x, "texto")' se convierte en el operador 'in' de Python.

    from generador import generar_codigo
    codigo_python = generar_codigo(ast)
"""


def generar_codigo(ast):
    """Punto de entrada: recibe el AST (ya validado por semantico.py) y
    regresa un string con el codigo Python generado."""
    partes = [
        _generar_encabezado(),
        _generar_dataclass(),
        _generar_instancia(ast),
        _generar_funciones_instrucciones(),
        _generar_manejadores_eventos(ast),
        _generar_funcion_responder(ast),
        _generar_main(ast),
    ]
    return "\n\n".join(partes)


# ---------------------------------------------------------------------------
# Encabezado: imports y cliente de OpenAI
# ---------------------------------------------------------------------------
def _generar_encabezado():
    # El proveedor (gemini u openai) y el modelo se eligen por variables de
    # entorno, sin re-traducir el programa (la pagina de demostracion usa
    # esto). Gemini expone un endpoint compatible con el SDK de OpenAI, asi
    # que el codigo generado usa UN solo SDK para ambos proveedores. El
    # cliente NO se crea a nivel de modulo: si no hay API key definida,
    # OpenAI() lanza un error al importar y eso impediria usar las funciones
    # manejar_* (que son traduccion pura del DSL y no necesitan ninguna key).
    # Por eso el cliente se crea dentro de responder(), que es la unica
    # funcion que realmente llama al modelo.
    return (
        "# Codigo generado automaticamente por el traductor PANAI.\n"
        "# No editar a mano: los cambios se deben hacer en el archivo .panai\n"
        "# y volver a ejecutar el traductor.\n\n"
        "import os\n"
        "from dataclasses import dataclass\n"
        "from openai import OpenAI\n\n\n"
        '# "gemini" (por defecto, tiene tier gratuito) u "openai"\n'
        'PROVEEDOR = os.environ.get("PANAI_PROVEEDOR", "gemini")\n'
        'MODELO = os.environ.get("PANAI_MODELO") or (\n'
        '    "gemini-2.5-flash" if PROVEEDOR == "gemini" else "gpt-4o-mini"\n'
        ")"
    )


# ---------------------------------------------------------------------------
# @dataclass AgentePANAI (identica para cualquier agente)
# ---------------------------------------------------------------------------
def _generar_dataclass():
    return (
        "@dataclass\n"
        "class AgentePANAI:\n"
        "    nombre: str\n"
        "    objetivo: str\n"
        "    personalidad: str\n"
        "    herramientas: list[str]\n"
        "    reglas: list[str]\n"
        "    memoria: dict"
    )


# ---------------------------------------------------------------------------
# Instancia del agente concreto que describe el programa .panai
# ---------------------------------------------------------------------------
def _generar_instancia(ast):
    nombre = ast['nombre']
    objetivo = ast['objetivo'][0]
    personalidad = ast['personalidad'][0]
    herramientas = ast['herramientas']
    reglas = ast['reglas']
    memoria_dict = _armar_memoria(ast['memorias'])

    variable = _a_mayus_snake(nombre)

    herramientas_str = _lista_python(herramientas)
    reglas_str = _lista_python(reglas)
    memoria_str = _dict_python(memoria_dict, sangria=8)

    return (
        f"{variable} = AgentePANAI(\n"
        f'    nombre="{nombre}",\n'
        f'    objetivo="{objetivo}",\n'
        f'    personalidad="{personalidad}",\n'
        f"    herramientas={herramientas_str},\n"
        f"    reglas={reglas_str},\n"
        f"    memoria={memoria_str},\n"
        f")"
    )


def _armar_memoria(memorias):
    """Si el agente declaro un solo bloque 'memoria', se aplana (queda
    igual que el ejemplo de la Entrega I: memoria={"nombre": ..., ...}).
    Si declaro varios, se anida por nombre de bloque para no perder cual
    campo pertenece a cual memoria."""
    if len(memorias) == 0:
        return {}
    if len(memorias) == 1:
        return memorias[0]['campos']
    return {m['nombre']: m['campos'] for m in memorias}


# ---------------------------------------------------------------------------
# Funciones de instrucciones para el modelo (no dependen del agente)
# ---------------------------------------------------------------------------
def _generar_funciones_instrucciones():
    return (
        "def construir_instrucciones(agente):\n"
        '    reglas = "\\n".join(f"- {regla}" for regla in agente.reglas)\n'
        '    memoria = "\\n".join(\n'
        '        f"{clave}: {valor}"\n'
        "        for clave, valor in agente.memoria.items()\n"
        "    )\n\n"
        '    return f"""\n'
        "Eres {agente.nombre}.\n"
        "Objetivo: {agente.objetivo}.\n"
        "Personalidad: {agente.personalidad}.\n\n"
        "Herramientas disponibles:\n"
        '{", ".join(agente.herramientas)}\n\n'
        "Reglas obligatorias:\n"
        "{reglas}\n\n"
        "Memoria:\n"
        "{memoria}\n\n"
        "Responde siempre en espanol claro.\n"
        "Si falta contexto, pide una aclaracion breve.\n"
        '"""\n\n\n'
        "def construir_entrada_modelo(pregunta):\n"
        '    return f"""\n'
        "Pregunta del usuario:\n"
        "{pregunta}\n\n"
        "Contesta con una explicacion breve, ordenada y util.\n"
        '"""'
    )


# ---------------------------------------------------------------------------
# Manejadores de evento: traduccion DIRECTA de 'al_recibir ... si/sino ...'
# a una funcion Python con if/else real. Esta es la parte que muestra de
# forma mas literal como el AST se convierte en codigo ejecutable.
# ---------------------------------------------------------------------------
def _generar_manejadores_eventos(ast):
    funciones = []
    for evento in ast['eventos']:
        funciones.append(_generar_un_manejador(evento))
    if not funciones:
        return "# Este agente no declaro ningun bloque 'al_recibir'."
    return "\n\n\n".join(funciones)


def _generar_un_manejador(evento):
    parametro = evento['nombre']
    condicional = evento['condicional']
    condicion = condicional['condicion']
    texto_buscado = condicion['cadena']
    accion_si = condicional['accion_si']
    accion_sino = condicional['accion_sino']
    nombre_funcion = f"manejar_{parametro}"

    return (
        f"def {nombre_funcion}({parametro}):\n"
        f'    """Traduccion directa de: al_recibir {parametro} '
        f'{{ si contiene({parametro}, \\"{texto_buscado}\\") ... }}"""\n'
        f'    if "{texto_buscado}" in {parametro}:\n'
        f'        return "{accion_si}"\n'
        f"    else:\n"
        f'        return "{accion_sino}"'
    )


# ---------------------------------------------------------------------------
# Funcion que realmente llama al modelo (usa las instrucciones del agente)
# ---------------------------------------------------------------------------
def _generar_funcion_responder(ast):
    # Se usa la API chat.completions (y no responses) porque es la que el
    # endpoint OpenAI-compatible de Gemini tambien implementa: el mismo
    # codigo generado funciona con ambos proveedores cambiando solo las
    # variables de entorno.
    variable = _a_mayus_snake(ast['nombre'])
    return (
        "def responder(pregunta):\n"
        '    if PROVEEDOR == "gemini":\n'
        "        client = OpenAI(  # endpoint OpenAI-compatible de Gemini\n"
        '            api_key=os.environ.get("GEMINI_API_KEY", ""),\n'
        '            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",\n'
        "        )\n"
        "    else:\n"
        "        client = OpenAI()  # lee OPENAI_API_KEY del entorno\n"
        "    respuesta = client.chat.completions.create(\n"
        "        model=MODELO,\n"
        "        messages=[\n"
        f'            {{"role": "system", "content": construir_instrucciones({variable})}},\n'
        '            {"role": "user", "content": construir_entrada_modelo(pregunta)},\n'
        "        ],\n"
        "    )\n"
        "    return respuesta.choices[0].message.content"
    )


# ---------------------------------------------------------------------------
# Bloque main de ejemplo, usando el primer evento declarado (si existe)
# ---------------------------------------------------------------------------
def _generar_main(ast):
    if not ast['eventos']:
        return (
            'if __name__ == "__main__":\n'
            '    pregunta = "Escribe aqui una pregunta de prueba"\n'
            "    print(responder(pregunta))"
        )

    primer_evento = ast['eventos'][0]
    parametro = primer_evento['nombre']
    nombre_funcion = f"manejar_{parametro}"

    return (
        'if __name__ == "__main__":\n'
        f'    {parametro} = "Tengo examen de calculo, como puedo estudiar?"\n\n'
        f'    print("Respuesta directa (regla del DSL):")\n'
        f"    print({nombre_funcion}({parametro}))\n\n"
        f'    print("\\nRespuesta del modelo:")\n'
        f"    print(responder({parametro}))"
    )


# ---------------------------------------------------------------------------
# Utilerias de formato
# ---------------------------------------------------------------------------
def _a_mayus_snake(nombre):
    """TutorAcademico -> TUTOR_ACADEMICO (para nombrar la instancia)."""
    salida = []
    for i, letra in enumerate(nombre):
        if letra.isupper() and i > 0:
            salida.append('_')
        salida.append(letra.upper())
    return ''.join(salida)


def _lista_python(elementos):
    if not elementos:
        return "[]"
    items = ",\n        ".join(f'"{e}"' for e in elementos)
    return f"[\n        {items},\n    ]"


def _dict_python(diccionario, sangria=4):
    if not diccionario:
        return "{}"
    espacio = " " * sangria
    lineas = []
    for clave, valor in diccionario.items():
        if isinstance(valor, dict):
            lineas.append(f'{espacio}"{clave}": {_dict_python(valor, sangria + 4)},')
        else:
            lineas.append(f'{espacio}"{clave}": "{valor}",')
    cuerpo = "\n".join(lineas)
    cierre = " " * (sangria - 4)
    return "{\n" + cuerpo + "\n" + cierre + "}"


# ---------------------------------------------------------------------------
# Ejecucion independiente
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys
    from lexer import lexer
    from analizador_sintactico import parser
    from semantico import analizar_semantica

    ruta = sys.argv[1] if len(sys.argv) > 1 else 'tutor.panai'
    with open(ruta, encoding='utf-8') as archivo:
        datos = archivo.read()

    ast = parser.parse(datos, lexer=lexer)
    if ast is None:
        print("No se puede generar codigo: hubo errores lexicos/sintacticos.")
        sys.exit(1)

    errores = analizar_semantica(ast)
    if errores:
        print("No se puede generar codigo: hay errores semanticos.")
        for e in errores:
            print(f"  - {e}")
        sys.exit(1)

    print(generar_codigo(ast))
