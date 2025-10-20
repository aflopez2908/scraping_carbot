const axios = require('axios');
const cheerio = require('cheerio');

// Función alternativa sin ScrapingBee (scraping directo)
async function scrapeDirectly(marca, modelo) {
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  console.log(`🔍 Scraping directo: ${marca} ${modelo}`);
  console.log(`🔗 URL: ${url}`);

  try {
    // Scraping directo con headers simulando un navegador
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

    const $ = cheerio.load(response.data);
    const products = [];

    // Intentar extraer productos con los selectores conocidos
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

        products.push(product);
      }
    });

    return {
      success: true,
      method: 'direct_scraping',
      marca: marca,
      modelo: modelo,
      total_resultados: products.length,
      productos: products,
      note: 'Scraping directo - sin proxy. Puede ser bloqueado por el sitio web.'
    };

  } catch (error) {
    return {
      success: false,
      method: 'direct_scraping',
      error: error.message,
      marca: marca,
      modelo: modelo,
      note: 'Error en scraping directo. Considera usar un proxy o esperar a que se renueve tu cuota de ScrapingBee.'
    };
  }
}

// Función que detecta el límite de ScrapingBee y usa alternativa
async function scrapeWithFallback(marca, modelo) {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  const url = `https://vehiculos.tucarro.com.co/${marca}/${modelo}`;
  
  try {
    // Intentar primero con ScrapingBee
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

    // Si llegamos aquí, ScrapingBee funcionó
    const $ = cheerio.load(response.data);
    // ... resto del código de parsing
    
    return {
      success: true,
      method: 'scrapingbee',
      // ... resto de datos
    };

  } catch (error) {
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data;
      
      if (errorData.message && errorData.message.includes('limit reached')) {
        console.log('⚠️ Límite de ScrapingBee alcanzado, usando scraping directo...');
        return await scrapeDirectly(marca, modelo);
      }
    }
    
    throw error; // Re-lanzar otros errores
  }
}

// Prueba
scrapeWithFallback('BMW', 'X3').then(result => {
  console.log('📊 Resultado:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('❌ Error:', error.message);
});