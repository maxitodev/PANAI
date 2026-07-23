# -*- coding: utf-8 -*-
"""
PANAI - Analizador sintactico + construccion de AST (Entrega final)
Unidad de Ensenanza: Traductores

A diferencia de la Parte II (donde el parser solo imprimia un mensaje al
reconocer cada construccion), aqui cada regla ademas ARMA una estructura de
datos (el AST) en p[0]. Ese AST es lo que despues recorre el analizador
semantico (semantico.py) y el generador de codigo (generador.py).

    python parser.py tutor.panai

Gramatica (pseudo-BNF), sin cambios respecto a la Parte II:

    programa    -> agente
    agente      -> 'agente' IDENT '{' cuerpo '}'
    cuerpo      -> cuerpo decl | decl
    decl        -> propiedad | herramienta | regla | memoria | evento
    propiedad   -> ('objetivo' | 'personalidad') ':' CADENA ';'
    herramienta -> 'herramienta' ':' IDENT ';'
    regla       -> 'regla' ':' CADENA ';'
    memoria     -> 'memoria' IDENT '{' campos '}'
    campos      -> campos campo | campo
    campo       -> IDENT ':' CADENA ';'
    evento      -> 'al_recibir' IDENT '{' condicional '}'
    condicional -> 'si' condicion 'entonces' accion 'sino' accion 'fin'
    condicion   -> 'contiene' '(' IDENT ',' CADENA ')'
    accion      -> 'responder' CADENA ';'
"""

import ply.yacc as yacc

from lexer import tokens, lexer

start = 'programa'


# ---------------------------------------------------------------------------
# Regla inicial
# ---------------------------------------------------------------------------
def p_programa(p):
    'programa : agente'
    print("[OK] Programa PANAI valido.")
    p[0] = p[1]  # AGREGADO: el AST del programa es el AST del agente


# ---------------------------------------------------------------------------
# Agente (contenedor principal)
# ---------------------------------------------------------------------------
def p_agente(p):
    'agente : AGENTE IDENTIFICADOR LLAVE_IZQ cuerpo LLAVE_DER'
    print(f"[OK] Agente reconocido: {p[2]}")

    # AGREGADO: 'cuerpo' llega como una lista de tuplas (tipo, valor).
    # Aqui se separan por tipo para armar el nodo 'agente' del AST.
    # objetivo y personalidad se guardan como LISTA (no como valor unico)
    # a proposito: si el programa fuente los repite, la lista tendra mas
    # de un elemento y sera el analizador semantico quien lo reporte como
    # error (la gramatica no lo prohibe, pero el dataclass AgentePANAI de
    # la Entrega I si exige que sean unicos).
    declaraciones = p[4]

    p[0] = {
        'tipo': 'agente',
        'nombre': p[2],
        'linea': p.lineno(2),
        'objetivo': [v for t, v in declaraciones if t == 'objetivo'],
        'personalidad': [v for t, v in declaraciones if t == 'personalidad'],
        'herramientas': [v for t, v in declaraciones if t == 'herramienta'],
        'reglas': [v for t, v in declaraciones if t == 'regla'],
        'memorias': [v for t, v in declaraciones if t == 'memoria'],
        'eventos': [v for t, v in declaraciones if t == 'evento'],
    }


# ---------------------------------------------------------------------------
# Cuerpo del agente: una o mas declaraciones (recursion por la izquierda)
# ---------------------------------------------------------------------------
def p_cuerpo_multiple(p):
    'cuerpo : cuerpo decl'
    p[0] = p[1] + [p[2]]  # AGREGADO: acumula la lista de declaraciones


def p_cuerpo_simple(p):
    'cuerpo : decl'
    p[0] = [p[1]]  # AGREGADO: primera declaracion de la lista


def p_decl(p):
    '''decl : propiedad
            | herramienta
            | regla
            | memoria
            | evento'''
    p[0] = p[1]  # AGREGADO: decl es transparente, solo pasa el nodo hacia arriba


# ---------------------------------------------------------------------------
# Configuracion declarativa
# ---------------------------------------------------------------------------
def p_propiedad(p):
    '''propiedad : OBJETIVO DOSPUNTOS CADENA PUNTOYCOMA
                 | PERSONALIDAD DOSPUNTOS CADENA PUNTOYCOMA'''
    print(f"[OK] Propiedad reconocida: {p[1]}")
    p[0] = (p[1], p[3])  # AGREGADO: tupla (tipo, valor) -> 'objetivo' o 'personalidad'


def p_herramienta(p):
    'herramienta : HERRAMIENTA DOSPUNTOS IDENTIFICADOR PUNTOYCOMA'
    print(f"[OK] Herramienta reconocida: {p[3]}")
    p[0] = ('herramienta', p[3])  # AGREGADO


def p_regla(p):
    'regla : REGLA DOSPUNTOS CADENA PUNTOYCOMA'
    print(f"[OK] Regla reconocida.")
    p[0] = ('regla', p[3])  # AGREGADO


# ---------------------------------------------------------------------------
# Memoria estructurada
# ---------------------------------------------------------------------------
def p_memoria(p):
    'memoria : MEMORIA IDENTIFICADOR LLAVE_IZQ campos LLAVE_DER'
    print(f"[OK] Bloque de memoria reconocido: {p[2]}")
    # AGREGADO: 'campos' llega como lista de tuplas (nombre, valor);
    # se convierte a dict para el AST. Si hay nombres repetidos, el dict
    # se queda con el ultimo valor (Python lo hace por defecto) -- por eso
    # el analizador semantico revisa aparte si hubo nombres duplicados,
    # usando la lista de tuplas cruda antes de perder esa informacion.
    campos_lista = p[4]
    campos_dict = dict(campos_lista)
    p[0] = ('memoria', {
        'nombre': p[2],
        'linea': p.lineno(2),
        'campos': campos_dict,
        'campos_lista': campos_lista,  # cruda, para detectar duplicados
    })


def p_campos_multiple(p):
    'campos : campos campo'
    p[0] = p[1] + [p[2]]  # AGREGADO


def p_campos_simple(p):
    'campos : campo'
    p[0] = [p[1]]  # AGREGADO


def p_campo(p):
    'campo : IDENTIFICADOR DOSPUNTOS CADENA PUNTOYCOMA'
    print(f"[OK]   Campo de memoria reconocido: {p[1]}")
    p[0] = (p[1], p[3])  # AGREGADO: (nombre_campo, valor)


# ---------------------------------------------------------------------------
# Comportamiento ante eventos
# ---------------------------------------------------------------------------
def p_evento(p):
    'evento : AL_RECIBIR IDENTIFICADOR LLAVE_IZQ condicional LLAVE_DER'
    print(f"[OK] Evento reconocido: al_recibir {p[2]}")
    # AGREGADO
    p[0] = ('evento', {
        'nombre': p[2],
        'linea': p.lineno(2),
        'condicional': p[4],
    })


def p_condicional(p):
    'condicional : SI condicion ENTONCES accion SINO accion FIN'
    print("[OK] Condicional si/sino reconocido.")
    # AGREGADO
    p[0] = {
        'condicion': p[2],
        'accion_si': p[4],
        'accion_sino': p[6],
    }


def p_condicion(p):
    'condicion : CONTIENE PAR_IZQ IDENTIFICADOR COMA CADENA PAR_DER'
    print(f"[OK]   Condicion reconocida: contiene({p[3]}, ...)")
    # AGREGADO
    p[0] = {
        'identificador': p[3],
        'cadena': p[5],
        'linea': p.lineno(3),
    }


def p_accion(p):
    'accion : RESPONDER CADENA PUNTOYCOMA'
    print("[OK]   Accion reconocida: responder.")
    p[0] = p[2]  # AGREGADO: el texto de la respuesta


# ---------------------------------------------------------------------------
# Manejo de errores sintacticos
# ---------------------------------------------------------------------------
def p_error(p):
    if p:
        print(f"[SINTACTICO] Error cerca de '{p.value}' "
              f"(token {p.type}) en la linea {p.lineno}")
    else:
        print("[SINTACTICO] Error: fin de archivo inesperado.")


# ---------------------------------------------------------------------------
# Construccion del parser
# NOTA (solo en esta copia para el despliegue): write_tables=False y
# debug=False evitan que PLY intente escribir parsetab.py / parser.out,
# porque el sistema de archivos de Vercel es de solo lectura. La gramatica
# es pequena, asi que regenerar las tablas LALR en cada arranque es gratis.
# ---------------------------------------------------------------------------
parser = yacc.yacc(write_tables=False, debug=False)


# ---------------------------------------------------------------------------
# Ejecucion
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys
    from pprint import pprint

    ruta = sys.argv[1] if len(sys.argv) > 1 else 'tutor.panai'
    with open(ruta, encoding='utf-8') as archivo:
        datos = archivo.read()

    print(f"Analizando: {ruta}")
    print("=" * 50)
    ast = parser.parse(datos, lexer=lexer)
    print("=" * 50)

    if ast is not None:
        print("\nAST generado:\n")
        pprint(ast)
    else:
        print("\nNo se genero AST (hubo un error).")

    print("\nAnalisis terminado.")