const { google } = require('googleapis');
const stream = require('stream');

/**
 * Sube un archivo al Drive del CONTABLE usando su propio token (OAuth2)
 * @param {Object} authClient - Cliente OAuth2 ya autenticado con el token del contable
 * @param {Buffer} fileBuffer - Datos binarios de la imagen/documento
 * @param {string} fileName - Nombre descriptivo para el archivo
 * @param {string} mimeType - Tipo de archivo (default: image/jpeg)
 */
const uploadToDrive = async (authClient, fileBuffer, fileName, mimeType = 'image/jpeg') => {
    try {
        // Inicializamos Drive con el cliente que ya trae el token del contable
        const drive = google.drive({ version: 'v3', auth: authClient });

        // Convertimos el Buffer a Stream (Método eficiente para Node.js)
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        const fileMetadata = {
            name: fileName
        };

        // 1. Crear el archivo en la cuenta de Google Drive del contable
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        const fileId = response.data.id;
        console.log(`☁️ Archivo subido con éxito al Drive del Contable. ID: ${fileId}`);

        // 2. Aplicar permisos de visualización
        // Esto permite que el link de previsualización funcione en el panel del asistente
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        // 3. Retornar el link directo (Formato de visualización universal)
        return `https://drive.google.com/uc?export=view&id=${fileId}`;

    } catch (error) {
        console.error('❌ Error en Drive Service (OAuth Flow):', error.message);
        throw error;
    }
};

module.exports = { uploadToDrive };