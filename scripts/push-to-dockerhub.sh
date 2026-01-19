#!/bin/bash

# Script para construir y subir la imagen a Docker Hub
# Uso: ./scripts/push-to-dockerhub.sh [tu-usuario-dockerhub]

set -e

DOCKER_USERNAME=${1:-""}
IMAGE_NAME="olivia-app"
VERSION=${2:-"latest"}

echo "🐳 Docker Hub Push Script - OlivIA"
echo ""

# Validar que se proporcionó el usuario
if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar tu usuario de Docker Hub"
    echo ""
    echo "Uso: ./scripts/push-to-dockerhub.sh TU_USUARIO [version]"
    echo "Ejemplo: ./scripts/push-to-dockerhub.sh facundo latest"
    echo ""
    exit 1
fi

# Verificar que Docker está instalado y corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

echo "📦 Usuario: $DOCKER_USERNAME"
echo "🏷️  Imagen: $IMAGE_NAME:$VERSION"
echo ""

# Login a Docker Hub
echo "🔐 Iniciando sesión en Docker Hub..."
docker login

if [ $? -ne 0 ]; then
    echo "❌ Error al hacer login en Docker Hub"
    exit 1
fi

echo ""
echo "🏗️  Construyendo imagen..."
docker build -t $IMAGE_NAME:$VERSION .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen"
    exit 1
fi

echo ""
echo "🏷️  Etiquetando imagen..."
docker tag $IMAGE_NAME:$VERSION $DOCKER_USERNAME/$IMAGE_NAME:$VERSION

# Si es latest, también tagear con la fecha
if [ "$VERSION" = "latest" ]; then
    DATE_TAG=$(date +%Y%m%d)
    echo "🏷️  Etiquetando también como: $DOCKER_USERNAME/$IMAGE_NAME:$DATE_TAG"
    docker tag $IMAGE_NAME:$VERSION $DOCKER_USERNAME/$IMAGE_NAME:$DATE_TAG
fi

echo ""
echo "⬆️  Subiendo imagen a Docker Hub..."
docker push $DOCKER_USERNAME/$IMAGE_NAME:$VERSION

if [ "$VERSION" = "latest" ]; then
    docker push $DOCKER_USERNAME/$IMAGE_NAME:$DATE_TAG
fi

echo ""
echo "✅ Imagen subida exitosamente!"
echo ""
echo "📋 Para usar en Windows/WSL:"
echo "   docker pull $DOCKER_USERNAME/$IMAGE_NAME:$VERSION"
echo ""
echo "📋 Luego ejecuta:"
echo "   docker-compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo ""
echo "🌐 Ver en Docker Hub:"
echo "   https://hub.docker.com/r/$DOCKER_USERNAME/$IMAGE_NAME"
echo ""
