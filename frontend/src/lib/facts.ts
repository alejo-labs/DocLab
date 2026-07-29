/**
 * Curiosidades que se muestran en las pantallas de carga. Mezcla de datos sobre el PDF,
 * privacidad y la propia arquitectura de DocLab. Han de ser breves, ciertas y amenas.
 */
export const FACTS: readonly string[] = [
  'El formato PDF nació en 1993, creado por Adobe. Buscaba que un documento se viera igual en cualquier ordenador.',
  'Desde 2008 el PDF es un estándar abierto (ISO 32000). Ya no pertenece a ninguna empresa.',
  'Mientras lees esto, tu archivo sigue en tu dispositivo. DocLab no lo ha subido a ningún servidor.',
  'Un PDF puede contener texto, imágenes, fuentes, formularios, JavaScript e incluso vídeo. Por eso «sanear» un PDF importa.',
  'El cifrado AES-256 que usa DocLab protegería tu PDF frente a fuerza bruta durante más tiempo que la edad del universo.',
  'WebAssembly permite ejecutar código casi a velocidad nativa dentro del navegador. Es lo que hace posible cifrar y hacer OCR aquí mismo.',
  'La «A» de PDF/A significa «Archive», una variante pensada para conservar documentos legibles durante décadas.',
  'OCR significa Reconocimiento Óptico de Caracteres, y convierte la imagen de un texto escaneado en texto de verdad, seleccionable.',
  'Cuando censuras un PDF tapando texto con un rectángulo, el texto suele seguir debajo. DocLab lo rasteriza para eliminarlo de verdad.',
  'Los metadatos de un PDF pueden revelar tu nombre, el programa que usaste e incluso cuándo lo editaste. DocLab puede limpiarlos.',
  'DocLab autoaloja sus tipografías y motores, así que no pide nada a servidores de terceros que pudieran observar tu actividad.',
  'Un PDF «buscable» combina la imagen escaneada con una capa de texto invisible superpuesta. Lo ves igual, pero puedes buscar en él.',
  'Comprimir un PDF suele consistir en recomprimir sus imágenes. El texto vectorial ya pesa muy poco.',
  'DocLab funciona sin conexión para muchas tareas. Una vez cargada la página, los motores viven en tu navegador.',
  'La firma con contraseña de un PDF cifra el contenido, y sin la clave correcta ni siquiera se puede abrir.',
  'El estándar PDF admite hasta 8.192 unidades de longitud por página, unos 5,08 metros de ancho.',
];

/** Devuelve una curiosidad al azar distinta de la anterior (si se indica un índice previo). */
export function nextFactIndex(prev: number): number {
  if (FACTS.length < 2) return 0;
  let i = prev;
  while (i === prev) i = Math.floor(Math.random() * FACTS.length);
  return i;
}
