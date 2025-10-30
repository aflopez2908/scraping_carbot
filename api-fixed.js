// 🛡️ Pool de User-Agents reales para evitar detección
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// 🎲 Función para obtener User-Agent aleatorio
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ⏰ Función para pausa aleatoria (simular comportamiento humano)
function getRandomDelay(min = 1000, max = 4000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ⏱️ Request directo sin rate limiting
async function rateLimitedRequest(url, headers) {
  return axios.get(url, { headers, timeout: 30000 });
}

// Función de scraping directo con selectores actualizados Y PAGINACIÓN
async function scrapeDirectly(marca, modelo, pagina = 1) {
  const tiempoInicio = Date.now();
  
  // Construir URL con paginación
  let url;
  if (pagina === 1) {
    url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  } else {
    // Formato de paginación de MercadoLibre: _Desde_N
    const offset = (pagina - 1) * 48 + 1;
    url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}_Desde_${offset}`;
  }
  
  console.log(`🔍 Scraping directo: ${marca} ${modelo} - Página ${pagina}`);
  console.log(`🔗 URL: ${url}`);

  try {
    // 🎭 Headers que simulan navegador real
    const userAgent = getRandomUserAgent();
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'es-CO,es-419;q=0.9,es;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
      'DNT': '1'
    };
    
    console.log(`🎭 Usando User-Agent: ${userAgent.split(' ')[0]}...`);

    const response = await rateLimitedRequest(url, headers);

    console.log(`✅ Respuesta obtenida: ${response.status}`);
    console.log(`📏 Tamaño HTML: ${response.data.length} caracteres`);

    const $ = cheerio.load(response.data);
    
    // Detectar número total de páginas
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
    
    console.log(`📊 Páginas detectadas: ${totalPaginas} | Página actual: ${pagina}`);
    
    const products = [];

    $('.ui-search-layout__item').each((index, element) => {
      const $element = $(element);
      
      // Buscar título en diferentes ubicaciones
      let descripcion = $element.find('img[title]').attr('title') || '';
      if (!descripcion) {
        descripcion = $element.find('.poly-component__title').text().trim();
      }
      if (!descripcion) {
        descripcion = $element.find('.ui-search-item__title').text().trim();
      }
      if (!descripcion) {
        descripcion = $element.find('h2').text().trim();
      }
      
      // Buscar precio en diferentes ubicaciones
      let precio = $element.find('.andes-money-amount__fraction').text().trim();
      if (!precio) {
        precio = $element.find('.poly-price__current').text().trim();
      }
      if (!precio) {
        precio = $element.find('[class*="price"]').first().text().trim();
      }
      if (!precio) {
        // Buscar en spans con números que parezcan precios
        $element.find('span').each((i, span) => {
          const text = $(span).text().trim();
          if (/^\$?[\d,.]+(\.000)?$/.test(text) && text.length > 5) {
            precio = text;
            return false; // break
          }
        });
      }
      
      // Buscar ubicación
      let ubicacion = $element.find('.poly-component__location').text().trim();
      if (!ubicacion) {
        ubicacion = $element.find('.ui-search-item__location').text().trim();
      }
      if (!ubicacion) {
        ubicacion = $element.find('[class*="location"]').text().trim();
      }
      
      // Buscar link
      let link = $element.find('a').first().attr('href');
      if (link && !link.startsWith('http')) {
        link = 'https://vehiculos.tucarro.com.co' + link;
      }
      
      // Debug: mostrar lo que encontramos
      if (index < 3) {
        console.log(`🔍 Producto ${index + 1}:`);
        console.log(`   Descripción: "${descripcion}"`);
        console.log(`   Precio: "${precio}"`);
        console.log(`   Ubicación: "${ubicacion}"`);
        console.log(`   Link: "${link}"`);
      }
      
      if (descripcion && precio) {
        const product = {
          id: index + 1,
          descripcion: descripcion,
          precio: precio,
          precio_numero: parseInt(precio.replace(/\D/g, '') || '0'),
          ubicacion: ubicacion,
          link: link,
          marca: marca,
          modelo: modelo
        };

        // 🆕 EXTRAER AÑO del selector específico
        let year = null;
        $element.find('.poly-attributes_list__item.poly-attributes_list__separator').each((i, attr) => {
          const text = $(attr).text().trim();
          // Buscar años entre 1990 y 2025
          const yearMatch = text.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0]);
            return false; // break
          }
        });
        
        // Si no se encuentra en el selector específico, buscar en el título como fallback
        if (!year) {
          const textoCompleto = descripcion + ' ' + ubicacion;
          const añoMatch = textoCompleto.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
          if (añoMatch) {
            year = parseInt(añoMatch[0]);
          }
        }
        
        if (year) {
          product.year = year; // 🆕 CAMPO YEAR
        }
        
        // Extraer kilometraje
        const kmMatch = (descripcion + ' ' + ubicacion).match(/\d+[\.,]?\d*\s*km/i);
        if (kmMatch) {
          product.kilometraje = kmMatch[0];
        }

        products.push(product);
      }
    });

    const tiempoTotal = Date.now() - tiempoInicio;
    
    // 📊 Estadísticas de años detectados
    const productosConYear = products.filter(p => p.year);
    const yearsDetectados = [...new Set(productosConYear.map(p => p.year))].sort();
    
    console.log(`✅ Productos encontrados: ${products.length} - ⏱️ ${tiempoTotal}ms`);
    console.log(`📅 Años detectados: ${yearsDetectados.length > 0 ? yearsDetectados.join(', ') : 'Ninguno'}`);
    console.log(`🎯 Productos con año: ${productosConYear.length}/${products.length} (${((productosConYear.length/products.length)*100).toFixed(1)}%)`);

    return {
      success: true,
      method: 'direct_scraping',
      marca: marca,
      modelo: modelo,
      pagina_actual: pagina,
      total_paginas_detectadas: totalPaginas,
      total_resultados: products.length,
      years_detectados: yearsDetectados,
      total_con_year: productosConYear.length,
      porcentaje_con_year: parseFloat(((productosConYear.length/products.length)*100).toFixed(1)),
      tiempo_procesamiento_ms: tiempoTotal,
      productos: products,
      warning: 'Usando scraping directo. Puede ser menos confiable que ScrapingBee.'
    };

  } catch (error) {
    console.error('❌ Error en scraping directo:', error.message);
    
    // 🚫 Manejar diferentes tipos de bloqueo
    let errorType = 'unknown';
    let retryAfter = 0;
    
    if (error.response) {
      const status = error.response.status;
      if (status === 429) {
        errorType = 'rate_limited';
        retryAfter = error.response.headers['retry-after'] || 60;
        console.log(`🚦 Rate limited! Retry después de ${retryAfter} segundos`);
      } else if (status === 403) {
        errorType = 'blocked';
        console.log(`🚫 IP/User-Agent bloqueado`);
      } else if (status === 503) {
        errorType = 'service_unavailable';
        console.log(`⚠️ Servicio no disponible temporalmente`);
      }
    }
    
    return {
      success: false,
      method: 'direct_scraping',
      error: error.message,
      error_type: errorType,
      retry_after: retryAfter,
      marca: marca,
      modelo: modelo
    };
  }
}

// 🚀 FUNCIÓN SUPER INTELIGENTE CON SCRAPINGBEE: Obtiene TODAS las páginas automáticamente
async function scrapeAllPagesWithScrapingBee(marca, modelo) {
  const tiempoInicio = Date.now();
  console.log(`🤖 Iniciando scraping COMPLETO con ScrapingBee: ${marca} ${modelo}`);
  console.log(`⏰ Inicio: ${new Date().toLocaleTimeString()}`);
  
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  
  try {
    // 1. Primero intentar con ScrapingBee para detectar el número total de páginas
    console.log(`🔄 Intentando detectar páginas con ScrapingBee...`);
    const urlPrimera = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
    
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': apiKey,
        'url': urlPrimera,
        'render_js': 'false',
        'premium_proxy': 'true',
        'country_code': 'co',
        'block_ads': 'true',
        'timeout': '30000'
      },
      timeout: 40000
    });

    console.log('✅ ScrapingBee respondió correctamente para detección de páginas');
    const $ = cheerio.load(response.data);
    
    // Detectar número total de páginas
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
    
    console.log(`🎯 Páginas detectadas con ScrapingBee: ${totalPaginas}`);
    
    // 2. Obtener todos los productos de todas las páginas usando ScrapingBee
    let todosLosProductos = [];
    
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      const tiempoPaginaInicio = Date.now();
      console.log(`📄 Procesando página ${pagina} de ${totalPaginas} con ScrapingBee...`);
      
      try {
        let urlPagina;
        if (pagina === 1) {
          urlPagina = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
        } else {
          const offset = (pagina - 1) * 48 + 1;
          urlPagina = `https://vehiculos.tucarro.com.co/${marca}/${modelo}_Desde_${offset}`;
        }
        
        const pageResponse = await axios.get('https://app.scrapingbee.com/api/v1/', {
          params: {
            'api_key': apiKey,
            'url': urlPagina,
            'render_js': 'false',
            'premium_proxy': 'true',
            'country_code': 'co',
            'block_ads': 'true',
            'timeout': '30000'
          },
          timeout: 40000
        });
        
        const $page = cheerio.load(pageResponse.data);
        const productosEnPagina = [];

        $page('.ui-search-layout__item').each((index, element) => {
          const $element = $page(element);
          
          const descripcion = $element.find('.ui-search-item__title').text().trim();
          const precio = $element.find('.andes-money-amount__fraction').text().trim();
          
          if (descripcion && precio) {
            const product = {
              id: todosLosProductos.length + index + 1,
              descripcion: descripcion,
              precio: precio,
              precio_numero: parseInt(precio.replace(/\./g, '') || '0'),
              ubicacion: $element.find('.ui-search-item__location').text().trim(),
              link: $element.find('a').attr('href'),
              marca: marca,
              modelo: modelo,
              pagina: pagina
            };

            // 🆕 EXTRAER AÑO del selector específico
            let year = null;
            $element.find('.poly-attributes_list__item.poly-attributes_list__separator').each((i, attr) => {
              const text = $page(attr).text().trim();
              // Buscar años entre 1990 y 2025
              const yearMatch = text.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
              if (yearMatch) {
                year = parseInt(yearMatch[0]);
                return false; // break
              }
            });
            
            // Fallback: buscar año en atributos generales
            if (!year) {
              const atributos = $element.find('.ui-search-item__attributes').text();
              if (atributos) {
                const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
                lines.forEach(line => {
                  if (/^(19[9][0-9]|20[0-2][0-9])$/.test(line)) {
                    year = parseInt(line);
                  }
                });
              }
            }
            
            if (year) {
              product.year = year; // 🆕 CAMPO YEAR
            }
            
            // Extraer kilometraje
            const atributos = $element.find('.ui-search-item__attributes').text();
            if (atributos) {
              const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
              lines.forEach(line => {
                if (line.includes('Km') || line.toLowerCase().includes('km')) {
                  product.kilometraje = line;
                }
              });
            }

            productosEnPagina.push(product);
          }
        });
        
        todosLosProductos = todosLosProductos.concat(productosEnPagina);
        const tiempoPagina = Date.now() - tiempoPaginaInicio;
        console.log(`✅ Página ${pagina}: ${productosEnPagina.length} productos (Total: ${todosLosProductos.length}) - ⏱️ ${tiempoPagina}ms`);
        
      } catch (pageError) {
        console.error(`❌ Error en página ${pagina} con ScrapingBee:`, pageError.message);
        // Si falla una página específica, continuar con las siguientes
        continue;
      }
    }
    
    const tiempoTotal = Date.now() - tiempoInicio;
    console.log(`🎉 SCRAPING COMPLETO CON SCRAPINGBEE: ${todosLosProductos.length} productos en ${totalPaginas} páginas`);
    console.log(`⏰ Tiempo total: ${tiempoTotal}ms (${(tiempoTotal/1000).toFixed(2)}s)`);
    console.log(`📊 Promedio por página: ${(tiempoTotal/totalPaginas).toFixed(0)}ms`);
    
    return {
      success: true,
      method: 'scrapingbee_complete',
      marca: marca,
      modelo: modelo,
      total_resultados: todosLosProductos.length,
      paginas_procesadas: totalPaginas,
      paginas_detectadas: totalPaginas,
      tiempo_total_ms: tiempoTotal,
      tiempo_total_segundos: (tiempoTotal/1000).toFixed(2),
      tiempo_promedio_por_pagina_ms: (tiempoTotal/totalPaginas).toFixed(0),
      productos: todosLosProductos
    };
    
  } catch (error) {
    console.error('❌ Error con ScrapingBee completo:', error.message);
    
    // Si ScrapingBee falla, usar fallback a scraping directo
    console.log('⚠️ ScrapingBee falló, cambiando a scraping directo completo...');
    return await scrapeAllPagesAuto(marca, modelo);
  }
}

// 🚀 FUNCIÓN SUPER INTELIGENTE: Obtiene TODAS las páginas automáticamente (FALLBACK)
async function scrapeAllPagesAuto(marca, modelo) {
  const tiempoInicio = Date.now();
  console.log(`🤖 Iniciando scraping COMPLETO directo: ${marca} ${modelo}`);
  console.log(`⏰ Inicio: ${new Date().toLocaleTimeString()}`);
  
  // 1. Obtener primera página para detectar cuántas páginas hay
  console.log(`📡 Detectando número total de páginas...`);
  const primeraPagina = await scrapeDirectly(marca, modelo, 1);
  
  if (!primeraPagina.success || !primeraPagina.productos || primeraPagina.productos.length === 0) {
    return {
      success: false,
      error: 'No se encontraron resultados en la primera página',
      marca: marca,
      modelo: modelo
    };
  }
  
  const totalPaginasDetectadas = primeraPagina.total_paginas_detectadas || 1;
  console.log(`🎯 Páginas detectadas automáticamente: ${totalPaginasDetectadas}`);
  console.log(`🔢 Total real esperado: ${totalPaginasDetectadas * 48} productos aproximadamente`);
  
  let todosLosProductos = [...primeraPagina.productos];
  console.log(`✅ Página 1: ${primeraPagina.productos.length} productos`);
  
  // Si solo hay 1 página, retornar inmediatamente
  if (totalPaginasDetectadas <= 1) {
    console.log(`🏁 Solo 1 página detectada, finalizando.`);
    return {
      success: true,
      marca: marca,
      modelo: modelo,
      total_resultados: todosLosProductos.length,
      paginas_procesadas: 1,
      paginas_detectadas: totalPaginasDetectadas,
      productos: todosLosProductos
    };
  }
  
  // 2. Procesar las páginas restantes
  for (let pagina = 2; pagina <= totalPaginasDetectadas; pagina++) {
    const tiempoPaginaInicio = Date.now();
    console.log(`📄 Procesando página ${pagina} de ${totalPaginasDetectadas}...`);
    
    try {
      const resultado = await scrapeDirectly(marca, modelo, pagina);
      
      if (resultado.success && resultado.productos && resultado.productos.length > 0) {
        todosLosProductos = todosLosProductos.concat(resultado.productos);
        const tiempoPagina = Date.now() - tiempoPaginaInicio;
        console.log(`✅ Página ${pagina}: ${resultado.productos.length} productos (Total: ${todosLosProductos.length}) - ⏱️ ${tiempoPagina}ms`);
      } else if (resultado.error_type === 'rate_limited') {
        // 🚦 Si fuimos rate-limited, saltear esta página
        console.log(`🚦 Rate limited en página ${pagina}, saltando...`);
        continue;
      } else {
        console.log(`⚠️ Página ${pagina}: Sin resultados - ${resultado.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error(`❌ Error en página ${pagina}:`, error.message);
    }
  }
  
  const tiempoTotal = Date.now() - tiempoInicio;
  console.log(`🎉 SCRAPING COMPLETO: ${todosLosProductos.length} productos en ${totalPaginasDetectadas} páginas`);
  console.log(`⏰ Tiempo total: ${tiempoTotal}ms (${(tiempoTotal/1000).toFixed(2)}s)`);
  console.log(`📊 Promedio por página: ${(tiempoTotal/totalPaginasDetectadas).toFixed(0)}ms`);
  
  return {
    success: true,
    method: 'direct_scraping_complete',
    marca: marca,
    modelo: modelo,
    total_resultados: todosLosProductos.length,
    paginas_procesadas: totalPaginasDetectadas,
    paginas_detectadas: totalPaginasDetectadas,
    tiempo_total_ms: tiempoTotal,
    tiempo_total_segundos: (tiempoTotal/1000).toFixed(2),
    tiempo_promedio_por_pagina_ms: (tiempoTotal/totalPaginasDetectadas).toFixed(0),
    productos: todosLosProductos
  };
}

// Función principal con fallback mejorado
async function scrapeVehicles(marca, modelo) {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`🔍 Buscando: ${marca} ${modelo}`);

  try {
    console.log('🔄 Intentando con ScrapingBee...');
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': apiKey,
        'url': url,
        'render_js': 'false',
        'premium_proxy': 'true',
        'country_code': 'co',
        'block_ads': 'true',
        'timeout': '30000'
      },
      timeout: 40000
    });

    console.log('✅ ScrapingBee respondió correctamente');
    
    const $ = cheerio.load(response.data);
    const products = [];

    $('.ui-search-layout__item').each((index, element) => {
      const $element = $(element);
      
      const descripcion = $element.find('.ui-search-item__title').text().trim();
      const precio = $element.find('.andes-money-amount__fraction').text().trim();
      
      if (descripcion && precio) {
        const product = {
          id: index + 1,
          descripcion: descripcion,
          precio: precio,
          precio_numero: parseInt(precio.replace(/\./g, '') || '0'),
          ubicacion: $element.find('.ui-search-item__location').text().trim(),
          link: $element.find('a').attr('href'),
          marca: marca,
          modelo: modelo
        };

        // 🆕 EXTRAER AÑO del selector específico
        let year = null;
        $element.find('.poly-attributes_list__item.poly-attributes_list__separator').each((i, attr) => {
          const text = $(attr).text().trim();
          // Buscar años entre 1990 y 2025
          const yearMatch = text.match(/\b(19[9][0-9]|20[0-2][0-9])\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0]);
            return false; // break
          }
        });
        
        // Fallback: buscar año en atributos generales
        if (!year) {
          const atributos = $element.find('.ui-search-item__attributes').text();
          if (atributos) {
            const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
            lines.forEach(line => {
              if (/^(19[9][0-9]|20[0-2][0-9])$/.test(line)) {
                year = parseInt(line);
              }
            });
          }
        }
        
        if (year) {
          product.year = year; // 🆕 CAMPO YEAR
        }
        
        // Extraer kilometraje
        const atributos = $element.find('.ui-search-item__attributes').text();
        if (atributos) {
          const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
          lines.forEach(line => {
            if (line.includes('Km') || line.toLowerCase().includes('km')) {
              product.kilometraje = line;
            }
          });
        }

        products.push(product);
      }
    });

    return {
      success: true,
      method: 'scrapingbee',
      marca: marca,
      modelo: modelo,
      total_resultados: products.length,
      productos: products
    };

  } catch (error) {
    console.error('❌ Error con ScrapingBee:', error.message);
    
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data;
      console.log('🔴 Respuesta de error:', errorData);
      
      if (errorData.message && errorData.message.includes('limit reached')) {
        console.log('⚠️ Límite de ScrapingBee alcanzado, cambiando a scraping directo...');
        return await scrapeDirectly(marca, modelo);
      }
    }
    
    // Para cualquier otro error, también intentar scraping directo
    console.log('⚠️ ScrapingBee falló, intentando scraping directo...');
    return await scrapeDirectly(marca, modelo);
  }
}

// Función para verificar estado de ScrapingBee
async function checkScrapingBeeStatus() {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  
  try {
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': apiKey,
        'url': 'https://httpbin.org/ip', // URL simple para test
        'render_js': 'false'
      },
      timeout: 10000
    });

    return {
      available: true,
      status: 'OK',
      calls_remaining: response.headers['spb-calls-remaining'] || 'No disponible'
    };

  } catch (error) {
    let status = 'Error desconocido';
    
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data;
      if (errorData.message && errorData.message.includes('limit reached')) {
        status = 'Límite mensual alcanzado';
      } else {
        status = 'API key inválida';
      }
    }

    return {
      available: false,
      status: status,
      error: error.message
    };
  }
}

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: '🚗 API de Scraping de Vehículos - Versión Mejorada',
    endpoints: {
      '/api/vehiculos': 'GET - Buscar vehículos por marca y modelo (1 página)',
      '/api/vehiculos/:marca/:modelo': 'GET - Buscar vehículos específicos (1 página)',
      '/api/vehiculos/completo/:marca/:modelo': 'GET - 🚀 OBTENER TODOS LOS RESULTADOS (todas las páginas)',
      '/api/status': 'GET - Estado de ScrapingBee',
      '/health': 'GET - Estado de la API'
    },
    ejemplo: '/api/vehiculos/BMW/X3',
    nota: 'Esta API maneja automáticamente el límite de ScrapingBee usando scraping directo como fallback'
  });
});

// Ruta para verificar estado de ScrapingBee
app.get('/api/status', async (req, res) => {
  try {
    const status = await checkScrapingBeeStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

// Ruta para buscar vehículos
app.get('/api/vehiculos', async (req, res) => {
  const { marca, modelo } = req.query;

  if (!marca || !modelo) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren los parámetros "marca" y "modelo"'
    });
  }

  try {
    const resultado = await scrapeVehicles(marca.toUpperCase(), modelo.toUpperCase());
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta alternativa con parámetros en la URL
app.get('/api/vehiculos/:marca/:modelo', async (req, res) => {
  const { marca, modelo } = req.params;
  const tiempoInicioRuta = Date.now();

  try {
    const resultado = await scrapeVehicles(marca.toUpperCase(), modelo.toUpperCase());
    
    const tiempoTotalRuta = Date.now() - tiempoInicioRuta;
    resultado.tiempo_total_ruta_ms = tiempoTotalRuta;
    resultado.tiempo_total_ruta_segundos = (tiempoTotalRuta/1000).toFixed(2);
    
    console.log(`🏁 Request completado en ${tiempoTotalRuta}ms (${(tiempoTotalRuta/1000).toFixed(2)}s)`);
    res.json(resultado);
  } catch (error) {
    const tiempoError = Date.now() - tiempoInicioRuta;
    console.log(`❌ Request falló después de ${tiempoError}ms`);
    res.status(500).json({
      success: false,
      error: error.message,
      tiempo_hasta_error_ms: tiempoError
    });
  }
});

// 🚀 NUEVA RUTA: Obtener TODOS los resultados (todas las páginas) CON FALLBACK
app.get('/api/vehiculos/completo/:marca/:modelo', async (req, res) => {
  const { marca, modelo } = req.params;
  const tiempoInicioRuta = Date.now();

  try {
    console.log(`🚀 Iniciando scraping COMPLETO con fallback para ${marca} ${modelo}`);
    const resultado = await scrapeAllPagesWithScrapingBee(marca.toUpperCase(), modelo.toUpperCase());
    
    const tiempoTotalRuta = Date.now() - tiempoInicioRuta;
    resultado.tiempo_total_ruta_ms = tiempoTotalRuta;
    resultado.tiempo_total_ruta_segundos = (tiempoTotalRuta/1000).toFixed(2);
    
    console.log(`🏁 Request completado en ${tiempoTotalRuta}ms (${(tiempoTotalRuta/1000).toFixed(2)}s)`);
    res.json(resultado);
  } catch (error) {
    const tiempoError = Date.now() - tiempoInicioRuta;
    console.log(`❌ Request falló después de ${tiempoError}ms`);
    res.status(500).json({
      success: false,
      error: error.message,
      tiempo_hasta_error_ms: tiempoError
    });
  }
});

// 🚨 Ruta para testear si estamos bloqueados
app.get('/api/test-blocking', async (req, res) => {
  try {
    console.log('🧪 Testeando si estamos bloqueados por MercadoLibre...');
    const resultado = await scrapeDirectly('BMW', 'X3', 1);
    
    res.json({
      blocked: !resultado.success,
      error_type: resultado.error_type || null,
      message: resultado.success ? 
        '✅ No estamos bloqueados' : 
        `🚫 Posible bloqueo: ${resultado.error}`,
      details: resultado
    });
  } catch (error) {
    res.status(500).json({
      blocked: true,
      error: error.message
    });
  }
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Vehicle Scraping API (Enhanced)',
    version: '2.0'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API ejecutándose en http://localhost:${PORT}`);
  console.log(`📚 Endpoints disponibles:`);
  console.log(`   🔍 1 página (45-48 resultados):`);
  console.log(`      GET /api/vehiculos?marca=BMW&modelo=X3`);
  console.log(`      GET /api/vehiculos/BMW/X3`);
  console.log(`   🚀 TODOS los resultados (300+ resultados):`);
  console.log(`      GET /api/vehiculos/completo/BMW/X3`);
  console.log(`   📊 Estado:`);
  console.log(`      GET /api/status - Estado de ScrapingBee`);
  console.log(`      GET /health - Estado de la API`);
  console.log(`⚠️  Nota: Si ScrapingBee alcanza el límite, se usa scraping directo automáticamente`);
});