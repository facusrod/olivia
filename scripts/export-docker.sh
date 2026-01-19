#!/bin/bash

# Script para exportar la imagen Docker a un archivo .tar
# Para transferir a otra máquina

set -e

echo "📦 Exportando imagen Docker de OlivIA..."
echo ""

# Verificar que la imagen existe
if ! docker image inspect olivia-app:latest > /dev/null 2>&1; then
    echo "❌ Error: La imagen olivia-app:latest no existe"
    echo "   Ejecuta primero: ./scripts/build-docker.sh"
    exit 1
fi

# Crear carpeta de exports si no existe
mkdir -p exports

# Nombre del archivo con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="exports/olivia-app_${TIMESTAMP}.tar"

echo "💾 Guardando imagen en: $OUTPUT_FILE"
docker save -o "$OUTPUT_FILE" olivia-app:latest

# Obtener tamaño del archivo
SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')

echo ""
echo "✅ Imagen exportada exitosamente!"
echo "   📁 Archivo: $OUTPUT_FILE"
echo "   📏 Tamaño: $SIZE"
echo ""
echo "📝 Para usar en otra máquina (Windows WSL):"
echo "   1. Copia el archivo .tar a la otra PC"
echo "   2. Ejecuta: docker load -i olivia-app_${TIMESTAMP}.tar"
echo "   3. Sigue las instrucciones en DEPLOY.md"
echo ""
