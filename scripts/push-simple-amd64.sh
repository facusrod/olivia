#!/bin/bash

# Script simple para construir y subir imagen para AMD64
# Sin usar buildx - método tradicional

set -e

DOCKER_USERNAME=${1:-""}
VERSION=${2:-"latest"}

echo "🐳 Docker Hub Push Simple AMD64 - OlivIA"
echo ""

if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar tu usuario de Docker Hub"
    echo ""
    echo "Uso: ./scripts/push-simple-amd64.sh TU_USUARIO [version]"
    echo "Ejemplo: ./scripts/push-simple-amd64.sh frcuutn latest"
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
echo "🏗️  Construyendo imagen para AMD64..."
echo ""

# Build con --platform para forzar AMD64
docker build --platform linux/amd64 -t olivia-app:$VERSION .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen"
    exit 1
fi

echo ""
echo "🏷️  Etiquetando imagen..."
docker tag olivia-app:$VERSION $DOCKER_USERNAME/olivia-app:$VERSION

# Tag con fecha si es latest
if [ "$VERSION" = "latest" ]; then
    DATE_TAG=$(date +%Y%m%d)
    echo "🏷️  Etiquetando también como: $DOCKER_USERNAME/olivia-app:$DATE_TAG"
    docker tag olivia-app:$VERSION $DOCKER_USERNAME/olivia-app:$DATE_TAG
fi

echo ""
echo "⬆️  Subiendo imagen a Docker Hub..."
docker push $DOCKER_USERNAME/olivia-app:$VERSION

if [ "$VERSION" = "latest" ]; then
    docker push $DOCKER_USERNAME/olivia-app:$DATE_TAG
fi

echo ""
echo "✅ Imagen AMD64 subida exitosamente!"
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
