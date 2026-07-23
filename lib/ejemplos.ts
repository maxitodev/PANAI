// Programas de ejemplo precargados en la demo. Son copias 1:1 de los
// archivos .panai de la carpeta files/ de la entrega.

export interface Ejemplo {
  id: string;
  nombre: string;
  descripcion: string;
  esError: boolean;
  codigo: string;
}

export const EJEMPLOS: Ejemplo[] = [
  {
    id: "tutor",
    nombre: "Tutor académico",
    descripcion: "Programa completo y correcto (el caso estrella de la demo)",
    esError: false,
    codigo: `// Programa de muestra en PANAI: un tutor academico.
agente TutorAcademico {
  objetivo: "Ayudar a estudiantes a comprender temas escolares";

  personalidad: "Paciente, claro y explicativo";

  herramienta: buscar_web;
  herramienta: resumir_texto;
  herramienta: generar_ejemplo;

  regla: "Explicar paso a paso";
  regla: "No inventar informacion";
  regla: "Pedir contexto si la pregunta es ambigua";

  memoria estudiante {
    nombre: "Max";
    area: "Ingenieria en Computacion";
    nivel: "Universidad";
  }

  al_recibir pregunta {
    si contiene(pregunta, "examen") entonces
      responder "Repasemos conceptos y despues ejercicios.";
    sino
      responder "Voy a explicarte el tema paso a paso.";
    fin
  }
}
`,
  },
  {
    id: "minimo",
    nombre: "Agente mínimo",
    descripcion: "El programa válido más pequeño posible",
    esError: false,
    codigo: `agente Minimo {
  objetivo: "Solo probar el minimo valido";
  personalidad: "Neutral";
}
`,
  },
  {
    id: "multi",
    nombre: "Multi memoria / eventos",
    descripcion: "2 bloques de memoria y 2 al_recibir (memoria anidada)",
    esError: false,
    codigo: `agente Asistente {
  objetivo: "Ayudar con tareas de oficina";
  personalidad: "Eficiente y directo";

  herramienta: enviar_correo;
  herramienta: agendar_reunion;

  regla: "Confirmar antes de enviar";

  memoria usuario {
    nombre: "Ana";
    puesto: "Gerente";
  }

  memoria empresa {
    nombre_empresa: "Acme";
    sector: "Retail";
  }

  al_recibir mensaje {
    si contiene(mensaje, "reunion") entonces
      responder "Voy a agendar la reunion.";
    sino
      responder "Dime mas detalles.";
    fin
  }

  al_recibir correo {
    si contiene(correo, "urgente") entonces
      responder "Lo envio de inmediato.";
    sino
      responder "Lo programo para mas tarde.";
    fin
  }
}
`,
  },
  {
    id: "err-lexico",
    nombre: "Error léxico",
    descripcion: "Carácter ilegal '@' — lo detecta la fase 1",
    esError: true,
    codigo: `agente Test {
  objetivo: "Ayudar";
  personalidad: "Amable" @;
  al_recibir p {
    si contiene(p, "hola") entonces
      responder "hi";
    sino
      responder "bye";
    fin
  }
}
`,
  },
  {
    id: "err-sintactico",
    nombre: "Error sintáctico",
    descripcion: "Falta ':' después de objetivo — lo detecta la fase 2",
    esError: true,
    codigo: `agente Test {
  objetivo "falta el dos puntos";
  personalidad: "Amable";
  al_recibir p {
    si contiene(p, "hola") entonces
      responder "hi";
    sino
      responder "bye";
    fin
  }
}
`,
  },
  {
    id: "err-semantico",
    nombre: "Error semántico",
    descripcion: "objetivo duplicado + identificador fuera de ámbito — fase 3",
    esError: true,
    codigo: `agente Test {
  objetivo: "Ayudar";
  objetivo: "Ayudar mas";
  personalidad: "Amable";
  al_recibir p {
    si contiene(otro, "hola") entonces
      responder "hi";
    sino
      responder "bye";
    fin
  }
}
`,
  },
  {
    id: "err-eventos",
    nombre: "Eventos duplicados",
    descripcion: "Dos al_recibir con el mismo parámetro — fase 3",
    esError: true,
    codigo: `agente Test {
  objetivo: "Probar";
  personalidad: "Neutral";

  al_recibir pregunta {
    si contiene(pregunta, "hola") entonces
      responder "Hola!";
    sino
      responder "...";
    fin
  }

  al_recibir pregunta {
    si contiene(pregunta, "adios") entonces
      responder "Adios!";
    sino
      responder "...";
    fin
  }
}
`,
  },
];
