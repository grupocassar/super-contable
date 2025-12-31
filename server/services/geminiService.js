/**
 * Servicio de Inteligencia Artificial utilizando Gemini 2.5 Flash
 * Especializado en la extracción de datos para el Formato 606 de República Dominicana.
 */

// El entorno proporciona el API Key automáticamente al ejecutar
const apiKey = ""; 

/**
 * Función principal para procesar la imagen de una factura.
 * @param {string} base64Data - Imagen en formato base64.
 * @param {string} mimeType - Tipo de imagen (image/jpeg, image/png).
 * @returns {Promise<Object>} - Datos extraídos en formato JSON.
 */
async function procesarFacturaConGemini(base64Data, mimeType = "image/jpeg") {
  const modelId = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const systemPrompt = `
    Actúa como un experto contable senior en República Dominicana especializado en reportes DGII.
    Tu tarea es extraer datos de facturas para completar el Formato 606.
    
    REGLAS DE NEGOCIO CRÍTICAS:
    1. RNC/Cédula: Solo números, sin guiones (9 u 11 dígitos).
    2. NCF: Debe ser válido (ej: B0100000001).
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
       '01' Efectivo
       '02' Cheque/Transferencia/Depósito
       '03' Tarjeta Crédito/Débito
       '04' Compra a Crédito
       '05' Permuta
       '06' Notas de Crédito
       '07' Mixto
    5. Tipo de ID (tipo_id): '1' para RNC (9 dígitos), '2' para Cédula (11 dígitos).
    6. Montos: Si la factura tiene Propina Legal (10%), extráela por separado.
    7. ITBIS: Si es B01 y no hay ITBIS, marca 0.
  `;

  const userQuery = "Analiza esta factura dominicana y extrae todos los campos requeridos para el reporte 606.";

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
          itbis_facturado: { type: "NUMBER" },
          impuesto_selectivo: { type: "NUMBER" },
          otros_impuestos: { type: "NUMBER" },
          propina_legal: { type: "NUMBER" },
          forma_pago: { type: "STRING" },
          proveedor: { type: "STRING" },
          total_pagado: { type: "NUMBER" },
          confidence_score: { type: "NUMBER", description: "0 a 100" }
        },
        required: ["rnc", "ncf", "fecha_factura", "total_pagado", "confidence_score"]
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