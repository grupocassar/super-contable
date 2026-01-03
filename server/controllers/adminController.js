const User = require('../models/User');
const ContablePlan = require('../models/ContablePlan');
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');

/**
 * CONFIGURACIÓN MAESTRA DE PLANES (Única fuente de verdad)
 */
const PLANES_CONFIG = {
    'STARTER': { limite: 800, gracia: 50 },  // ACTUALIZADO: 800 facturas
    'PROFESSIONAL': { limite: 1500, gracia: 100 },
    'BUSINESS': { limite: 6000, gracia: 500 }
};

/**
 * Obtener estadísticas generales para el Dashboard del Admin
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
    const db = getDatabase();
    
    const getCount = (query) => {
        return new Promise((resolve, reject) => {
            db.get(query, [], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });
    };

    try {
        const [totalContables, totalEmpresas, totalFacturas] = await Promise.all([
            getCount("SELECT COUNT(*) as count FROM users WHERE role = 'contable'"),
            getCount("SELECT COUNT(*) as count FROM empresas"),
            getCount("SELECT COUNT(*) as count FROM facturas")
        ]);

        res.json({
            success: true,
            data: {
                stats: {
                    total_contables: totalContables,
                    total_empresas: totalEmpresas,
                    total_facturas: totalFacturas
                }
            }
        });
    } catch (error) {
        console.error("Error en dashboard admin:", error);
        res.status(500).json({ success: false, message: "Error al cargar estadísticas" });
    }
});

/**
 * Obtener lista de Contables con estadísticas y consumo optimizado
 */
const getContables = asyncHandler(async (req, res) => {
    const db = getDatabase();
    
    const query = `
        SELECT 
            u.id, 
            u.nombre_completo, 
            u.email, 
            u.created_at,
            (SELECT COUNT(*) FROM empresas e WHERE e.contable_id = u.id) as total_empresas,
            (SELECT COUNT(*) FROM users a WHERE a.contable_id = u.id AND a.role = 'asistente') as total_asistentes,
            cp.plan,
            cp.limite_facturas,
            cp.zona_gracia,
            (SELECT COUNT(*) 
             FROM facturas f
             INNER JOIN empresas e ON f.empresa_id = e.id
             WHERE e.contable_id = u.id
             AND strftime('%Y-%m', f.created_at) = strftime('%Y-%m', 'now')
            ) as facturas_mes
        FROM users u
        LEFT JOIN contables_planes cp ON cp.contable_id = u.id AND cp.estado = 'activo'
        WHERE u.role = 'contable'
        ORDER BY u.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error obteniendo contables:", err);
            return res.status(500).json({ success: false, message: "Error al consultar la base de datos" });
        }
        
        const contablesConEstado = rows.map(contable => {
            // Si no tiene plan activo, asumimos el nuevo default (STARTER @ 800)
            const planKey = contable.plan || 'STARTER';
            const config = PLANES_CONFIG[planKey] || PLANES_CONFIG['STARTER'];
            
            const limite = contable.limite_facturas || config.limite;
            const gracia = contable.zona_gracia || config.gracia;
            const consumo = contable.facturas_mes || 0;
            const limiteTotal = limite + gracia;
            
            let estado_plan = 'normal';
            if (consumo >= limiteTotal) {
                estado_plan = 'bloqueado';
            } else if (consumo >= limite) {
                estado_plan = 'critico';
            } else if ((consumo / limite) >= 0.8) {
                estado_plan = 'advertencia';
            }
            
            return {
                ...contable,
                plan: planKey,
                limite_facturas: limite,
                zona_gracia: gracia,
                estado_plan: estado_plan,
                porcentaje_uso: Math.round((consumo / limite) * 100)
            };
        });
        
        res.json({ success: true, data: contablesConEstado });
    });
});

/**
 * Crear un nuevo Contable
 */
const createContable = asyncHandler(async (req, res) => {
    const { nombre_completo, email, password } = req.body;

    if (!nombre_completo || !email || !password) {
        return res.status(400).json({ success: false, message: "Todos los campos son obligatorios" });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        return res.status(409).json({ success: false, message: "El email ya está registrado" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await User.create({
        nombre_completo,
        email,
        password_hash,
        role: 'contable'
    });

    res.status(201).json({ success: true, data: await User.findById(result.id) });
});

/**
 * Actualizar datos de un Contable
 */
const updateContable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, email, password } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "Contable no encontrado" });

    const updates = { nombre_completo, email };
    
    if (password && password.trim() !== "") {
        const salt = await bcrypt.genSalt(10);
        updates.password_hash = await bcrypt.hash(password, salt);
    }

    await User.update(id, updates);
    res.json({ success: true, data: await User.findById(id) });
});

/**
 * Eliminar un Contable (Baja lógica/física)
 */
const deleteContable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    
    db.get("SELECT id FROM users WHERE id = ? AND role = 'contable'", [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (!row) return res.status(404).json({ success: false, message: "Contable no encontrado" });

        db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ success: false, message: "Error al eliminar" });
            res.json({ success: true, message: "Contable eliminado correctamente" });
        });
    });
});

/**
 * Cambiar plan de un contable (STARTER ahora limitado a 800)
 */
const cambiarPlanContable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { plan } = req.body;
    
    if (!PLANES_CONFIG[plan]) {
        return res.status(400).json({ 
            success: false, 
            message: `Plan inválido. Opciones: ${Object.keys(PLANES_CONFIG).join(', ')}` 
        });
    }
    
    const db = getDatabase();
    const user = await User.findById(id);
    if (!user || user.role !== 'contable') {
        return res.status(404).json({ success: false, message: "Contable no encontrado" });
    }
    
    try {
        // Inactivar planes anteriores
        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE contables_planes SET estado = 'inactivo' WHERE contable_id = ? AND estado = 'activo'",
                [id],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        const config = PLANES_CONFIG[plan];
        const now = new Date().toISOString().split('T')[0];
        
        // Crear nuevo plan con los nuevos límites
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO contables_planes 
                (contable_id, plan, limite_facturas, zona_gracia, fecha_inicio, estado, created_at)
                VALUES (?, ?, ?, ?, ?, 'activo', datetime('now'))`,
                [id, plan, config.limite, config.gracia, now],
                function(err) { err ? reject(err) : resolve({ id: this.lastID }); }
            );
        });
        
        res.json({ 
            success: true, 
            message: `Plan actualizado a ${plan} con éxito.`,
            data: {
                plan: plan,
                limite_facturas: config.limite,
                zona_gracia: config.gracia
            }
        });
        
    } catch (error) {
        console.error("Error cambiando plan:", error);
        res.status(500).json({ success: false, message: "Error al actualizar el plan" });
    }
});

/**
 * NUEVA FUNCIÓN: Obtener solicitudes pendientes de upgrade
 */
const getSolicitudesPendientes = asyncHandler(async (req, res) => {
    const db = getDatabase();
    
    const query = `
        SELECT 
            ur.id,
            ur.plan_actual,
            ur.plan_solicitado,
            ur.mensaje_contable,
            ur.created_at,
            u.nombre_completo,
            u.email
        FROM upgrade_requests ur
        INNER JOIN users u ON ur.contable_id = u.id
        WHERE ur.estado = 'pendiente'
        ORDER BY ur.created_at ASC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

/**
 * NUEVA FUNCIÓN: Aprobar solicitud de upgrade
 */
const aprobarSolicitud = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    
    // Obtener la solicitud específica
    const solicitud = await new Promise((resolve, reject) => {
        db.get(
            "SELECT * FROM upgrade_requests WHERE id = ?",
            [id],
            (err, row) => err ? reject(err) : resolve(row)
        );
    });
    
    if (!solicitud) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }
    
    if (solicitud.estado !== 'pendiente') {
        return res.status(400).json({ success: false, message: 'Solicitud ya procesada' });
    }
    
    try {
        // Usamos PLANES_CONFIG definido al inicio del archivo
        const config = PLANES_CONFIG[solicitud.plan_solicitado];
        
        // 1. Inactivar planes anteriores
        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE contables_planes SET estado = 'inactivo' WHERE contable_id = ? AND estado = 'activo'",
                [solicitud.contable_id],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // 2. Crear nuevo plan activo basado en la solicitud
        const now = new Date().toISOString().split('T')[0];
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO contables_planes 
                (contable_id, plan, limite_facturas, zona_gracia, fecha_inicio, estado, created_at)
                VALUES (?, ?, ?, ?, ?, 'activo', datetime('now'))`,
                [solicitud.contable_id, solicitud.plan_solicitado, config.limite, config.gracia, now],
                function(err) { err ? reject(err) : resolve(); }
            );
        });
        
        // 3. Marcar solicitud como aprobada
        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE upgrade_requests SET estado = 'aprobada', updated_at = datetime('now') WHERE id = ?",
                [id],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        res.json({ 
            success: true, 
            message: `Plan actualizado a ${solicitud.plan_solicitado} con éxito.` 
        });
        
    } catch (error) {
        console.error('Error aprobando solicitud:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la aprobación' });
    }
});

/**
 * NUEVA FUNCIÓN: Rechazar solicitud de upgrade
 */
const rechazarSolicitud = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;
    const db = getDatabase();
    
    db.run(
        "UPDATE upgrade_requests SET estado = 'rechazada', respuesta_admin = ?, updated_at = datetime('now') WHERE id = ?",
        [motivo || '', id],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            res.json({ success: true, message: 'Solicitud rechazada correctamente' });
        }
    );
});

module.exports = {
    getAdminDashboard,
    getContables,
    createContable,
    updateContable,
    deleteContable,
    cambiarPlanContable,
    getSolicitudesPendientes,
    aprobarSolicitud,
    rechazarSolicitud
};