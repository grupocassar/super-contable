const { getDatabase } = require('../config/database');

class ContablePlan {
  /**
   * Obtiene el plan activo del contable (usuario) desde la base de datos
   */
  static findByContableId(contableId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT * FROM contables_planes 
         WHERE contable_id = ? AND estado = 'activo'
         ORDER BY created_at DESC LIMIT 1`,
        [contableId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Cuenta las facturas procesadas este mes por TODAS las empresas del contable
   */
  static getConsumoMes(contableId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      // Relación: Facturas -> Empresas -> Contable
      const query = `
        SELECT COUNT(f.id) as facturas_procesadas
        FROM facturas f
        INNER JOIN empresas e ON f.empresa_id = e.id
        WHERE e.contable_id = ?
        AND strftime('%Y-%m', f.created_at) = strftime('%Y-%m', 'now')
      `;

      db.get(query, [contableId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.facturas_procesadas || 0);
      });
    });
  }

  /**
   * Devuelve el objeto completo para el Dashboard (Plan + Consumo Real)
   * Sincronizado con el nuevo límite de 800 para el plan STARTER
   */
  static async getPlanYConsumo(contableId) {
    try {
      const plan = await this.findByContableId(contableId);
      const consumo = await this.getConsumoMes(contableId);

      // Si no tiene plan asignado, usamos los nuevos valores por defecto (STARTER @ 800)
      if (!plan) {
        const defaultLimite = 800; // ACTUALIZADO: Antes 1000
        const defaultGracia = 50;

        return {
          plan: 'STARTER',
          limite_facturas: defaultLimite,
          zona_gracia: defaultGracia,
          facturas_procesadas: consumo,
          porcentaje: Math.round((consumo / defaultLimite) * 100),
          estado_alerta: this.calcularEstadoAlerta(consumo, defaultLimite, defaultGracia)
        };
      }

      return {
        plan: plan.plan,
        limite_facturas: plan.limite_facturas,
        zona_gracia: plan.zona_gracia,
        facturas_procesadas: consumo,
        porcentaje: Math.round((consumo / plan.limite_facturas) * 100),
        estado_alerta: this.calcularEstadoAlerta(
          consumo, 
          plan.limite_facturas, 
          plan.zona_gracia
        )
      };
    } catch (error) {
      console.error('Error calculando plan y consumo:', error);
      throw error;
    }
  }

  /**
   * Lógica de semáforo para el Dashboard (Normal, Advertencia, Crítico, Bloqueado)
   */
  static calcularEstadoAlerta(consumo, limite, gracia) {
    const porcentaje = (consumo / limite) * 100;
    const limiteConGracia = limite + gracia;

    if (consumo >= limiteConGracia) {
      return { nivel: 'bloqueado', mensaje: '⛔ Límite excedido' };
    } else if (consumo >= limite) {
      return { 
        nivel: 'critico', 
        mensaje: `⚠️ En zona de gracia (${consumo - limite}/${gracia} extra)` 
      };
    } else if (porcentaje >= 80) {
      return { 
        nivel: 'advertencia', 
        mensaje: `⚠️ ${Math.round(porcentaje)}% del plan usado` 
      };
    } else {
      return { nivel: 'normal', mensaje: '✅ Consumo normal' };
    }
  }
}

module.exports = ContablePlan;