const axios = require('axios');

async function scrapeWithScrapingBee() {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  const url = 'https://vehiculos.tucarro.com.co/BMW/X3';
  
  console.log('🚀 Iniciando scraping con ScrapingBee...');
  console.log('🔗 URL:', url);

  try {
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': apiKey,
        'url': url,
        'render_js': 'true', // Importante para JavaScript
        'premium_proxy': 'true', // Usar proxies premium
        'country_code': 'co', // Colombia
        'block_ads': 'true',
        'block_resources': 'false',
        'timeout': '30000'
      },
      timeout: 40000
    });

    console.log('✅ ScrapingBee: Página obtenida exitosamente');
    console.log('📄 Tamaño del HTML:', response.data.length, 'caracteres');

    // Guardar el HTML para análisis
    const fs = require('fs');
    fs.writeFileSync('scrapingbee-result.html', response.data);
    console.log('💾 HTML guardado en scrapingbee-result.html');

    // Procesar el HTML con cheerio
    const cheerio = require('cheerio');
    const $ = cheerio.load(response.data);

    // Extraer productos
    const products = [];

    // Intentar diferentes selectores
    $('.ui-search-layout__item, .ui-search-result__wrapper').each((index, element) => {
      const $element = $(element);
      
      const product = {
        id: index + 1,
        descripcion: $element.find('.ui-search-item__title, .poly-component__title-wrapper').text().trim(),
        precio: $element.find('.andes-money-amount__fraction, .price-tag-fraction').text().trim(),
        ubicacion: $element.find('.ui-search-item__location, .poly-component__location').text().trim(),
        link: $element.find('a').attr('href')
      };

      // Extraer año y kilometraje
      const atributos = $element.find('.ui-search-item__attributes, .poly-component__attributes-list').text();
      if (atributos) {
        const lines = atributos.split('\n').map(line => line.trim()).filter(line => line);
        lines.forEach(line => {
          if (line.includes('Km') || line.includes('km')) {
            product.kilometraje = line;
          } else if (/^\d{4}$/.test(line)) {
            product.año = line;
          }
        });
      }

      // Solo agregar si tiene información válida
      if (product.descripcion && product.precio) {
        products.push(product);
      }
    });

    console.log(`\n📊 RESULTADOS: ${products.length} productos encontrados`);

    if (products.length > 0) {
      console.log('\n🎯 PRIMEROS PRODUCTOS:');
      products.slice(0, 3).forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.descripcion}`);
        console.log(`   💰 Precio: $${product.precio}`);
        console.log(`   📍 Ubicación: ${product.ubicacion || 'No especificada'}`);
        console.log(`   🗓️  Año: ${product.año || 'No especificado'}`);
        console.log(`   🛣️  KM: ${product.kilometraje || 'No especificado'}`);
      });

      // Guardar todos los productos en JSON
      fs.writeFileSync('productos-tucarro.json', JSON.stringify(products, null, 2));
      console.log(`\n💾 Todos los productos guardados en productos-tucarro.json`);
    } else {
      console.log('❌ No se encontraron productos. Revisa el archivo scrapingbee-result.html');
      
      // Mostrar qué hay en la página
      const pageTitle = $('title').text();
      const bodyText = $('body').text().substring(0, 500);
      console.log('📄 Título de la página:', pageTitle);
      console.log('🔍 Primeros 500 caracteres del body:', bodyText);
    }

    return products;

  } catch (error) {
    console.error('❌ Error con ScrapingBee:', error.message);
    if (error.response) {
      console.error('📡 Código de estado:', error.response.status);
      console.error('📄 Respuesta:', error.response.data);
    }
    return [];
  }
}

// Ejecutar el scraping
scrapeWithScrapingBee().then(products => {
  console.log(`\n🎉 Proceso completado. Total: ${products.length} productos`);
}).catch(error => {
  console.error('💥 Error fatal:', error);
});
