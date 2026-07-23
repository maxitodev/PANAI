# PANAI — Demo web

Página de demostración del traductor **PANAI** hecha con **Next.js** (frontend)
y una **función Python con Flask** (backend). El backend importa el traductor
real (lexer, parser, semántico, generador) y corre el pipeline en el mismo
proceso — no reimplementa nada. Sigue el patrón oficial de Vercel para
Next.js + Python, así que se puede desplegar a Vercel tal cual.

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
   - **Respuesta del modelo (opcional):** menú desplegable de modelos + campo
     para tu API key de OpenAI. *Cargar modelos* consulta a OpenAI qué modelos
     puede usar tu key.

## Requisitos (local)

- **Node.js 18+**
- **Python 3** con `pip install flask ply openai` (o `pip install -r requirements.txt`)

## Cómo correr en local

```bash
npm install
npm run dev
```

`npm run dev` arranca **dos** procesos con `concurrently`: Next.js (puerto
3000) y Flask (puerto 5328). En desarrollo, Next redirige `/api/*` a Flask
(ver `next.config.ts`). Abre http://localhost:3000.

## Cómo subir a Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com) (con GitHub es lo más fácil).
2. **Opción A — con GitHub:** sube la carpeta `demo-web` como repositorio y en
   Vercel haz *Import Project*. Vercel detecta Next.js y las funciones Python
   automáticamente. No hay nada que configurar.
3. **Opción B — sin GitHub (CLI):**
   ```bash
   npm i -g vercel
   cd demo-web
   vercel
   ```
   Sigue las preguntas (todas con Enter) y al final te da la URL pública.

Notas del despliegue:

- `requirements.txt` le dice a Vercel qué paquetes de Python instalar.
- `vercel.json` sube el límite de tiempo de la función a 60 s (las llamadas al
  modelo pueden tardar).
- `api/_panai/` es una **copia** del traductor de `../files` (el guion bajo
  evita que Vercel exponga esos archivos como endpoints). El único cambio es
  `yacc.yacc(write_tables=False, debug=False)`, porque el sistema de archivos
  de Vercel es de solo lectura. **La fuente de verdad sigue siendo `files/`**:
  si cambias el traductor, vuelve a copiar los archivos.

## Sobre la API key

- La key **no se guarda en disco ni se registra en logs**. Viaja del navegador
  al backend, que la usa como variable de entorno solo durante esa petición y
  restaura el entorno al terminar. En el navegador vive en `sessionStorage`
  (se borra al cerrar la pestaña).
- El modelo se elige en un menú desplegable y se pasa por la variable
  `PANAI_MODELO`, que lee el código generado — se puede cambiar de modelo sin
  re-traducir.
- Para demostrar **sin internet**: deja la casilla del modelo apagada; la
  respuesta directa (`manejar_*`) funciona sin key ni red.

## Estructura

```
demo-web/
├── app/
│   └── page.tsx              # UI completa (editor, fases, ejecución, landing)
├── api/
│   ├── index.py              # Backend Flask: /api/traducir, /api/ejecutar, /api/modelos
│   └── _panai/               # Copia del traductor real (para el despliegue)
├── lib/ejemplos.ts           # Los 7 programas .panai precargados
├── public/                   # Logos (PANAI y UAM)
├── requirements.txt          # Dependencias Python para Vercel
├── vercel.json               # maxDuration de la función Python
└── next.config.ts            # Rewrites /api/* → Flask (dev) / función (prod)
```
