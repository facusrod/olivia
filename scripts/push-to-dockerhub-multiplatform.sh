#!/bin/bash

# Script para construir y subir imagen multi-plataforma a Docker Hub
# Soporta: ARM64 (Mac M1/M2) y AMD64 (Windows/Linux x86_64)

set -e

DOCKER_USERNAME=${1:-""}
VERSION=${2:-"latest"}

echo "🐳 Docker Hub Multi-Platform Push - OlivIA"
echo ""

# Validar que se proporcionó el usuario
if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar tu usuario de Docker Hub"
    echo ""
    echo "Uso: ./scripts/push-to-dockerhub-multiplatform.sh TU_USUARIO [version]"
    echo "Ejemplo: ./scripts/push-to-dockerhub-multiplatform.sh facundo latest"
    echo ""
    exit 1
fi

# Verificar que Docker está instalado y corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

echo "📦 Usuario: $DOCKER_USERNAME"
echo "🏷️  Imagen: olivia-app:$VERSION"
echo "🏗️  Plataformas: linux/amd64 (Windows/Linux), linux/arm64 (Mac M1/M2)"
echo ""

# Login a Docker Hub
echo "🔐 Iniciando sesión en Docker Hub..."
docker login

if [ $? -ne 0 ]; then
    echo "❌ Error al hacer login en Docker Hub"
    exit 1
fi

echo ""
echo "🔧 Configurando buildx para multi-plataforma..."

# Crear builder si no existe
if ! docker buildx ls | grep -q "multiplatform"; then
    echo "Creando builder 'multiplatform'..."
    docker buildx create --name multiplatform --use
else
    echo "Usando builder 'multiplatform' existente..."
    docker buildx use multiplatform
fi

# Iniciar builder
docker buildx inspect --bootstrap

echo ""
echo "🏗️  Construyendo imagen multi-plataforma..."
echo "⏳ Esto puede tardar varios minutos..."
echo ""

# Build y push multi-plataforma
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag $DOCKER_USERNAME/olivia-app:$VERSION \
    --push \
    .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen"
    exit 1
fi

# Si es latest, también tagear con la fecha
if [ "$VERSION" = "latest" ]; then
    DATE_TAG=$(date +%Y%m%d)
    echo ""
    echo "🏷️  Creando también tag con fecha: $DATE_TAG"

    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag $DOCKER_USERNAME/olivia-app:$DATE_TAG \
        --push \
        .
fi

echo ""
echo "✅ Imagen multi-plataforma subida exitosamente!"
echo ""
echo "📋 Plataformas soportadas:"
echo "   - linux/amd64 (Windows WSL, Linux x86_64)"
echo "   - linux/arm64 (Mac M1/M2, Raspberry Pi)"
echo ""
echo "📋 Para usar en Windows/WSL (AMD64):"
echo "   docker pull $DOCKER_USERNAME/olivia-app:$VERSION"
echo ""
echo "📋 Para usar en Mac M1/M2 (ARM64):"
echo "   docker pull $DOCKER_USERNAME/olivia-app:$VERSION"
echo ""
echo "📋 Luego ejecuta:"
echo "   docker-compose -f docker-compose.hub.yml --env-file .env.production up -d"
echo ""
echo "🌐 Ver en Docker Hub:"
echo "   https://hub.docker.com/r/$DOCKER_USERNAME/olivia-app"
echo ""
