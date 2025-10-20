const fs = require('fs');
const cheerio = require('cheerio');

console.log('🔍 Analizando paginación en el HTML...');

const html = fs.readFileSync('direct-scraping-result.html', 'utf8');
const $ = cheerio.load(html);

console.log('\n📄 ENLACES DE PAGINACIÓN:');
let found = false;

$('a').each((i, element) => {
  const text = $(element).text().trim();
  const href = $(element).attr('href');
  
  if (text.match(/siguiente|next|\d+|>>|página/i) || 
      href?.includes('offset') || 
      href?.includes('page') ||
      href?.includes('_Desde_') ||
      text === '2' || text === '3' || text === '4') {
    console.log(`📄 "${text}" -> ${href}`);
    found = true;
  }
});

if (!found) {
  console.log('❌ No se encontraron enlaces de paginación obvios');
}

// Buscar parámetros de URL que indiquen paginación
console.log('\n🔗 URL ACTUAL:');
console.log('https://vehiculos.tucarro.com.co/BMW/X3');

console.log('\n🧐 PATRONES DE PAGINACIÓN COMUNES:');
console.log('1. ?offset=50 (TuCarro clásico)');
console.log('2. _Desde_51 (MercadoLibre)');
console.log('3. ?page=2');

// Analizar la cantidad total de resultados
const totalResults = $('.ui-search-search-result__quantity-results').text();
console.log(`\n📊 RESULTADOS TOTALES: ${totalResults}`);

// Buscar información de paginación en scripts
console.log('\n🔍 Buscando datos de paginación en JavaScript...');
$('script').each((i, script) => {
  const content = $(script).html();
  if (content && (content.includes('offset') || content.includes('page') || content.includes('total'))) {
    const lines = content.split('\n').filter(line => 
      line.includes('offset') || 
      line.includes('total') || 
      line.includes('limit') ||
      line.includes('results')
    );
    if (lines.length > 0) {
      console.log('📜 Datos encontrados en scripts:');
      lines.slice(0, 3).forEach(line => {
        console.log(`   ${line.trim().substring(0, 100)}...`);
      });
    }
  }
});