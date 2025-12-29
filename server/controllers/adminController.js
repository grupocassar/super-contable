const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');

/**
 * Obtener estadísticas generales para el Dashboard del Admin
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
    const db = getDatabase();
    
    // Promesa auxiliar para consultas de conteo
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
            getCount("SELECT COUNT(*) as count FROM users WHERE rol = 'contable'"),
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
 * Obtener lista de Contables con sus estadísticas (Empresas y Asistentes vinculados)
 */
const getContables = asyncHandler(async (req, res) => {
    const db = getDatabase();
    
    // Consulta segura que cuenta sub-elementos directamente en SQL
    // Esto evita el Error 500 por métodos faltantes en el modelo
    const query = `
        SELECT 
            u.id, 
            u.nombre_completo, 
            u.email, 
            u.created_at,
            (SELECT COUNT(*) FROM empresas e WHERE e.contable_id = u.id) as total_empresas,
            (SELECT COUNT(*) FROM users a WHERE a.contable_id = u.id AND a.rol = 'asistente') as total_asistentes
        FROM users u
        WHERE u.rol = 'contable'
        ORDER BY u.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Error obteniendo contables:", err);
            return res.status(500).json({ success: false, message: "Error al consultar la base de datos" });
        }
        res.json({ success: true, data: rows });
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
        rol: 'contable'
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
 * Eliminar un Contable
 */
const deleteContable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();
    
    // Verificar si existe antes de borrar
    db.get("SELECT id FROM users WHERE id = ? AND rol = 'contable'", [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (!row) return res.status(404).json({ success: false, message: "Contable no encontrado" });

        // Borrar (Las empresas y facturas se borran en cascada si está configurado así en la BD, 
        // o quedan huérfanas. Para este MVP, asumimos borrado directo).
        db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ success: false, message: "Error al eliminar" });
            res.json({ success: true, message: "Contable eliminado correctamente" });
        });
    });
});

module.exports = {
    getAdminDashboard,
    getContables,
    createContable,
    updateContable,
    deleteContable
};