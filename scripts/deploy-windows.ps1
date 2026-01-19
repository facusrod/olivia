# Script de deployment para Windows
# Ejecutar desde PowerShell: .\scripts\deploy-windows.ps1

Write-Host "🚀 OlivIA Deployment Script para Windows" -ForegroundColor Green
Write-Host ""

# Verificar que Docker está instalado
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Docker no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "   Instala Docker Desktop desde: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar que Docker está corriendo
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Docker no está corriendo" -ForegroundColor Red
    Write-Host "   Inicia Docker Desktop e intenta de nuevo" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker está corriendo" -ForegroundColor Green
Write-Host ""

# Verificar si existe el archivo .env.production
if (!(Test-Path ".env.production")) {
    Write-Host "⚠️  Advertencia: No se encontró .env.production" -ForegroundColor Yellow
    Write-Host "   Creando desde el ejemplo..." -ForegroundColor Yellow

    if (Test-Path ".env.production.example") {
        Copy-Item ".env.production.example" ".env.production"
        Write-Host ""
        Write-Host "📝 IMPORTANTE: Edita .env.production con tus valores reales" -ForegroundColor Yellow
        Write-Host "   Luego ejecuta este script de nuevo" -ForegroundColor Yellow

        # Abrir el archivo en notepad
        notepad .env.production
        exit 0
    } else {
        Write-Host "❌ Error: No se encontró .env.production.example" -ForegroundColor Red
        exit 1
    }
}

Write-Host "📋 Configuración encontrada: .env.production" -ForegroundColor Green
Write-Host ""

# Verificar si la imagen existe
$imageExists = docker images -q olivia-app:latest
if (!$imageExists) {
    Write-Host "⚠️  La imagen olivia-app:latest no existe" -ForegroundColor Yellow
    Write-Host "   ¿Deseas construirla ahora? (s/n)" -ForegroundColor Yellow
    $response = Read-Host

    if ($response -eq "s" -or $response -eq "S") {
        Write-Host "🏗️  Construyendo imagen..." -ForegroundColor Cyan
        docker build -t olivia-app:latest .

        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error al construir la imagen" -ForegroundColor Red
            exit 1
        }

        Write-Host "✅ Imagen construida exitosamente" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "❌ Deployment cancelado" -ForegroundColor Red
        Write-Host "   Opción 1: Construye la imagen: docker build -t olivia-app:latest ." -ForegroundColor Yellow
        Write-Host "   Opción 2: Carga desde archivo: docker load -i olivia-app.tar" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Imagen Docker encontrada: olivia-app:latest" -ForegroundColor Green
Write-Host ""

# Iniciar servicios
Write-Host "🚀 Iniciando servicios..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ OlivIA desplegado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Servicios activos:" -ForegroundColor Cyan
    docker-compose -f docker-compose.prod.yml ps
    Write-Host ""
    Write-Host "🌐 Accede a la aplicación en: http://localhost:3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Comandos útiles:" -ForegroundColor Cyan
    Write-Host "   Ver logs:     docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor White
    Write-Host "   Detener:      docker-compose -f docker-compose.prod.yml down" -ForegroundColor White
    Write-Host "   Reiniciar:    docker-compose -f docker-compose.prod.yml restart" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error al iniciar los servicios" -ForegroundColor Red
    Write-Host "   Revisa los logs para más información:" -ForegroundColor Yellow
    Write-Host "   docker-compose -f docker-compose.prod.yml logs" -ForegroundColor White
    exit 1
}
