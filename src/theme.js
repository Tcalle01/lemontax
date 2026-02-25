// Design tokens — facilito light mode
export const C = {
  bg: "#FFFFFF",
  surface: "#F7FAF8",
  card: "#FFFFFF",
  cardDark: "#1A3A2A",
  border: "#E0E8E2",
  green: "#1A3A2A",
  greenMid: "#2D5A3D",
  greenAccent: "#4CAF82",
  yellow: "#F5E642",
  yellowDim: "#F5E64220",
  white: "#FFFFFF",
  text: "#1A2E20",
  textMid: "#5A7A64",
  textDim: "#8FA894",
  red: "#E05252",
  blue: "#52A8E0",
  purple: "#9C52E0",
  orange: "#E09652",
  pink: "#F06292",
  teal: "#26C6DA",
};

export const catColors = {
  "Alimentación": C.greenAccent,
  "Salud": C.blue,
  "Educación": C.purple,
  "Vivienda": C.orange,
  "Vestimenta": C.pink,
  "Turismo": C.teal,
  "Transporte": "#52C4E0",
  "Servicios": "#E09652",
  "Entretenimiento": C.red,
  "Otros": "#90A4AE",
};

export const catIcons = {
  "Alimentación": "shopping_cart",
  "Salud": "medication",
  "Educación": "school",
  "Vivienda": "home",
  "Vestimenta": "checkroom",
  "Turismo": "flight",
  "Transporte": "local_gas_station",
  "Servicios": "phone_iphone",
  "Entretenimiento": "movie",
  "Otros": "receipt_long",
};

export const CAT_SRI = {
  "Vivienda": { field: 106 },
  "Educación": { field: 107 },
  "Salud": { field: 108 },
  "Vestimenta": { field: 109 },
  "Alimentación": { field: 110 },
  "Turismo": { field: 111 },
};

export const CATEGORIAS = ["Alimentación", "Salud", "Educación", "Vivienda", "Vestimenta", "Turismo", "Otros"];

export const CANASTA = 821.80; // SRI 2026 value

// Contributor type metadata
export const TIPOS_CONTRIBUYENTE = {
  dependencia_pura: {
    descripcion: "Trabajador en relación de dependencia",
    detalle: "Tienes empleo fijo con rol de pagos. Tu empresa retiene tus impuestos.",
    regimen: "general",
  },
  dependencia_con_extras: {
    descripcion: "Dependencia + ingresos adicionales",
    detalle: "Tienes empleo fijo pero también facturas ingresos extras.",
    regimen: "general",
  },
  freelancer_general: {
    descripcion: "Freelancer / Profesional independiente",
    detalle: "Prestas servicios por tu cuenta y emites facturas.",
    regimen: "general",
  },
  rimpe_emprendedor: {
    descripcion: "RIMPE Emprendedor",
    detalle: "Tienes un negocio con ingresos entre $20,001 y $300,000 anuales.",
    regimen: "rimpe_emprendedor",
  },
  rimpe_negocio_popular: {
    descripcion: "RIMPE Negocio Popular",
    detalle: "Tienes un negocio con ingresos menores a $20,000 anuales.",
    regimen: "rimpe_negocio_popular",
  },
  arrendador_general: {
    descripcion: "Arrendador de inmuebles",
    detalle: "Recibes ingresos por arrendar casas, departamentos o locales.",
    regimen: "general",
  },
};

// Obligation types per contributor type
export const OBLIGACIONES_POR_TIPO = {
  dependencia_pura: ["ir_anual", "agp"],
  dependencia_con_extras: ["iva_mensual", "ir_anual", "agp"],
  freelancer_general: ["iva_mensual", "ir_anual", "agp"],
  rimpe_emprendedor: ["iva_semestral", "ir_anual_rimpe", "agp"],
  rimpe_negocio_popular: ["ir_anual_rimpe", "agp"],
  arrendador_general: ["iva_mensual", "ir_anual", "agp"],
};

// IVA monthly due date day by 9th RUC digit
export const DIAS_VENCIMIENTO = {
  "1": 10, "2": 12, "3": 14, "4": 16, "5": 18,
  "6": 20, "7": 22, "8": 24, "9": 26, "0": 28,
};
