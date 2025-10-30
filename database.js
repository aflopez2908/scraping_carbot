const mysql = require('mysql2/promise');
require('dotenv').config();

class VehiculosDatabase {
  constructor() {
    this.connection = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vehiculos',
      charset: 'utf8mb4'
    };
  }

  async initialize() {
    try {
      console.log('🔄 Conectando a MySQL...');
      this.connection = await mysql.createConnection(this.config);
      console.log('✅ Conectado a MySQL exitosamente');
      
      await this.createTables();
      console.log('✅ Tablas verificadas/creadas');
    } catch (error) {
      console.error('❌ Error conectando a BD:', error.message);
      throw error;
    }
  }

  async createTables() {
    // Tabla principal según tu estructura: Nombre, Marca, Modelo, Precio, Rango, Año, Kilometraje, Ciudad, Link
    const createVehiculosTable = `
      CREATE TABLE IF NOT EXISTS vehiculos_scraping (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre TEXT,
        marca VARCHAR(50) NOT NULL,
        modelo VARCHAR(100) NOT NULL,
        precio VARCHAR(50),
        precio_numero BIGINT DEFAULT 0,
        rango VARCHAR(50),
        ano INT,
        kilometraje VARCHAR(50),
        ciudad VARCHAR(255),
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_marca (marca),
        INDEX idx_modelo (modelo),
        INDEX idx_marca_modelo (marca, modelo),
        INDEX idx_ano (ano),
        INDEX idx_precio (precio_numero),
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Tabla de control de scraping
    const createControlTable = `
      CREATE TABLE IF NOT EXISTS scraping_control (
        id INT PRIMARY KEY AUTO_INCREMENT,
        marca VARCHAR(50) NOT NULL,
        modelo VARCHAR(100) NOT NULL,
        total_productos INT DEFAULT 0,
        last_scrape TIMESTAMP,
        status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
        error_message TEXT,
        method VARCHAR(50),
        tiempo_procesamiento_ms INT,
        
        UNIQUE KEY unique_marca_modelo (marca, modelo),
        INDEX idx_status (status),
        INDEX idx_last_scrape (last_scrape)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await this.connection.execute(createVehiculosTable);
    await this.connection.execute(createControlTable);
    
    console.log('📊 Tablas creadas: vehiculos_scraping, scraping_control');
  }

  async checkIfExists(marca, modelo) {
    try {
      const [rows] = await this.connection.execute(
        'SELECT * FROM scraping_control WHERE marca = ? AND modelo = ?',
        [marca, modelo]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('❌ Error verificando existencia:', error);
      return null;
    }
  }

  async shouldUpdate(existingRecord) {
    if (!existingRecord || !existingRecord.last_scrape) return true;
    
    const daysSinceUpdate = (Date.now() - new Date(existingRecord.last_scrape)) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7; // Actualizar si tiene más de 7 días
  }

  async markAsProcessing(marca, modelo) {
    try {
      await this.connection.execute(`
        INSERT INTO scraping_control (marca, modelo, status, last_scrape)
        VALUES (?, ?, 'processing', NOW())
        ON DUPLICATE KEY UPDATE 
        status = 'processing', 
        last_scrape = NOW()
      `, [marca, modelo]);
    } catch (error) {
      console.error('❌ Error marcando como processing:', error);
    }
  }

  async saveVehicleData(marca, modelo, resultado) {
    try {
      await this.connection.beginTransaction();
      
      console.log(`💾 Guardando datos para ${marca} ${modelo}...`);

      // 1. Eliminar datos existentes para esta marca/modelo
      await this.connection.execute(
        'DELETE FROM vehiculos_scraping WHERE marca = ? AND modelo = ?',
        [marca, modelo]
      );

      let totalGuardados = 0;

      // 2. Insertar nuevos productos
      if (resultado.productos && resultado.productos.length > 0) {
        const insertQuery = `
          INSERT INTO vehiculos_scraping (nombre, marca, modelo, precio, precio_numero, ano, kilometraje, ciudad, link)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const producto of resultado.productos) {
          // Extraer ciudad de ubicación
          let ciudad = '';
          if (producto.ubicacion) {
            const ciudadMatch = producto.ubicacion.match(/([^-]+)/);
            ciudad = ciudadMatch ? ciudadMatch[1].trim() : producto.ubicacion;
          }

          await this.connection.execute(insertQuery, [
            producto.descripcion || '',  // nombre
            marca,                       // marca
            modelo,                      // modelo  
            producto.precio || '',       // precio
            producto.precio_numero || 0, // precio_numero
            producto.year || null,       // ano
            producto.kilometraje || null,// kilometraje
            ciudad,                      // ciudad
            producto.link || ''          // link
          ]);
          totalGuardados++;
        }
      }

      // 3. Actualizar control de scraping
      await this.connection.execute(`
        INSERT INTO scraping_control 
        (marca, modelo, total_productos, last_scrape, status, method, tiempo_procesamiento_ms)
        VALUES (?, ?, ?, NOW(), 'completed', ?, ?)
        ON DUPLICATE KEY UPDATE
        total_productos = VALUES(total_productos),
        last_scrape = NOW(),
        status = 'completed',
        method = VALUES(method),
        tiempo_procesamiento_ms = VALUES(tiempo_procesamiento_ms),
        error_message = NULL
      `, [
        marca,
        modelo,
        totalGuardados,
        resultado.method || 'unknown',
        resultado.tiempo_total_ms || 0
      ]);

      await this.connection.commit();
      console.log(`✅ ${marca} ${modelo}: ${totalGuardados} productos guardados exitosamente`);
      
      return { success: true, total: totalGuardados };

    } catch (error) {
      await this.connection.rollback();
      console.error(`❌ Error guardando ${marca} ${modelo}:`, error.message);
      
      // Marcar como error
      try {
        await this.connection.execute(`
          INSERT INTO scraping_control (marca, modelo, status, error_message, last_scrape)
          VALUES (?, ?, 'error', ?, NOW())
          ON DUPLICATE KEY UPDATE
          status = 'error',
          error_message = VALUES(error_message),
          last_scrape = NOW()
        `, [marca, modelo, error.message]);
      } catch (updateError) {
        console.error('❌ Error actualizando estado de error:', updateError);
      }
      
      return { success: false, error: error.message };
    }
  }

  async getStats() {
    try {
      const [totalVehiculos] = await this.connection.execute('SELECT COUNT(*) as total FROM vehiculos_scraping');
      const [totalMarcas] = await this.connection.execute('SELECT COUNT(DISTINCT marca) as total FROM vehiculos_scraping');
      const [totalModelos] = await this.connection.execute('SELECT COUNT(DISTINCT CONCAT(marca, "-", modelo)) as total FROM vehiculos_scraping');
      
      const [statusStats] = await this.connection.execute(`
        SELECT 
          status,
          COUNT(*) as count
        FROM scraping_control 
        GROUP BY status
      `);

      const [ultimoScrape] = await this.connection.execute('SELECT MAX(last_scrape) as ultimo FROM scraping_control');

      return {
        totalVehiculos: totalVehiculos[0].total,
        totalMarcas: totalMarcas[0].total,
        totalModelos: totalModelos[0].total,
        statusDistribution: statusStats.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        ultimoScrape: ultimoScrape[0].ultimo
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }

  async getPendingWork() {
    try {
      const [rows] = await this.connection.execute(`
        SELECT marca, modelo, last_scrape, total_productos, status
        FROM scraping_control 
        WHERE status IN ('pending', 'error') 
           OR (status = 'completed' AND last_scrape < DATE_SUB(NOW(), INTERVAL 7 DAY))
        ORDER BY last_scrape ASC
        LIMIT 50
      `);
      
      return rows;
    } catch (error) {
      console.error('❌ Error obteniendo trabajo pendiente:', error);
      return [];
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('📊 Conexión BD cerrada');
    }
  }
}

module.exports = VehiculosDatabase;