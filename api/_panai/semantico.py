# -*- coding: utf-8 -*-
"""
PANAI - Analizador semantico (Entrega final)
Unidad de Ensenanza: Traductores

Recibe el AST que construye parser.py y verifica reglas de SIGNIFICADO que
la gramatica (sintaxis) no puede prohibir por si sola. Esta es la diferencia
clave entre "esta bien escrito" (sintaxis) y "tiene sentido" (semantica).

Reglas semanticas verificadas:

1. 'objetivo' debe aparecer EXACTAMENTE una vez.
   (La gramatica permite 0 o varias; el dataclass AgentePANAI de la
   Entrega I exige un solo string, no una lista.)

2. 'personalidad' debe aparecer EXACTAMENTE una vez. (misma razon)

3. No puede haber herramientas repetidas dentro del mismo agente.

4. No puede haber dos bloques 'memoria' con el mismo nombre.

5. Dentro de un mismo bloque 'memoria', no puede haber dos campos con el
   mismo nombre (la gramatica lo permite; el dict final se quedaria con el
   ultimo valor silenciosamente, lo cual esconde un error del usuario).

6. El identificador que usa 'contiene(identificador, "...")' dentro de un
   evento debe ser el MISMO identificador que declara ese 'al_recibir'.
   Esto es una verificacion de AMBITO (scope): la condicion no puede
   referirse a una variable que no existe en ese evento.

7. No puede haber dos bloques 'al_recibir' con el mismo nombre de
   parametro. La gramatica lo permite, pero el generador crea una funcion
   Python 'manejar_<parametro>' por evento; dos eventos con el mismo
   nombre generarian funciones duplicadas donde la segunda sobreescribe
   silenciosamente a la primera.

Devuelve una lista de mensajes de error (strings). Lista vacia == sin
errores semanticos.
"""


def analizar_semantica(ast):
    errores = []

    errores += _validar_propiedad_unica(ast, 'objetivo')
    errores += _validar_propiedad_unica(ast, 'personalidad')
    errores += _validar_herramientas_duplicadas(ast)
    errores += _validar_memorias(ast)
    errores += _validar_eventos_duplicados(ast)
    errores += _validar_ambito_eventos(ast)

    return errores


def _validar_propiedad_unica(ast, clave):
    """Regla 1 y 2: objetivo/personalidad deben aparecer exactamente una vez."""
    valores = ast[clave]
    errores = []
    if len(valores) == 0:
        errores.append(
            f"Falta declarar '{clave}:' en el agente '{ast['nombre']}'."
        )
    elif len(valores) > 1:
        errores.append(
            f"'{clave}:' se declaro {len(valores)} veces en el agente "
            f"'{ast['nombre']}', pero debe declararse una sola vez."
        )
    return errores


def _validar_herramientas_duplicadas(ast):
    """Regla 3: no pueden repetirse nombres de herramienta."""
    errores = []
    vistas = set()
    for h in ast['herramientas']:
        if h in vistas:
            errores.append(f"La herramienta '{h}' esta declarada mas de una vez.")
        vistas.add(h)
    return errores


def _validar_memorias(ast):
    """Reglas 4 y 5: nombres de bloque de memoria y de campos, sin repetir."""
    errores = []
    nombres_bloques = set()

    for memoria in ast['memorias']:
        nombre_bloque = memoria['nombre']
        if nombre_bloque in nombres_bloques:
            errores.append(
                f"Ya existe un bloque 'memoria {nombre_bloque}'; "
                f"los nombres de bloque deben ser unicos."
            )
        nombres_bloques.add(nombre_bloque)

        vistos_campos = set()
        for nombre_campo, _valor in memoria['campos_lista']:
            if nombre_campo in vistos_campos:
                errores.append(
                    f"En 'memoria {nombre_bloque}', el campo '{nombre_campo}' "
                    f"esta declarado mas de una vez."
                )
            vistos_campos.add(nombre_campo)

    return errores


def _validar_eventos_duplicados(ast):
    """Regla 7 (NUEVA): no puede haber dos bloques 'al_recibir' con el mismo
    nombre de parametro. La gramatica lo permite, pero el generador de
    codigo crea una funcion 'manejar_<parametro>' por evento; si dos
    eventos comparten nombre, la segunda funcion sobreescribe a la primera
    en Python de forma silenciosa y el primer evento se vuelve inalcanzable."""
    errores = []
    vistos = set()
    for evento in ast['eventos']:
        nombre = evento['nombre']
        if nombre in vistos:
            errores.append(
                f"Ya existe un bloque 'al_recibir {nombre}' (linea "
                f"{evento['linea']}); dos eventos con el mismo nombre "
                f"generarian funciones Python duplicadas y el primero "
                f"quedaria inalcanzable."
            )
        vistos.add(nombre)
    return errores


def _validar_ambito_eventos(ast):
    """Regla 6: el identificador de contiene(...) debe ser el parametro
    declarado por 'al_recibir'."""
    errores = []
    for evento in ast['eventos']:
        parametro = evento['nombre']
        condicion = evento['condicional']['condicion']
        identificador_usado = condicion['identificador']
        if identificador_usado != parametro:
            errores.append(
                f"En 'al_recibir {parametro}' (linea {evento['linea']}), "
                f"la condicion usa 'contiene({identificador_usado}, ...)' "
                f"pero el evento solo declara el parametro '{parametro}'. "
                f"'{identificador_usado}' no existe en este ambito."
            )
    return errores


# ---------------------------------------------------------------------------
# Ejecucion independiente: analizar un archivo y mostrar solo los errores
# semanticos (util para probar este modulo por separado)
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys
    from lexer import lexer
    from analizador_sintactico import parser

    ruta = sys.argv[1] if len(sys.argv) > 1 else 'tutor.panai'
    with open(ruta, encoding='utf-8') as archivo:
        datos = archivo.read()

    ast = parser.parse(datos, lexer=lexer)

    if ast is None:
        print("No se puede analizar la semantica: hubo errores lexicos/sintacticos.")
        sys.exit(1)

    print("\n--- Analisis semantico ---")
    errores = analizar_semantica(ast)
    if not errores:
        print("[OK] Sin errores semanticos.")
    else:
        for e in errores:
            print(f"[SEMANTICO] {e}")