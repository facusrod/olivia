# OlivIA - Quick Start Guide

Guía rápida para poner en marcha OlivIA en diferentes escenarios.

## 🚀 Escenario 1: Desarrollo Local (Mac/Linux)

Ideal para desarrollo, con MongoDB en Docker y la app corriendo localmente.

```bash
# 1. Inicia MongoDB
docker-compose -f docker-compose.dev.yml up -d

# 2. Instala dependencias
npm install

# 3. Configura .env (copia del ejemplo y edita)
cp .env.example .env
nano .env

# 4. Inicia la app en modo desarrollo
npm run dev

# Accede a: http://localhost:3000
```

## 🐳 Escenario 2: Todo en Docker (Desarrollo)

Todo (MongoDB + App) en Docker para testing completo.

```bash
# 1. Configura .env
cp .env.example .env
nano .env

# 2. Levanta todo con Docker Compose
docker-compose up --build

# Accede a: http://localhost:3000
```

## 🏭 Escenario 3: Producción en Windows/WSL (con Odoo)

Desplegar en la misma máquina donde corre Odoo.

### Método A: Construir localmente

```bash
# 1. Construir imagen
./scripts/build-docker.sh

# 2. Configurar entorno de producción
cp .env.production.example .env.production
nano .env.production

# Configurar ODOO_URL=http://host.docker.internal:8080

# 3. Desplegar
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Método B: Transferir imagen pre-construida

**En tu Mac (o máquina de desarrollo):**

```bash
# 1. Construir y exportar
./scripts/build-docker.sh
./scripts/export-docker.sh

# Esto crea: exports/olivia-app_TIMESTAMP.tar
```

**En Windows/WSL (donde está Odoo):**

```bash
# 1. Transferir el archivo .tar (USB, red, etc.)

# 2. Cargar la imagen
docker load -i olivia-app_TIMESTAMP.tar

# 3. Crear archivos de configuración
mkdir ~/olivia && cd ~/olivia

# Copia docker-compose.prod.yml y .env.production.example
# del repositorio

# 4. Configurar
cp .env.production.example .env.production
nano .env.production

# 5. Desplegar
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Método C: Usando PowerShell (Windows)

**Desde PowerShell en Windows:**

```powershell
# Navega al directorio del proyecto
cd C:\ruta\a\olivia

# Ejecuta el script de deployment
.\scripts\deploy-windows.ps1

# El script te guiará paso a paso
```

## 📋 Checklist de Configuración

Antes de desplegar, asegúrate de tener:

- [ ] `NEXTAUTH_SECRET` - Genera con: `openssl rand -base64 32`
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` - De Google Cloud Console
- [ ] `GEMINI_API_KEY` - De Google AI Studio
- [ ] `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD` - Credenciales de Odoo

### Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea/Selecciona proyecto
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Authorized redirect URIs:
   - Desarrollo: `http://localhost:3000/api/auth/callback/google`
   - Producción: `http://tu-ip:3000/api/auth/callback/google`

### Configurar Gemini AI

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una API Key
3. Copia la key a `GEMINI_API_KEY`

## 🔧 Comandos Útiles

### Desarrollo

```bash
# Ver logs de MongoDB
docker logs olivia-mongodb -f

# Reiniciar MongoDB
docker restart olivia-mongodb

# Limpiar cache de Next.js
rm -rf .next

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Producción

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f app

# Reiniciar app
docker-compose -f docker-compose.prod.yml restart app

# Detener todo
docker-compose -f docker-compose.prod.yml down

# Ver estado
docker-compose -f docker-compose.prod.yml ps

# Actualizar app (después de rebuild)
docker-compose -f docker-compose.prod.yml up -d --force-recreate app
```

## 🐛 Troubleshooting Común

### No puedo conectar con Odoo

```bash
# Verifica que Odoo esté corriendo
curl http://localhost:8080

# Desde Docker, prueba con host.docker.internal
docker run --rm curlimages/curl curl http://host.docker.internal:8080
```

Si falla, cambia `ODOO_URL` a la IP real de tu máquina:

```bash
# Obtén tu IP local
ip addr show | grep "inet\b"  # Linux/WSL
ipconfig                       # Windows
ifconfig | grep "inet "        # Mac

# Usa: ODOO_URL=http://192.168.1.X:8080
```

### MongoDB connection failed

```bash
# Verifica que MongoDB esté corriendo
docker ps | grep mongodb

# Verifica logs
docker logs olivia-mongodb

# Reinicia
docker restart olivia-mongodb
```

### Google OAuth error

Verifica que:
1. El redirect URI en Google Console sea EXACTO: `http://localhost:3000/api/auth/callback/google`
2. Tengas `NEXTAUTH_SECRET` configurado
3. `NEXTAUTH_URL` coincida con la URL real

### Port already in use

```bash
# Ver qué está usando el puerto 3000
lsof -i :3000          # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Cambiar puerto (en producción)
# En docker-compose.prod.yml:
ports:
  - "3001:3000"  # Usa puerto 3001 externamente
```

## 📚 Más Información

- Guía completa: [README.md](./README.md)
- Deployment detallado: [DEPLOY.md](./DEPLOY.md)
- Documentación Next.js: https://nextjs.org/docs
- Documentación Docker: https://docs.docker.com/
