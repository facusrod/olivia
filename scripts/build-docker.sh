#!/bin/bash

# Script para construir la imagen Docker de OlivIA

set -e

echo "🏗️  Construyendo imagen Docker de OlivIA..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Construir la imagen
echo "📦 Construyendo imagen..."
docker build -t olivia-app:latest .

echo ""
echo "✅ Imagen construida exitosamente: olivia-app:latest"
echo ""
echo "📝 Siguiente paso:"
echo "   1. Si estás en esta máquina: docker-compose -f docker-compose.prod.yml up -d"
echo "   2. Si quieres exportar para otra máquina: ./scripts/export-docker.sh"
echo ""
