# -*- coding: utf-8 -*-
"""
PANAI - Analizador lexico (Parte II)
Unidad de Ensenanza: Traductores

Reconoce los tokens del lenguaje PANAI descritos en el documento de alcance.
En esta fase NO se traduce nada: el lexer solo convierte el texto fuente en
una secuencia de tokens. Se puede ejecutar de forma independiente para
imprimir la lista de tokens de un programa:

    python lexer.py tutor.panai
"""

import ply.lex as lex

# ---------------------------------------------------------------------------
# 1. Palabras reservadas
# ---------------------------------------------------------------------------
# No se le asigna una expresion regular propia a cada palabra reservada.
# El lexer captura cualquier lexema con la regla de IDENTIFICADOR y luego
# consulta esta tabla para decidir si es una palabra reservada o un
# identificador. Este es el patron estandar en Lex/PLY y resuelve de forma
# determinista la ambiguedad entre ambos.
reservadas = {
    'agente':       'AGENTE',
    'objetivo':     'OBJETIVO',
    'personalidad': 'PERSONALIDAD',
    'herramienta':  'HERRAMIENTA',
    'regla':        'REGLA',
    'memoria':      'MEMORIA',
    'al_recibir':   'AL_RECIBIR',
    'si':           'SI',
    'entonces':     'ENTONCES',
    'sino':         'SINO',
    'fin':          'FIN',
    'responder':    'RESPONDER',
    'contiene':     'CONTIENE',
}

# ---------------------------------------------------------------------------
# 2. Lista de tokens
# ---------------------------------------------------------------------------
tokens = [
    'IDENTIFICADOR',   # nombres: TutorAcademico, buscar_web, pregunta, ...
    'CADENA',          # "texto entre comillas dobles"
    'LLAVE_IZQ',       # {
    'LLAVE_DER',       # }
    'PAR_IZQ',         # (
    'PAR_DER',         # )
    'DOSPUNTOS',       # :
    'PUNTOYCOMA',      # ;
    'COMA',            # ,
] + list(reservadas.values())

# ---------------------------------------------------------------------------
# 3. Reglas simples (tokens de un solo simbolo)
# ---------------------------------------------------------------------------
t_LLAVE_IZQ  = r'\{'
t_LLAVE_DER  = r'\}'
t_PAR_IZQ    = r'\('
t_PAR_DER    = r'\)'
t_DOSPUNTOS  = r':'
t_PUNTOYCOMA = r';'
t_COMA       = r','

# Caracteres que se ignoran entre tokens (espacios, tabuladores, retorno).
t_ignore = ' \t\r'


# ---------------------------------------------------------------------------
# 4. Reglas con logica (funciones)
# ---------------------------------------------------------------------------
def t_CADENA(t):
    r'"[^"]*"'
    # Se guardan las comillas fuera del valor para una impresion mas limpia.
    t.value = t.value[1:-1]
    return t


def t_IDENTIFICADOR(t):
    r'[a-zA-Z_][a-zA-Z0-9_]*'
    # Si el lexema esta en la tabla, es palabra reservada; si no, identificador.
    t.type = reservadas.get(t.value, 'IDENTIFICADOR')
    return t


def t_comentario(t):
    r'//[^\n]*'
    pass  # los comentarios de linea se descartan


def t_nuevalinea(t):
    r'\n+'
    t.lexer.lineno += len(t.value)


def t_error(t):
    global _errores_lexicos
    mensaje = f"[LEXICO] Caracter ilegal '{t.value[0]}' en la linea {t.lineno}"
    print(mensaje)
    _errores_lexicos.append(mensaje)
    t.lexer.skip(1)


# ---------------------------------------------------------------------------
# 5. Construccion del lexer
# ---------------------------------------------------------------------------
lexer = lex.lex()

# AGREGADO (Entrega final): registro de errores lexicos y utilidades para
# que el traductor (traductor.py) sepa si debe detener el pipeline y para
# poder analizar varios archivos .panai en la misma ejecucion sin arrastrar
# el numero de linea ni los errores del archivo anterior.
_errores_lexicos = []


def hubo_error_lexico():
    """True si el ultimo analisis encontro al menos un caracter ilegal."""
    return len(_errores_lexicos) > 0


def reiniciar_lexer():
    """Limpia errores acumulados y reinicia el numero de linea a 1. Se debe
    llamar antes de analizar un nuevo archivo con el mismo objeto lexer."""
    global _errores_lexicos
    _errores_lexicos = []
    lexer.lineno = 1


# ---------------------------------------------------------------------------
# 6. Ejecucion independiente: volcado de tokens
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys

    ruta = sys.argv[1] if len(sys.argv) > 1 else 'tutor.panai'
    with open(ruta, encoding='utf-8') as archivo:
        datos = archivo.read()

    lexer.input(datos)

    print(f"{'LINEA':<6}{'TOKEN':<16}LEXEMA")
    print("-" * 46)
    total = 0
    for tok in lexer:
        print(f"{tok.lineno:<6}{tok.type:<16}{tok.value}")
        total += 1
    print("-" * 46)
    print(f"Total de tokens reconocidos: {total}")
