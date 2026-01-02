/**
 * Servicio de Inteligencia Artificial utilizando Gemini 2.5 Flash
 * Especializado en la extracción de datos para el Formato 606 de República Dominicana.
 */

const apiKey = process.env.GOOGLE_API_KEY;

/**
 * Función principal para procesar la imagen de una factura.
 * @param {string} base64Data - Imagen en formato base64.
 * @param {string} mimeType - Tipo de imagen (image/jpeg, image/png).
 * @returns {Promise<Object>} - Datos extraídos en formato JSON.
 */
async function procesarFacturaConGemini(base64Data, mimeType = "image/jpeg") {
  const modelId = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  // VERSIÓN HÍBRIDA RECOMENDADA: Mejoras de ITBIS + Códigos Completos
  const systemPrompt = `
    Actúa como un experto contable senior en República Dominicana especializado en reportes DGII (Formato 606).
    Tu tarea es extraer datos precisos de facturas escaneadas o fotos.
    
    ESTRATEGIA DE EXTRACCIÓN DE ITBIS (CRÍTICO):
    1. BÚSQUEDA EXHAUSTIVA: El impuesto puede aparecer como: "ITBIS", "ITEBIS", "IVA", "Impuesto", "Ley", "18%", o "16%".
    2. UBICACIÓN: Generalmente está cerca del Subtotal y antes del Total General.
    3. VALIDACIÓN MATEMÁTICA: Si detectas Subtotal y Total, verifica si (Total - Subtotal) corresponde al impuesto.
    4. Si es B01 y NO aparece ITBIS explícito ni implícito, entonces es 0.
    
    REGLAS DE NEGOCIO (OTROS CAMPOS):
    1. RNC/Cédula: Solo números (9 u 11 dígitos).
    2. NCF: Patrón B + 10 dígitos (ej: B0100000001).
    3. Clasificación de Gasto (tipo_gasto): 
       '01' Gastos de personal
       '02' Gastos por trabajos, suministros y servicios
       '03' Arrendamientos
       '04' Gastos de activos fijos
       '05' Gastos de representación (comidas, viajes)
       '06' Otras deducciones admitidas
       '07' Gastos financieros
       '08' Gastos extraordinarios
       '09' Compras y gastos que formarán parte del costo de venta
       '10' Adquisiciones de activos
       '11' Gastos de seguros
    4. Forma de Pago (forma_pago): 
       '01' Efectivo, '02' Cheque/Transferencia, '03' Tarjeta, '04' Crédito, '05' Permuta, '06' Nota Crédito, '07' Mixto
    5. Tipo de ID: '1' para RNC (9 dígitos), '2' para Cédula (11 dígitos).
    6. Fecha: Formato YYYY-MM-DD.
    7. Propina Legal: Extrae 10% por separado si existe.
  `;

  const userQuery = "Analiza esta factura y extrae los datos para el 606. Pon especial atención al ITBIS/Impuestos.";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: userQuery },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          rnc: { type: "STRING" },
          tipo_id: { type: "STRING" },
          tipo_gasto: { type: "STRING" },
          ncf: { type: "STRING" },
          fecha_factura: { type: "STRING", description: "Formato YYYY-MM-DD" },
          monto_servicios: { type: "NUMBER" },
          monto_bienes: { type: "NUMBER" },
          itbis_facturado: { type: "NUMBER", description: "Monto del impuesto. Si es 0, pon 0." },
          impuesto_selectivo: { type: "NUMBER" },
          otros_impuestos: { type: "NUMBER" },
          propina_legal: { type: "NUMBER" },
          forma_pago: { type: "STRING" },
          proveedor: { type: "STRING" },
          total_pagado: { type: "NUMBER" },
          confidence_score: { type: "NUMBER", description: "0 a 100" }
        },
        // CAMBIO CRÍTICO MANTENIDO: itbis_facturado es obligatorio
        required: ["rnc", "ncf", "fecha_factura", "total_pagado", "itbis_facturado", "confidence_score"]
      }
    }
  };

  let retryCount = 0;
  const maxRetries = 5;

  while (retryCount <= maxRetries) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) throw new Error("Respuesta de IA vacía.");

      return JSON.parse(textResponse);

    } catch (error) {
      if (retryCount === maxRetries) throw error;
      
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(res => setTimeout(res, delay));
      retryCount++;
    }
  }
}

module.exports = { procesarFacturaConGemini };