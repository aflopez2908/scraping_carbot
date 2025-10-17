const express = require('express');
const cors = require('cors');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Función para hacer requests
function makeRequest(url, params) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL('https://app.scrapingbee.com/api/v1/');
    
    Object.keys(params).forEach(key => {
      urlObj.searchParams.append(key, params[key]);
    });

    const options = {
      method: 'GET',
      timeout: 30000
    };

    const req = https.request(urlObj, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Función mejorada para extraer datos JSON
function extractProductsFromHTML(html) {
  const products = [];
  
  // Buscar todos los objetos JSON que contengan POLYCARD
  const jsonRegex = /\{"id":"POLYCARD"[^}]+"components":\[[^\]]+\][^}]+\}/g;
  const jsonMatches = html.match(jsonRegex);
  
  if (!jsonMatches) {
    console.log('❌ No se encontraron datos JSON');
    return products;
  }

  console.log(`📊 Datos JSON encontrados: ${jsonMatches.length}`);

  jsonMatches.forEach((jsonStr, index) => {
    try {
      const data = JSON.parse(jsonStr);
      
      if (data.polycard && data.polycard.components) {
        const titleComp = data.polycard.components.find(c => c.type === 'title');
        const priceComp = data.polycard.components.find(c => c.type === 'price');
        const attrsComp = data.polycard.components.find(c => c.type === 'attributes_list');
        const locationComp = data.polycard.components.find(c => c.type === 'location');
        
        if (titleComp && priceComp && priceComp.price && priceComp.price.current_price) {
          const product = {
            id: products.length + 1,
            descripcion: titleComp.title?.text || '',
            precio: formatPrice(priceComp.price.current_price.value),
            precio_numero: priceComp.price.current_price.value,
            moneda: priceComp.price.current_price.currency || 'COP',
            ubicacion: locationComp?.location?.text || '',
            link: data.polycard.metadata?.url ? 
                  `https://${data.polycard.metadata.url.replace(/\\u002F/g, '/')}` : '',
            imagen: data.polycard.pictures?.pictures?.[0]?.id ? 
                   `https://http2.mlstatic.com/D_${data.polycard.pictures.pictures[0].id}-O.jpg` : ''
          };
          
          // Extraer año y kilometraje
          if (attrsComp?.attributes_list?.texts) {
            attrsComp.attributes_list.texts.forEach(text => {
              if (text && typeof text === 'string') {
                if (/\b(19|20)\d{2}\b/.test(text)) {
                  product.año = text;
                } else if (text.includes('Km') || text.includes('km')) {
                  product.kilometraje = text;
                }
              }
            });
          }
          
          // Solo agregar si tiene información válida
          if (product.descripcion && product.precio_numero > 0) {
            products.push(product);
            console.log(`✅ Producto ${product.id}: ${product.descripcion.substring(0, 40)}... - $${product.precio}`);
          }
        }
      }
    } catch (e) {
      console.log(`❌ Error parseando JSON ${index}: ${e.message}`);
    }
  });

  return products;
}

// Función para formatear precio
function formatPrice(price) {
  return new Intl.NumberFormat('es-CO').format(price);
}

// Función principal de scraping
async function scrapeVehicles(marca, modelo) {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`\n🔍 BUSCANDO: ${marca} ${modelo}`);
  console.log(`🔗 URL: ${url}`);

  try {
    const html = await makeRequest(url, {
      'api_key': apiKey,
      'url': url,
      'render_js': 'false',
      'premium_proxy': 'true',
      'country_code': 'co',
      'block_ads': 'false',
      'timeout': '30000'
    });

    // Guardar HTML completo para debugging
    fs.writeFileSync('debug-complete.html', html);
    console.log('💾 HTML guardado en debug-complete.html');

    const products = extractProductsFromHTML(html);

    console.log(`🎯 RESULTADO: ${products.length} productos extraídos`);

    return {
      success: true,
      marca: marca,
      modelo: modelo,
      total_resultados: products.length,
      timestamp: new Date().toISOString(),
      productos: products
    };

  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    return {
      success: false,
      error: error.message,
      marca: marca,
      modelo: modelo,
      timestamp: new Date().toISOString()
    };
  }
}

// Ruta para buscar vehículos con parámetros query
app.get('/api/vehiculos', async (req, res) => {
  const { marca, modelo, limit } = req.query;

  if (!marca || !modelo) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros requeridos: marca, modelo',
      ejemplo: '/api/vehiculos?marca=BMW&modelo=X3'
    });
  }

  try {
    const resultado = await scrapeVehicles(
      marca.toUpperCase(), 
      modelo.toUpperCase()
    );
    
    // Aplicar límite si se especifica
    if (limit && resultado.productos) {
      resultado.productos = resultado.productos.slice(0, parseInt(limit));
      resultado.total_resultados = resultado.productos.length;
    }
    
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta con parámetros en URL
app.get('/api/vehiculos/:marca/:modelo', async (req, res) => {
  const { marca, modelo } = req.params;
  const { limit } = req.query;

  try {
    const resultado = await scrapeVehicles(
      marca.toUpperCase(), 
      modelo.toUpperCase()
    );
    
    if (limit && resultado.productos) {
      resultado.productos = resultado.productos.slice(0, parseInt(limit));
      resultado.total_resultados = resultado.productos.length;
    }
    
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
    service: 'Vehicle Scraping API v2.0'
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: '🚗 API de Vehículos - TuCarro Scraper',
    version: '2.0.0',
    endpoints: {
      '/api/vehiculos?marca=BMW&modelo=X3': 'GET - Buscar por marca y modelo',
      '/api/vehiculos/BMW/X3': 'GET - Buscar con parámetros URL',
      '/api/vehiculos?marca=BMW&modelo=X3&limit=5': 'GET - Con límite de resultados',
      '/health': 'GET - Estado del servicio'
    },
    ejemplos: [
      '/api/vehiculos?marca=BMW&modelo=X3',
      '/api/vehiculos?marca=MERCEDES&modelo=GLA',
      '/api/vehiculos?marca=TOYOTA&modelo=HILUX&limit=10'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API v2.0 ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`📚 Endpoints disponibles:`);
  console.log(`   GET /api/vehiculos?marca=BMW&modelo=X3`);
  console.log(`   GET /api/vehiculos/BMW/X3`);
  console.log(`   GET /api/vehiculos?marca=BMW&modelo=X3&limit=5`);
  console.log(`   GET /health`);
  console.log(`   GET /`);
});
