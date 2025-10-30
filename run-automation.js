#!/usr/bin/env node

require('dotenv').config();
const VehicleScrapingAutomation = require('./automation');

// Crear instancia de automatización
const automation = new VehicleScrapingAutomation();

// Manejar interrupciones gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupción detectada (Ctrl+C)...');
  automation.stop();
  console.log('✋ Finalizando de manera segura...');
  setTimeout(() => {
    console.log('👋 Automatización detenida.');
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Terminación detectada...');
  automation.stop();
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🤖 AUTOMATIZACIÓN DE SCRAPING DE VEHÍCULOS
==========================================

Uso: node run-automation.js [opciones]

Opciones:
  --help, -h     Mostrar esta ayuda
  --stats, -s    Mostrar estadísticas de la base de datos
  --reset        Resetear todos los estados a 'pending'
  --test         Ejecutar solo 5 combinaciones como prueba

Ejemplos:
  node run-automation.js              # Ejecutar automatización completa
  node run-automation.js --stats      # Ver estadísticas
  node run-automation.js --test       # Prueba con 5 combinaciones
  node run-automation.js --reset      # Resetear estados

Variables de entorno requeridas (.env):
  DB_HOST=localhost
  DB_USER=root  
  DB_PASSWORD=tu_password
  DB_NAME=vehiculos_colombia

📊 La automatización procesará ${Object.keys(require('./vehiculos-colombia')).length} marcas
con un total de ${Object.values(require('./vehiculos-colombia')).reduce((sum, modelos) => sum + modelos.length, 0)} combinaciones marca/modelo.
  `);
}

// Función para mostrar estadísticas
async function showStats() {
  console.log('📊 Obteniendo estadísticas...');
  
  const VehiculosDatabase = require('./database');
  const db = new VehiculosDatabase();
  
  try {
    await db.initialize();
    const stats = await db.getStats();
    
    console.log(`
📊 ============ ESTADÍSTICAS ACTUALES ============
🚗 Total vehículos: ${stats.totalVehiculos}
🏢 Marcas únicas: ${stats.totalMarcas}  
🚙 Modelos únicos: ${stats.totalModelos}
📅 Último scraping: ${stats.ultimoScrape || 'N/A'}

📈 Estado de combinaciones:
${Object.entries(stats.statusDistribution || {})
  .map(([status, count]) => `   ${getStatusIcon(status)} ${status}: ${count}`)
  .join('\n')}
===============================================
    `);
    
    await db.close();
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
  }
}

function getStatusIcon(status) {
  const icons = {
    'pending': '⏳',
    'processing': '🔄', 
    'completed': '✅',
    'error': '❌'
  };
  return icons[status] || '❓';
}

// Función para resetear estados
async function resetStates() {
  console.log('🔄 Reseteando todos los estados a pending...');
  
  const VehiculosDatabase = require('./database');
  const db = new VehiculosDatabase();
  
  try {
    await db.initialize();
    await db.connection.execute(`
      UPDATE scraping_control 
      SET status = 'pending', error_message = NULL 
      WHERE status IN ('error', 'processing')
    `);
    console.log('✅ Estados reseteados exitosamente');
    await db.close();
  } catch (error) {
    console.error('❌ Error reseteando estados:', error.message);
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  // Procesar argumentos
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--stats') || args.includes('-s')) {
    await showStats();
    return;
  }
  
  if (args.includes('--reset')) {
    await resetStates();
    return;
  }
  
  const isTest = args.includes('--test');
  
  try {
    console.log('🤖 Iniciando automatización de scraping de vehículos...');
    console.log(`📅 Fecha y hora: ${new Date().toLocaleString()}`);
    
    if (isTest) {
      console.log('🧪 MODO PRUEBA: Solo se procesarán 5 combinaciones');
      automation.config.maxRequestsPerHour = 10;
      automation.stats.totalCombinaciones = 5;
    }
    
    // Verificar variables de entorno
    const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Variables de entorno faltantes: ${missingVars.join(', ')}`);
      console.error('💡 Crea un archivo .env con las variables necesarias');
      process.exit(1);
    }
    
    await automation.initialize();
    
    if (isTest) {
      // Limitar la cola para prueba
      automation.queue = automation.queue.slice(0, 5);
      automation.stats.totalCombinaciones = automation.queue.length;
    }
    
    console.log('\n🎯 Presiona Ctrl+C para detener la automatización de manera segura\n');
    
    await automation.start();
    
  } catch (error) {
    console.error('💥 Error crítico en automatización:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { VehicleScrapingAutomation, showStats, resetStates };