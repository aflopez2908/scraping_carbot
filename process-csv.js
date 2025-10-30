const fs = require('fs');

// Leer y procesar el archivo CSV
function procesarCSV() {
  try {
    const csvContent = fs.readFileSync('C:\\Users\\pipel\\Downloads\\Copia de Marcas_Modelos(1).csv', 'utf-8');
    const lines = csvContent.split('\n');
    
    // La primera línea contiene las marcas
    const marcasLine = lines[0];
    const marcas = marcasLine.split(';').slice(1).filter(marca => marca.trim() !== '');
    
    console.log(`📋 Marcas encontradas: ${marcas.length}`);
    console.log(marcas);
    
    // Crear objeto con marcas y modelos
    const vehiculosData = {};
    
    // Procesar cada marca
    marcas.forEach((marca, marcaIndex) => {
      const modelosParaMarca = [];
      
      // Recorrer todas las filas para encontrar modelos de esta marca
      for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const columns = lines[lineIndex].split(';');
        
        // La columna de la marca actual (marcaIndex + 1 porque la primera columna es "Marca")
        const modelo = columns[marcaIndex + 1];
        
        if (modelo && modelo.trim() !== '' && modelo.trim() !== marca.trim()) {
          modelosParaMarca.push(modelo.trim());
        }
      }
      
      // Remover duplicados
      const modelosUnicos = [...new Set(modelosParaMarca)];
      
      if (modelosUnicos.length > 0) {
        vehiculosData[marca.trim()] = modelosUnicos;
        console.log(`🚗 ${marca}: ${modelosUnicos.length} modelos`);
      }
    });
    
    // Guardar en archivo JSON
    fs.writeFileSync('./vehiculos-colombia.json', JSON.stringify(vehiculosData, null, 2), 'utf-8');
    
    // Crear archivo JS para importar
    const jsContent = `// Marcas y modelos extraídos del CSV
const VEHICULOS_COLOMBIA = ${JSON.stringify(vehiculosData, null, 2)};

module.exports = VEHICULOS_COLOMBIA;
`;
    
    fs.writeFileSync('./vehiculos-colombia.js', jsContent, 'utf-8');
    
    // Estadísticas
    const totalMarcas = Object.keys(vehiculosData).length;
    const totalModelos = Object.values(vehiculosData).reduce((sum, modelos) => sum + modelos.length, 0);
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   🏢 Total marcas: ${totalMarcas}`);
    console.log(`   🚗 Total modelos: ${totalModelos}`);
    console.log(`   🔄 Total combinaciones: ${totalModelos}`);
    
    console.log(`\n✅ Archivos creados:`);
    console.log(`   📄 vehiculos-colombia.json`);
    console.log(`   📄 vehiculos-colombia.js`);
    
    return vehiculosData;
    
  } catch (error) {
    console.error('❌ Error procesando CSV:', error);
    return null;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  procesarCSV();
}

module.exports = { procesarCSV };