#!/bin/bash

# Script para crear un paquete con los archivos necesarios para deployment en Windows

set -e

DOCKER_USERNAME=${1:-""}
PACKAGE_DIR="olivia-windows-deployment"

echo "📦 Creando paquete para deployment en Windows..."
echo ""

if [ -z "$DOCKER_USERNAME" ]; then
    echo "❌ Error: Debes proporcionar tu usuario de Docker Hub"
    echo ""
    echo "Uso: ./scripts/create-windows-package.sh TU_USUARIO"
    echo "Ejemplo: ./scripts/create-windows-package.sh frcuutn"
    echo ""
    exit 1
fi

# Crear directorio temporal
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/scripts"

echo "📋 Copiando archivos necesarios..."

# Copiar docker-compose
cp docker-compose.hub.yml "$PACKAGE_DIR/"

# Crear .env.production desde el ejemplo
if [ -f ".env.production.example" ]; then
    cp .env.production.example "$PACKAGE_DIR/.env.production"
else
    cat > "$PACKAGE_DIR/.env.production" << EOF
# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=GENERA_CON_openssl_rand_-base64_32

# Google OAuth
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret

# Gemini AI
GEMINI_API_KEY=tu-gemini-api-key

# Odoo (localhost en WSL)
ODOO_URL=http://host.docker.internal:8080
ODOO_DB=odoo
ODOO_USERNAME=odoo
ODOO_PASSWORD=odoo

# Docker Hub
DOCKER_USERNAME=$DOCKER_USERNAME
VERSION=latest
EOF
fi

# Copiar script de deployment
cp scripts/deploy-from-hub.sh "$PACKAGE_DIR/scripts/"
chmod +x "$PACKAGE_DIR/scripts/deploy-from-hub.sh"

# Crear README para Windows
cat > "$PACKAGE_DIR/README-WINDOWS.md" << 'EOF'
# OlivIA - Deployment en Windows/WSL

Este paquete contiene todo lo necesario para desplegar OlivIA en Windows con WSL.

## 📋 Pre-requisitos

- Windows 10/11 con WSL 2
- Docker Desktop para Windows instalado
- Internet para descargar la imagen

## 🚀 Pasos de instalación

### 1. Copiar este paquete a WSL

Puedes copiar esta carpeta a WSL de varias formas:

**Opción A: Desde Windows a WSL**
```bash
# En Windows, copia la carpeta a:
# C:\Users\TuUsuario\olivia-windows-deployment

# Luego en WSL:
cp -r /mnt/c/Users/TuUsuario/olivia-windows-deployment ~/
cd ~/olivia-windows-deployment
```

**Opción B: Directamente en WSL**
```bash
# Si transferiste por USB, red, etc:
cd ~/olivia-windows-deployment
```

### 2. Configurar variables de entorno

Edita el archivo `.env.production` con tus credenciales reales:

```bash
nano .env.production
```

**IMPORTANTE:** Debes cambiar estos valores:
- `NEXTAUTH_SECRET` - Genera con: `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY`
- Credenciales de Odoo si son diferentes

### 3. Desplegar automáticamente

```bash
chmod +x scripts/deploy-from-hub.sh
./scripts/deploy-from-hub.sh
```

O manualmente:

```bash
# Descargar imagen desde Docker Hub
docker pull USUARIO/olivia-app:latest

# Iniciar servicios
docker-compose -f docker-compose.hub.yml --env-file .env.production up -d

# Ver logs
docker-compose -f docker-compose.hub.yml logs -f
```

### 4. Verificar

```bash
# Ver contenedores corriendo
docker ps

# Deberías ver:
# - olivia-app
# - olivia-mongodb
```

Accede a: http://localhost:3000

## 🔄 Actualizar la aplicación

Cuando haya una nueva versión:

```bash
docker-compose -f docker-compose.hub.yml pull
docker-compose -f docker-compose.hub.yml up -d
```

## 🛠️ Comandos útiles

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.hub.yml logs -f app

# Reiniciar la aplicación
docker-compose -f docker-compose.hub.yml restart app

# Detener todo
docker-compose -f docker-compose.hub.yml down

# Reiniciar MongoDB
docker-compose -f docker-compose.hub.yml restart mongodb
```

## 🐛 Troubleshooting

### No puedo conectar con Odoo

Verifica que Odoo esté corriendo:
```bash
curl http://localhost:8080
```

Si no funciona, obtén la IP de WSL:
```bash
ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1
```

Actualiza `.env.production`:
```env
ODOO_URL=http://IP_DE_WSL:8080
```

Reinicia:
```bash
docker-compose -f docker-compose.hub.yml restart app
```

### Error de MongoDB

```bash
# Ver logs
docker logs olivia-mongodb

# Reiniciar
docker-compose -f docker-compose.hub.yml restart mongodb
```

### Puerto 3000 ocupado

Edita `docker-compose.hub.yml` y cambia:
```yaml
ports:
  - "3001:3000"  # Usa puerto 3001 externamente
```

## 📚 Más información

- Documentación completa: https://github.com/TU_REPO/olivia
- Docker Hub: https://hub.docker.com/r/USUARIO/olivia-app

## 💡 Notas

- La primera vez tardará en descargar la imagen (~500MB)
- Los datos de MongoDB se guardan en un volumen Docker
- Para hacer backup: `docker-compose -f docker-compose.hub.yml exec mongodb mongodump`
EOF

# Reemplazar placeholders en el README
sed -i.bak "s/USUARIO/$DOCKER_USERNAME/g" "$PACKAGE_DIR/README-WINDOWS.md"
rm "$PACKAGE_DIR/README-WINDOWS.md.bak" 2>/dev/null || true

# Crear archivo .dockerignore (por si acaso)
cat > "$PACKAGE_DIR/.dockerignore" << EOF
node_modules
.next
.git
*.tar
exports
EOF

# Crear script de inicio rápido para Windows
cat > "$PACKAGE_DIR/START.sh" << EOF
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
docker pull $DOCKER_USERNAME/olivia-app:latest

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
EOF

chmod +x "$PACKAGE_DIR/START.sh"

# Comprimir el paquete
echo ""
echo "📦 Comprimiendo paquete..."
tar -czf "${PACKAGE_DIR}.tar.gz" "$PACKAGE_DIR"

# Obtener tamaño
SIZE=$(ls -lh "${PACKAGE_DIR}.tar.gz" | awk '{print $5}')

echo ""
echo "✅ Paquete creado exitosamente!"
echo ""
echo "📦 Archivo: ${PACKAGE_DIR}.tar.gz"
echo "📏 Tamaño: $SIZE"
echo ""
echo "📋 Contenido del paquete:"
echo "   - docker-compose.hub.yml"
echo "   - .env.production (plantilla)"
echo "   - scripts/deploy-from-hub.sh"
echo "   - README-WINDOWS.md"
echo "   - START.sh (inicio rápido)"
echo ""
echo "🚀 Para usar en Windows/WSL:"
echo "   1. Transfiere ${PACKAGE_DIR}.tar.gz a Windows"
echo "   2. En WSL: tar -xzf ${PACKAGE_DIR}.tar.gz"
echo "   3. cd $PACKAGE_DIR"
echo "   4. Edita .env.production con tus credenciales"
echo "   5. Ejecuta: ./START.sh"
echo ""
