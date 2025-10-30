const VEHICULOS_COLOMBIA = require('./vehiculos-colombia');
const VehiculosDatabase = require('./database');

// Importar funciones de scraping del archivo principal
const axios = require('axios');
const cheerio = require('cheerio');

// Función para obtener User-Agent aleatorio
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Función de scraping directo simplificada
async function scrapeDirectlySimple(marca, modelo) {
  const tiempoInicio = Date.now();
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`🔍 Scraping: ${marca} ${modelo}`);

  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const $ = cheerio.load(response.data);

    // Detectar paginación
    let totalPaginas = 1;
    $('.andes-pagination__button a').each((index, element) => {
      const pageText = $(element).text().trim();
      if (/^\d+$/.test(pageText)) {
        const pageNum = parseInt(pageText);
        if (pageNum > totalPaginas) {
          totalPaginas = pageNum;
        }
      }
    });

    let todosLosProductos = [];

    // Procesar todas las páginas (máximo 10 para evitar timeouts)
    const maxPaginas = Math.min(totalPaginas, 10);
    
    for (let pagina = 1; pagina <= maxPaginas; pagina++) {
      try {
        let urlPagina;
        if (pagina === 1) {
          urlPagina = url;
        } else {
          const offset = (pagina - 1) * 48 + 1;
          urlPagina = `${url}_Desde_${offset}`;
        }

        const pageResponse = await axios.get(urlPagina, { headers, timeout: 25000 });
        const $page = cheerio.load(pageResponse.data);

        $page('.ui-search-layout__item').each((index, element) => {
          const $element = $page(element);
          
          // Extraer descripción
          let descripcion = $element.find('img[title]').attr('title') || '';
          if (!descripcion) descripcion = $element.find('.ui-search-item__title').text().trim();
          if (!descripcion) descripcion = $element.find('h2').text().trim();
          
          // Extraer precio
          let precio = $element.find('.andes-money-amount__fraction').text().trim();
          if (!precio) precio = $element.find('.poly-price__current').text().trim();
          
          // Extraer ubicación
          let ubicacion = $element.find('.ui-search-item__location').text().trim();
          if (!ubicacion) ubicacion = $element.find('.poly-component__location').text().trim();
          
          // Extraer link
          let link = $element.find('a').first().attr('href');
          if (link && !link.startsWith('http')) {
            link = 'https://vehiculos.tucarro.com.co' + link;
          }
          
          // Extraer año del selector específico
          let year = null;
          $element.find('.poly-attributes_list__item.poly-attributes_list__separator').each((i, attr) => {
            const text = $page(attr).text().trim();
            const yearMatch = text.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0]);
              return false;
            }
          });
          
          // Fallback para año en el título
          if (!year && descripcion) {
            const yearMatch = descripcion.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
            if (yearMatch) year = parseInt(yearMatch[0]);
          }
          
          // Extraer kilometraje
          let kilometraje = null;
          const kmMatch = (descripcion + ' ' + ubicacion).match(/\d+[\.,]?\d*\s*km/i);
          if (kmMatch) kilometraje = kmMatch[0];

          if (descripcion && precio) {
            todosLosProductos.push({
              descripcion,
              precio,
              precio_numero: parseInt(precio.replace(/\D/g, '') || '0'),
              ubicacion,
              link,
              year,
              kilometraje,
              marca,
              modelo
            });
          }
        });

        // Pequeña pausa entre páginas
        if (pagina < maxPaginas) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }

      } catch (pageError) {
        console.error(`❌ Error en página ${pagina}:`, pageError.message);
        continue;
      }
    }

    const tiempoTotal = Date.now() - tiempoInicio;
    console.log(`✅ ${marca} ${modelo}: ${todosLosProductos.length} productos en ${maxPaginas} páginas - ${tiempoTotal}ms`);

    return {
      success: true,
      method: 'direct_scraping',
      marca,
      modelo,
      total_resultados: todosLosProductos.length,
      productos: todosLosProductos,
      tiempo_total_ms: tiempoTotal,
      paginas_procesadas: maxPaginas
    };

  } catch (error) {
    const tiempoTotal = Date.now() - tiempoInicio;
    console.error(`❌ Error scraping ${marca} ${modelo}:`, error.message);
    
    return {
      success: false,
      method: 'direct_scraping',
      error: error.message,
      marca,
      modelo,
      tiempo_total_ms: tiempoTotal
    };
  }
}

class VehicleScrapingAutomation {
  constructor() {
    this.db = new VehiculosDatabase();
    this.isRunning = false;
    this.stats = {
      totalCombinaciones: 0,
      procesados: 0,
      exitosos: 0,
      errores: 0,
      saltados: 0,
      startTime: null,
      currentMarca: '',
      currentModelo: ''
    };
    
    // Configuración anti-bloqueo
    this.config = {
      delayBetweenRequests: {
        min: 15000,  // 15 segundos mínimo
        max: 45000   // 45 segundos máximo
      },
      
      maxRequestsPerHour: 30, // Más conservador
      requestCount: 0,
      hourStart: Date.now(),
      
      // Horarios de trabajo (24 horas, pero con pausas)
      workingHours: {
        start: 0,
        end: 23
      },
      
      // Pausa larga cada cierto número de requests
      longPauseAfter: 10, // Cada 10 requests
      longPauseDuration: 300000 // 5 minutos
    };

    this.queue = [];
  }

  async initialize() {
    console.log('🤖 ===== INICIALIZANDO AUTOMATIZACIÓN =====');
    
    // Inicializar base de datos
    await this.db.initialize();
    
    // Crear cola de trabajo
    await this.createWorkQueue();
    
    console.log(`📊 Configuración:`);
    console.log(`   🚗 Total combinaciones: ${this.stats.totalCombinaciones}`);
    console.log(`   ⏰ Delay entre requests: ${this.config.delayBetweenRequests.min/1000}-${this.config.delayBetweenRequests.max/1000}s`);
    console.log(`   🚦 Requests por hora: ${this.config.maxRequestsPerHour}`);
    console.log(`   🛑 Pausa larga cada: ${this.config.longPauseAfter} requests`);
  }

  async createWorkQueue() {
    this.queue = [];
    let totalCombinaciones = 0;

    // Obtener trabajo pendiente de la BD
    const pendingWork = await this.db.getPendingWork();
    console.log(`📋 Trabajo pendiente en BD: ${pendingWork.length} combinaciones`);

    if (pendingWork.length > 0) {
      // Usar trabajo pendiente primero
      this.queue = pendingWork.map(row => ({
        marca: row.marca,
        modelo: row.modelo,
        lastScrape: row.last_scrape,
        status: row.status
      }));
      totalCombinaciones = pendingWork.length;
    } else {
      // Crear cola completa desde el archivo
      console.log('📋 Creando cola completa desde vehiculos-colombia.js...');
      
      for (const [marca, modelos] of Object.entries(VEHICULOS_COLOMBIA)) {
        for (const modelo of modelos) {
          // Verificar si ya existe y está actualizado
          const exists = await this.db.checkIfExists(marca, modelo);
          if (!exists || await this.db.shouldUpdate(exists)) {
            this.queue.push({ marca, modelo });
            totalCombinaciones++;
          }
        }
      }
    }

    // Mezclar aleatoriamente para evitar patrones
    this.queue = this.shuffleArray(this.queue);
    this.stats.totalCombinaciones = totalCombinaciones;

    console.log(`📋 Cola final: ${totalCombinaciones} combinaciones para procesar`);
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async intelligentDelay() {
    // Control de rate limiting por hora
    const now = Date.now();
    const hourElapsed = now - this.config.hourStart;
    
    if (hourElapsed >= 3600000) { // Reset cada hora
      this.config.requestCount = 0;
      this.config.hourStart = now;
    }
    
    if (this.config.requestCount >= this.config.maxRequestsPerHour) {
      const waitTime = 3600000 - hourElapsed;
      console.log(`🚦 Límite horario alcanzado. Esperando ${Math.round(waitTime/1000/60)} minutos...`);
      await this.sleep(waitTime);
      this.config.requestCount = 0;
      this.config.hourStart = Date.now();
    }

    // Pausa larga cada cierto número de requests
    if (this.stats.procesados > 0 && this.stats.procesados % this.config.longPauseAfter === 0) {
      console.log(`😴 Pausa larga después de ${this.stats.procesados} requests (${this.config.longPauseDuration/1000/60} min)...`);
      await this.sleep(this.config.longPauseDuration);
    }

    this.config.requestCount++;

    // Delay aleatorio normal
    const delay = Math.floor(
      Math.random() * (this.config.delayBetweenRequests.max - this.config.delayBetweenRequests.min) + 
      this.config.delayBetweenRequests.min
    );

    await this.sleep(delay);
  }

  async sleep(ms) {
    return new Promise(resolve => {
      const seconds = Math.round(ms/1000);
      if (seconds > 5) {
        console.log(`⏳ Esperando ${seconds}s...`);
      }
      setTimeout(resolve, ms);
    });
  }

  showStats() {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedHours = elapsed / (1000 * 60 * 60);
    const remaining = this.stats.totalCombinaciones - this.stats.procesados;
    const rate = this.stats.procesados / Math.max(elapsedHours, 0.001);
    const estimatedTimeRemaining = remaining / Math.max(rate, 0.001);

    console.log(`
📊 ============ PROGRESO AUTOMATIZACIÓN ============
🎯 Progreso: ${this.stats.procesados}/${this.stats.totalCombinaciones} (${((this.stats.procesados/this.stats.totalCombinaciones)*100).toFixed(1)}%)
✅ Exitosos: ${this.stats.exitosos}
⏭️ Saltados (actualizados): ${this.stats.saltados}
❌ Errores: ${this.stats.errores}
⏰ Tiempo transcurrido: ${elapsedHours.toFixed(1)} horas
🚀 Velocidad: ${rate.toFixed(1)} combinaciones/hora
⏳ Tiempo estimado restante: ${estimatedTimeRemaining.toFixed(1)} horas
🔄 Procesando: ${this.stats.currentMarca} ${this.stats.currentModelo}
🚦 Requests esta hora: ${this.config.requestCount}/${this.config.maxRequestsPerHour}
================================================
    `);
  }

  async start() {
    console.log('🚀 ===== INICIANDO AUTOMATIZACIÓN =====');
    console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
    
    this.stats.startTime = Date.now();
    this.isRunning = true;

    while (this.queue.length > 0 && this.isRunning) {
      const { marca, modelo } = this.queue.shift();
      
      this.stats.currentMarca = marca;
      this.stats.currentModelo = modelo;

      try {
        console.log(`\n🔍 [${this.stats.procesados + 1}/${this.stats.totalCombinaciones}] ${marca} ${modelo}`);
        
        // Verificar si ya existe y está actualizado
        const exists = await this.db.checkIfExists(marca, modelo);
        if (exists && !await this.db.shouldUpdate(exists)) {
          console.log(`⏭️ ${marca} ${modelo} ya está actualizado, saltando...`);
          this.stats.saltados++;
          this.stats.procesados++;
          continue;
        }

        // Marcar como processing
        await this.db.markAsProcessing(marca, modelo);

        // Realizar scraping
        const resultado = await scrapeDirectlySimple(marca, modelo);

        if (resultado.success && resultado.productos && resultado.productos.length > 0) {
          // Guardar en base de datos
          const saveResult = await this.db.saveVehicleData(marca, modelo, resultado);
          
          if (saveResult.success) {
            console.log(`✅ ${marca} ${modelo}: ${saveResult.total} productos guardados`);
            this.stats.exitosos++;
          } else {
            console.log(`❌ Error guardando ${marca} ${modelo}: ${saveResult.error}`);
            this.stats.errores++;
          }
        } else {
          console.log(`⚠️ ${marca} ${modelo}: Sin productos - ${resultado.error || 'Sin datos'}`);
          await this.db.saveVehicleData(marca, modelo, { productos: [], method: 'no_results' });
          this.stats.errores++;
        }

      } catch (error) {
        console.error(`💥 Error crítico procesando ${marca} ${modelo}:`, error.message);
        this.stats.errores++;
      }

      this.stats.procesados++;
      this.showStats();

      // Delay inteligente antes del siguiente
      if (this.queue.length > 0) {
        await this.intelligentDelay();
      }
    }

    console.log(`🎉 ===== AUTOMATIZACIÓN COMPLETADA =====`);
    await this.showFinalStats();
    await this.db.close();
  }

  async showFinalStats() {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedHours = elapsed / (1000 * 60 * 60);
    const dbStats = await this.db.getStats();

    console.log(`
🎉 ============ RESUMEN FINAL ============
📅 Iniciado: ${new Date(this.stats.startTime).toLocaleString()}
🏁 Finalizado: ${new Date().toLocaleString()}
⏰ Tiempo total: ${elapsedHours.toFixed(2)} horas
🎯 Total procesados: ${this.stats.procesados}
✅ Exitosos: ${this.stats.exitosos}
⏭️ Saltados: ${this.stats.saltados}
❌ Errores: ${this.stats.errores}
📊 Tasa de éxito: ${((this.stats.exitosos/this.stats.procesados)*100).toFixed(1)}%
🚀 Velocidad promedio: ${(this.stats.procesados/elapsedHours).toFixed(1)} combinaciones/hora

📊 ESTADÍSTICAS DE BASE DE DATOS:
🚗 Total vehículos en BD: ${dbStats?.totalVehiculos || 0}
🏢 Marcas únicas: ${dbStats?.totalMarcas || 0}
🚙 Modelos únicos: ${dbStats?.totalModelos || 0}
📅 Último scraping: ${dbStats?.ultimoScrape || 'N/A'}
========================================
    `);
  }

  stop() {
    console.log('⏹️ Deteniendo automatización...');
    this.isRunning = false;
  }
}

module.exports = VehicleScrapingAutomation;