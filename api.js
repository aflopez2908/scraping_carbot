const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Función principal de scraping
async function scrapeVehicles(marca, modelo) {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`🔍 Buscando: ${marca} ${modelo}`);
  console.log(`🔗 URL: ${url}`);

  try {
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

    const $ = cheerio.load(response.data);
    const products = [];

    // Buscar elementos de productos
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
      marca: marca,
      modelo: modelo,
      total_resultados: products.length,
      productos: products
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      success: false,
      error: error.message,
      marca: marca,
      modelo: modelo
    };
  }
}

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: '🚗 API de Scraping de Vehículos',
    endpoints: {
      '/api/vehiculos': 'GET - Buscar vehículos por marca y modelo',
      '/api/vehiculos/:marca/:modelo': 'GET - Buscar vehículos específicos'
    },
    ejemplo: '/api/vehiculos/BMW/X3'
  });
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
    service: 'Vehicle Scraping API'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API ejecutándose en http://localhost:${PORT}`);
  console.log(`📚 Endpoints disponibles:`);
  console.log(`   GET /api/vehiculos?marca=BMW&modelo=X3`);
  console.log(`   GET /api/vehiculos/BMW/X3`);
  console.log(`   GET /health`);
});
