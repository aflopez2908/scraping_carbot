const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Función de scraping directo con selectores actualizados
async function scrapeDirectly(marca, modelo) {
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`🔍 Scraping directo: ${marca} ${modelo}`);
  console.log(`🔗 URL: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });

    console.log(`✅ Respuesta obtenida: ${response.status}`);
    console.log(`📏 Tamaño HTML: ${response.data.length} caracteres`);

    const $ = cheerio.load(response.data);
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

        // Extraer año y kilometraje del título o descripción
        const textoCompleto = descripcion + ' ' + ubicacion;
        const añoMatch = textoCompleto.match(/\b(19|20)\d{2}\b/);
        if (añoMatch) {
          product.año = añoMatch[0];
        }
        
        const kmMatch = textoCompleto.match(/\d+[\.,]?\d*\s*km/i);
        if (kmMatch) {
          product.kilometraje = kmMatch[0];
        }

        products.push(product);
      }
    });

    console.log(`✅ Productos encontrados: ${products.length}`);

    return {
      success: true,
      method: 'direct_scraping',
      marca: marca,
      modelo: modelo,
      total_resultados: products.length,
      productos: products,
      warning: 'Usando scraping directo. Puede ser menos confiable que ScrapingBee.'
    };

  } catch (error) {
    console.error('❌ Error en scraping directo:', error.message);
    return {
      success: false,
      method: 'direct_scraping',
      error: error.message,
      marca: marca,
      modelo: modelo
    };
  }
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

        // Extraer año y kilometraje
        const atributos = $element.find('.ui-search-item__attributes').text();
        if (atributos) {
          const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
          lines.forEach(line => {
            if (line.includes('Km') || line.toLowerCase().includes('km')) {
              product.kilometraje = line;
            } else if (/^\d{4}$/.test(line)) {
              product.año = line;
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
      '/api/vehiculos': 'GET - Buscar vehículos por marca y modelo',
      '/api/vehiculos/:marca/:modelo': 'GET - Buscar vehículos específicos',
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
  console.log(`   GET /api/vehiculos?marca=BMW&modelo=X3`);
  console.log(`   GET /api/vehiculos/BMW/X3`);
  console.log(`   GET /api/status - Estado de ScrapingBee`);
  console.log(`   GET /health - Estado de la API`);
  console.log(`⚠️  Nota: Si ScrapingBee alcanza el límite, se usa scraping directo automáticamente`);
});