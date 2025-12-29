const { google } = require('googleapis');

const googleSheetsService = {
  
  /**
   * Obtiene o crea un Spreadsheet para la empresa
   */
  async getOrCreateSpreadsheet(authClient, title) {
    const service = google.sheets({ version: 'v4', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Escapar comillas simples en el título para la query de Drive
    const safeTitle = title.replace(/'/g, "\\'");

    // 1. Buscar si ya existe un archivo con ese nombre exacto y que no esté en la papelera
    const q = `name = '${safeTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    
    try {
        const fileList = await drive.files.list({ q: q, fields: 'files(id, name, webViewLink)' });

        if (fileList.data.files && fileList.data.files.length > 0) {
          console.log(`📄 Spreadsheet existente encontrado: ${fileList.data.files[0].id}`);
          return {
              id: fileList.data.files[0].id,
              url: fileList.data.files[0].webViewLink
          };
        }
    } catch (error) {
        console.warn("Advertencia buscando spreadsheet (se creará uno nuevo):", error.message);
    }

    // 2. Si no existe, crear uno nuevo
    const requestBody = {
      properties: { title: title }
    };
    
    try {
        const spreadsheet = await service.spreadsheets.create({ 
            requestBody, 
            fields: 'spreadsheetId,spreadsheetUrl' 
        });
        
        console.log(`✨ Nuevo Spreadsheet creado: ${spreadsheet.data.spreadsheetId}`);
        
        return {
            id: spreadsheet.data.spreadsheetId,
            url: spreadsheet.data.spreadsheetUrl
        };
    } catch (error) {
        console.error("Error creando spreadsheet:", error);
        throw error;
    }
  },

  /**
   * ✅ NUEVA LÓGICA: Escribe datos ACUMULATIVOS (APPEND) en la hoja
   * - Primera vez: Crea headers + datos
   * - Siguientes veces: Solo agrega datos al final
   */
  async writeToSheet(authClient, spreadsheetId, sheetName, headers, data) {
    const service = google.sheets({ version: 'v4', auth: authClient });

    // 1. Verificar si la pestaña (sheet) existe
    const spreadsheet = await service.spreadsheets.get({ spreadsheetId });
    let sheetId = null;
    
    if (spreadsheet.data.sheets) {
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (sheet) sheetId = sheet.properties.sheetId;
    }

    if (sheetId === null) {
      // Crear pestaña nueva
      const requests = [{
        addSheet: {
          properties: { title: sheetName }
        }
      }];
      
      const result = await service.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      sheetId = result.data.replies[0].addSheet.properties.sheetId;
    }

    // 2. ✅ CAMBIO: Verificar si ya hay datos (buscar última fila)
    let existingData;
    try {
      existingData = await service.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:A`
      });
    } catch (error) {
      existingData = { data: { values: [] } };
    }

    let startRow = 1;
    let shouldWriteHeaders = true;

    if (existingData.data.values && existingData.data.values.length > 0) {
      // Ya hay datos, agregar después de la última fila
      startRow = existingData.data.values.length + 1;
      shouldWriteHeaders = false;
      console.log(`📝 Agregando ${data.length} filas desde fila ${startRow}`);
    } else {
      console.log(`📝 Primera escritura: Headers + ${data.length} filas`);
    }

    // 3. Preparar datos (con o sin headers)
    const values = shouldWriteHeaders ? [headers, ...data] : data;

    // 4. ✅ CAMBIO: Escribir datos desde startRow (APPEND)
    await service.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A${startRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    // 5. ✅ CAMBIO: Aplicar formato SOLO si es primera vez
    if (shouldWriteHeaders && sheetId !== null) {
        const requests = [
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: 0,
                        endRowIndex: 1
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.258, green: 0.521, blue: 0.956 }, // Azul Google
                            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,textFormat)"
                }
            },
            {
                updateSheetProperties: {
                    properties: {
                        sheetId: sheetId,
                        gridProperties: { frozenRowCount: 1 }
                    },
                    fields: "gridProperties.frozenRowCount"
                }
            },
            {
                 autoResizeDimensions: {
                    dimensions: {
                        sheetId: sheetId,
                        dimension: "COLUMNS",
                        startIndex: 0,
                        endIndex: headers.length
                    }
                 }
            }
        ];
        
        try {
            await service.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests }
            });
        } catch (e) {
            console.warn("Advertencia: No se pudo aplicar formato visual.", e.message);
        }
    }

    return true;
  }
};

module.exports = googleSheetsService;