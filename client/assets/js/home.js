/**
 * HOME.JS
 * Lógica de interacción para la Landing Page comercial.
 * ESTRATEGIA: Cierre de ventas vía WhatsApp (Conversational Sales).
 */

// ⚠️ CONFIGURACIÓN: Coloca aquí el número de ventas (Formato internacional sin +)
// Ejemplo RD: 18091234567
const WHATSAPP_NUMBER = "358469670124"; 

document.addEventListener('DOMContentLoaded', () => {
    initScrollEffects();
    initPlanSelection();
});

/**
 * Configura los botones de selección de planes
 */
function initPlanSelection() {
    const buttons = document.querySelectorAll('.btn-plan-select, .btn-plan-select-primary');

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.pricing-card');
            const planId = card ? card.dataset.plan : 'GENERAL';
            
            // Enviamos al usuario a cerrar la venta por WhatsApp
            handleWhatsAppSales(planId);
        });
    });
}

/**
 * Genera el enlace de WhatsApp con un mensaje pre-llenado personalizado
 * según el plan que el cliente eligió.
 */
function handleWhatsAppSales(plan) {
    let mensaje = "";

    switch (plan) {
        case 'STARTER':
            mensaje = "Hola Super Contable, me interesa el *Plan Starter ($135)*. ¿Cómo iniciamos el proceso de implementación?";
            break;
        case 'PROFESSIONAL':
            mensaje = "Hola, quiero potenciar mi firma con el *Plan Professional ($195)*. Estoy listo para la implementación.";
            break;
        case 'BUSINESS':
            mensaje = "Saludos. Requiero información para una firma grande (*Plan Business $450*). Necesito soporte dedicado.";
            break;
        default:
            mensaje = "Hola, me gustaría recibir asesoría sobre Super Contable.";
    }

    // Codificamos el texto para URL
    const textoCodificado = encodeURIComponent(mensaje);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${textoCodificado}`;

    // Abrimos WhatsApp en una pestaña nueva
    window.open(url, '_blank');
}

/**
 * Scroll suave para la navegación
 */
function initScrollEffects() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId !== '#') {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}