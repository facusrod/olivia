#!/bin/bash

# Script para construir y subir imagen SOLO para AMD64 (Windows/Linux x86_64)
# Más rápido que multi-plataforma

set -e

DOCKER_USERNAME=${1:-""}
VERSION=${2:-"latest"}

echo "🐳 Docker Hub Push AMD64 - OlivIA"
echo ""

if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar tu usuario de Docker Hub"
    echo ""
    echo "Uso: ./scripts/push-to-dockerhub-amd64.sh TU_USUARIO [version]"
    echo "Ejemplo: ./scripts/push-to-dockerhub-amd64.sh frcuutn latest"
    echo ""
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

echo "📦 Usuario: $DOCKER_USERNAME"
echo "🏷️  Imagen: olivia-app:$VERSION"
echo "🏗️  Plataforma: linux/amd64 (Windows/Linux x86_64)"
echo ""

echo "🔐 Iniciando sesión en Docker Hub..."
docker login

if [ $? -ne 0 ]; then
    echo "❌ Error al hacer login en Docker Hub"
    exit 1
fi

echo ""
echo "🔧 Configurando buildx..."

# Usar el builder default o crear uno
if ! docker buildx ls | grep -q "default"; then
    docker buildx create --name default --use || docker buildx use default
else
    docker buildx use default
fi

echo ""
echo "🏗️  Construyendo imagen para AMD64..."
echo ""

# Build solo para AMD64
docker buildx build \
    --platform linux/amd64 \
    --tag $DOCKER_USERNAME/olivia-app:$VERSION \
    --push \
    .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen"
    exit 1
fi

# Tag con fecha
if [ "$VERSION" = "latest" ]; then
    DATE_TAG=$(date +%Y%m%d)
    echo ""
    echo "🏷️  Creando también tag con fecha: $DATE_TAG"

    docker buildx build \
        --platform linux/amd64 \
        --tag $DOCKER_USERNAME/olivia-app:$DATE_TAG \
        --push \
        .
fi

echo ""
echo "✅ Imagen AMD64 subida exitosamente!"
echo ""
echo "📋 Plataforma soportada:"
echo "   - linux/amd64 (Windows WSL, Linux x86_64)"
echo ""
echo "📋 Para usar en Windows/WSL:"
echo "   docker pull $DOCKER_USERNAME/olivia-app:$VERSION"
echo ""
echo "📋 Luego ejecuta:"
echo "   docker-compose -f docker-compose.hub.yml --env-file .env.production up -d"
echo ""
echo "🌐 Ver en Docker Hub:"
echo "   https://hub.docker.com/r/$DOCKER_USERNAME/olivia-app"
echo ""
