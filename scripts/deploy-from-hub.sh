#!/bin/bash

# Script para desplegar OlivIA desde Docker Hub en Windows/WSL
# Uso: ./scripts/deploy-from-hub.sh TU_USUARIO_DOCKERHUB

set -e

DOCKER_USERNAME=${1:-""}
VERSION=${2:-"latest"}

echo "🚀 OlivIA Deployment desde Docker Hub"
echo ""

# Validar que se proporcionó el usuario
if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar el usuario de Docker Hub"
    echo ""
    echo "Uso: ./deploy-from-hub.sh TU_USUARIO [version]"
    echo "Ejemplo: ./deploy-from-hub.sh facundo latest"
    echo ""
    exit 1
fi

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

echo "✅ Docker está corriendo"
echo ""

# Verificar si existe .env.production
if [ ! -f ".env.production" ]; then
    echo "⚠️  No se encontró .env.production"

    if [ -f ".env.production.example" ]; then
        echo "📝 Creando .env.production desde el ejemplo..."
        cp .env.production.example .env.production
        echo ""
        echo "❗IMPORTANTE: Edita .env.production con tus valores reales"
        echo "   Presiona ENTER cuando hayas terminado de editar..."

        # Abrir en el editor disponible
        if command -v nano > /dev/null; then
            nano .env.production
        elif command -v vim > /dev/null; then
            vim .env.production
        else
            echo "   Edita manualmente: nano .env.production"
            read -p ""
        fi
    else
        echo "❌ Error: No se encontró .env.production.example"
        exit 1
    fi
fi

# Agregar DOCKER_USERNAME al archivo .env.production si no existe
if ! grep -q "DOCKER_USERNAME" .env.production; then
    echo "" >> .env.production
    echo "# Docker Hub" >> .env.production
    echo "DOCKER_USERNAME=$DOCKER_USERNAME" >> .env.production
    echo "VERSION=$VERSION" >> .env.production
fi

echo "📦 Descargando imagen: $DOCKER_USERNAME/olivia-app:$VERSION"
docker pull $DOCKER_USERNAME/olivia-app:$VERSION

if [ $? -ne 0 ]; then
    echo "❌ Error al descargar la imagen"
    echo "   Verifica que la imagen existe en Docker Hub:"
    echo "   https://hub.docker.com/r/$DOCKER_USERNAME/olivia-app"
    exit 1
fi

echo ""
echo "✅ Imagen descargada correctamente"
echo ""

# Verificar si existe docker-compose.hub.yml
if [ ! -f "docker-compose.hub.yml" ]; then
    echo "❌ Error: No se encontró docker-compose.hub.yml"
    echo "   Copia este archivo desde el repositorio"
    exit 1
fi

echo "🚀 Iniciando servicios..."
docker-compose -f docker-compose.hub.yml --env-file .env.production up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ OlivIA desplegado exitosamente desde Docker Hub!"
    echo ""
    echo "📊 Servicios activos:"
    docker-compose -f docker-compose.hub.yml ps
    echo ""
    echo "🌐 Accede a: http://localhost:3000"
    echo ""
    echo "📝 Comandos útiles:"
    echo "   Ver logs:     docker-compose -f docker-compose.hub.yml logs -f"
    echo "   Detener:      docker-compose -f docker-compose.hub.yml down"
    echo "   Actualizar:   docker-compose -f docker-compose.hub.yml pull && docker-compose -f docker-compose.hub.yml up -d"
    echo ""
else
    echo ""
    echo "❌ Error al iniciar los servicios"
    exit 1
fi
