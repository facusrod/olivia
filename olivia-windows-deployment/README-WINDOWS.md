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
docker pull frcuutn/olivia-app:latest

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
- Docker Hub: https://hub.docker.com/r/frcuutn/olivia-app

## 💡 Notas

- La primera vez tardará en descargar la imagen (~500MB)
- Los datos de MongoDB se guardan en un volumen Docker
- Para hacer backup: `docker-compose -f docker-compose.hub.yml exec mongodb mongodump`
