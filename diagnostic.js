const axios = require('axios');

async function demonstrateProblem() {
  const apiKey = '2Z94179KL47UJPJ25NGPGMUNZSRNXXJD9SYYYSPGP2Q8H5Z6G8AXG9AFJAHZTF27FOVS6XZ8EWQ5RT50';
  
  console.log('=' .repeat(80));
  console.log('🚗 DIAGNÓSTICO DEL ERROR 401 - SCRAPINGBEE');
  console.log('=' .repeat(80));
  console.log();
  
  console.log('1️⃣ PROBLEMA IDENTIFICADO:');
  console.log('   El error 401 que estás viendo NO es por credenciales incorrectas');
  console.log('   Es porque has alcanzado el límite mensual de 1000 llamadas');
  console.log();
  
  console.log('2️⃣ VERIFICANDO EL ERROR:');
  try {
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': apiKey,
        'url': 'https://vehiculos.tucarro.com.co/BMW/X3',
        'render_js': 'false'
      },
      timeout: 10000
    });
    
    console.log('   ✅ ScrapingBee respondió correctamente');
    
  } catch (error) {
    console.log('   ❌ ScrapingBee devolvió error:');
    console.log(`   📊 Status Code: ${error.response?.status}`);
    console.log(`   📨 Mensaje: ${JSON.stringify(error.response?.data, null, 6)}`);
    console.log(`   🔗 URL llamada: ${error.config?.url}`);
    
    if (error.response?.status === 401) {
      const errorData = error.response.data;
      
      if (errorData.message && errorData.message.includes('limit reached')) {
        console.log();
        console.log('3️⃣ CAUSA CONFIRMADA:');
        console.log('   🚫 Has alcanzado el límite mensual de 1000 llamadas a ScrapingBee');
        console.log('   📅 Este límite se renueva cada mes según tu plan');
        console.log();
        
        console.log('4️⃣ SOLUCIONES RECOMENDADAS:');
        console.log('   A) INMEDIATA:');
        console.log('      • Usar la API mejorada que implementa fallback a scraping directo');
        console.log('      • Reducir frecuencia de llamadas hasta que se renueve la cuota');
        console.log();
        console.log('   B) A LARGO PLAZO:');
        console.log('      • Revisar tu dashboard de ScrapingBee para ver estadísticas de uso');
        console.log('      • Considerar upgrade a un plan con más llamadas mensuales');
        console.log('      • Implementar caché para evitar llamadas repetidas');
        console.log('      • Usar scraping directo como alternativa principal');
        console.log();
        
        console.log('5️⃣ DETALLES TÉCNICOS:');
        console.log(`   • API Key: ${apiKey.substring(0, 20)}...`);
        console.log(`   • Límite alcanzado: 1000 llamadas/mes`);
        console.log(`   • Respuesta del servidor: HTTP 401`);
        console.log(`   • Error específico: "Monthly API calls limit reached: 1000"`);
        
      } else {
        console.log('   🔧 Es un error 401 diferente (posiblemente API key inválida)');
      }
    }
  }
  
  console.log();
  console.log('6️⃣ PRÓXIMOS PASOS:');
  console.log('   1. Usa api-improved.js que maneja este error automáticamente');
  console.log('   2. Revisa tu cuenta de ScrapingBee en https://app.scrapingbee.com/');
  console.log('   3. Considera implementar rate limiting en tu aplicación');
  console.log();
  console.log('=' .repeat(80));
}

demonstrateProblem().catch(console.error);