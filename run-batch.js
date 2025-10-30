#!/usr/bin/env node

require('dotenv').config();
const VehicleScrapingAutomation = require('./automation');

// Función para ejecutar automatización por lotes
async function runBatch(batchSize = 50) {
  console.log(`🔥 AUTOMATIZACIÓN POR LOTES: ${batchSize} combinaciones`);
  
  const automation = new VehicleScrapingAutomation();
  
  // Configuración más rápida para lotes
  automation.config.delayBetweenRequests.min = 8000;  // 8 segundos mínimo
  automation.config.delayBetweenRequests.max = 20000; // 20 segundos máximo
  automation.config.maxRequestsPerHour = 60; // Más agresivo
  automation.config.longPauseAfter = 20; // Pausa cada 20 requests
  automation.config.longPauseDuration = 180000; // 3 minutos
  
  try {
    await automation.initialize();
    
    // Limitar la cola al tamaño del lote
    automation.queue = automation.queue.slice(0, batchSize);
    automation.stats.totalCombinaciones = automation.queue.length;
    
    console.log(`📋 Procesando lote de ${automation.queue.length} combinaciones`);
    console.log(`⏰ Tiempo estimado: ~${(automation.queue.length / 60).toFixed(1)} horas`);
    
    await automation.start();
    
  } catch (error) {
    console.error('💥 Error en lote:', error.message);
  }
}

// Manejar argumentos
const args = process.argv.slice(2);
const batchSize = args.includes('--size') ? 
  parseInt(args[args.indexOf('--size') + 1]) || 50 : 50;

if (args.includes('--help')) {
  console.log(`
🔥 AUTOMATIZACIÓN POR LOTES

Uso: node run-batch.js [opciones]

Opciones:
  --size N    Tamaño del lote (default: 50)
  --help      Mostrar ayuda

Ejemplos:
  node run-batch.js             # Lote de 50
  node run-batch.js --size 100  # Lote de 100
  node run-batch.js --size 20   # Lote de 20
  `);
  process.exit(0);
}

// Ejecutar
runBatch(batchSize);