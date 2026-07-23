# PANAI — Demo web

Página de demostración del traductor **PANAI** hecha con **Next.js**. No
reimplementa nada del traductor: cada petición ejecuta el pipeline real de la
carpeta `../files` (`traductor.py`, hecho con PLY) y muestra el resultado.

## Qué muestra

1. **Traducción fase por fase.** Editas un programa `.panai`, presionas
   *Traducir* y ves (a) el estado de las 4 fases —léxico, sintáctico,
   semántico, generación— y (b) el código Python generado o los errores, según
   sea el caso. Trae 7 programas de ejemplo precargados (3 correctos + 4 con
   error, uno por cada tipo de error).
2. **Ejecución del agente traducido.** Escribes una pregunta y ejecuta el
   código generado:
   - **Respuesta directa (sin IA):** ejecuta las funciones `manejar_*` (el
     `if/else` que se tradujo desde el `si/sino` del DSL). No necesita API key.
   - **Respuesta del modelo (opcional):** si activas la casilla y pegas tu API
     key de OpenAI, llama al modelo real. El desplegable *Cargar modelos*
     consulta a OpenAI qué modelos puede usar tu key.

## Requisitos

- **Node.js 18+** (para Next.js).
- **Python 3** con **PLY** (`pip install ply`) y, solo si vas a llamar al
  modelo real, **OpenAI** (`pip install openai`). El `python` debe estar en el
  PATH (o define la variable `PANAI_PYTHON` con la ruta al ejecutable).
- La carpeta `../files` con el traductor debe existir junto a esta (`demo-web`
  y `files` son hermanas).

## Cómo correr

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Sobre la API key (importante para la demo)

- La key **no se guarda en disco ni se registra en logs**. Viaja del navegador
  al server local de Next, que la pasa como variable de entorno
  (`OPENAI_API_KEY`) únicamente al proceso Python que ejecuta el código
  generado. En el navegador se conserva solo en `sessionStorage` (se borra al
  cerrar la pestaña) para que un refresh accidental no la pierda a mitad de la
  presentación.
- El modelo elegido se pasa por la variable `PANAI_MODELO`, que es la que lee
  el código generado por el traductor. Así se puede cambiar de modelo sin
  volver a traducir.
- Si vas a demostrar **sin internet**, deja la casilla apagada: la respuesta
  directa (`manejar_*`) funciona sin key ni red, y es la que mejor prueba la
  traducción DSL → Python.

## Estructura

```
demo-web/
├── app/
│   ├── page.tsx              # UI (editor, fases, ejecución)
│   └── api/
│       ├── traducir/route.ts # POST: corre el pipeline y regresa código/errores
│       ├── ejecutar/route.ts # POST: traduce + ejecuta el código generado
│       └── modelos/route.ts  # POST: lista modelos de OpenAI para una key
├── lib/
│   ├── panai.ts              # invoca Python, resume fases, extrae errores
│   └── ejemplos.ts           # los 7 programas .panai precargados
└── runner.py                 # ejecuta el .py generado y regresa JSON
```
