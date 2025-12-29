const { google } = require('googleapis');
const stream = require('stream');

/**
 * Sube un archivo a Google Drive usando las credenciales del Contable (OAuth)
 * @param {Object} authClient - Cliente OAuth2 autenticado del usuario
 * @param {Buffer} fileBuffer - Datos de la imagen
 * @param {string} fileName - Nombre del archivo
 * @param {string} mimeType - Tipo (image/jpeg, application/pdf)
 */
const uploadToDrive = async (authClient, fileBuffer, fileName, mimeType = 'image/jpeg') => {
    try {
        const drive = google.drive({ version: 'v3', auth: authClient });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        // 1. Crear carpeta "Super Contable" si no existe (Opcional, por ahora a la raíz para simplificar)
        // Para este MVP subimos a la raíz del Drive del usuario o a una carpeta específica si configuramos ID
        const fileMetadata = {
            name: fileName,
            // parents: ['ID_CARPETA'] // Si quisieras una carpeta fija, pero mejor dejar que caiga en su Drive
        };

        // 2. Subir Archivo
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink'
        });

        const fileId = response.data.id;
        console.log(`☁️ Archivo subido a Drive del Contable. ID: ${fileId}`);

        // 3. Hacerlo visible (Permiso público de lectura para que el link funcione en el Excel a terceros)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        // 4. Retornar URL Web (Esta es la que saldrá en el Excel)
        return `https://drive.google.com/uc?export=view&id=${fileId}`;

    } catch (error) {
        console.error('❌ Error subiendo a Drive con OAuth:', error.message);
        throw error;
    }
};

module.exports = { uploadToDrive };