/**
 * SCRIPT DE DIAGNÓSTICO DE TOKEN
 * Ejecución: node server/scripts/check-token.js
 */
require('dotenv').config();
const axios = require('axios');

async function checkToken() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    console.log(`🔍 Probando token: ${token ? token.substring(0, 10) + '...' : 'VACÍO'}`);

    if (!token) {
        console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en el .env');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/getMe`;
        const response = await axios.get(url);
        
        if (response.data.ok) {
            console.log('✅ ¡TOKEN VÁLIDO!');
            console.log('🤖 Bot Name:', response.data.result.first_name);
            console.log('🤖 Username:', response.data.result.username);
        }
    } catch (error) {
        console.error('❌ ERROR 401: Telegram rechaza el token.');
        console.log('---');
        console.log('Acciones recomendadas:');
        console.log('1. Ve a @BotFather en Telegram.');
        console.log('2. Escribe /token y selecciona tu bot.');
        console.log('3. Copia el token NUEVAMENTE y pégalo en el .env sin espacios.');
        console.log('4. Si el error persiste, genera un nuevo token con /revoke en BotFather.');
    }
}

checkToken();