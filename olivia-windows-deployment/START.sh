#!/bin/bash

echo "🚀 OlivIA - Inicio Rápido"
echo ""
echo "Verificando configuración..."

if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production no existe"
    echo "   Crea el archivo con tus credenciales primero"
    exit 1
fi

echo "✅ Configuración encontrada"
echo ""
echo "📥 Descargando imagen desde Docker Hub..."
docker pull frcuutn/olivia-app:latest

echo ""
echo "🚀 Iniciando servicios..."
docker-compose -f docker-compose.hub.yml --env-file .env.production up -d

echo ""
echo "✅ OlivIA iniciado!"
echo ""
echo "🌐 Accede a: http://localhost:3000"
echo ""
echo "📝 Comandos útiles:"
echo "   Ver logs:  docker-compose -f docker-compose.hub.yml logs -f"
echo "   Detener:   docker-compose -f docker-compose.hub.yml down"
echo ""
