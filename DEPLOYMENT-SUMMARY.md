# 🎉 OlivIA - Resumen de Deployment

## ✅ Estado Actual

La aplicación OlivIA está **lista para deployment** y la imagen Docker ha sido subida exitosamente a Docker Hub.

### 📦 Imagen en Docker Hub

- **URL**: https://hub.docker.com/r/frcuutn/olivia-app
- **Usuario**: frcuutn
- **Imagen**: `frcuutn/olivia-app:latest`
- **Versión con fecha**: `frcuutn/olivia-app:20260119`
- **Tamaño aproximado**: ~500MB

## 🚀 Opciones de Deployment

### Opción 1: Paquete Pre-configurado (Recomendado) ⭐

Se ha creado un paquete todo-en-uno listo para transferir a Windows.

**Archivo**: `olivia-windows-deployment.tar.gz` (4.1KB)

**Contenido**:
- ✅ `docker-compose.hub.yml` - Configuración de servicios
- ✅ `.env.production` - Plantilla de variables de entorno
- ✅ `README-WINDOWS.md` - Guía paso a paso
- ✅ `START.sh` - Script de inicio rápido
- ✅ `scripts/deploy-from-hub.sh` - Script automático de deployment

**Transferir a Windows**:
```bash
# Archivo ubicado en:
./olivia-windows-deployment.tar.gz

# Transfiere por: USB, red compartida, OneDrive, etc.
```

**En Windows/WSL**:
```bash
# 1. Extraer
tar -xzf olivia-windows-deployment.tar.gz
cd olivia-windows-deployment

# 2. Editar credenciales
nano .env.production

# 3. Ejecutar
./START.sh
```

### Opción 2: Deployment Manual Directo

Si prefieres hacerlo manualmente sin el paquete:

**En Windows/WSL**:
```bash
# 1. Descargar imagen
docker pull frcuutn/olivia-app:latest

# 2. Crear archivos de configuración
# - Copia docker-compose.hub.yml
# - Crea .env.production con tus credenciales

# 3. Iniciar
docker-compose -f docker-compose.hub.yml --env-file .env.production up -d
```

## 🔧 Configuración Requerida

Antes de desplegar, configura estas variables en `.env.production`:

### Variables Críticas

```env
# Next.js (genera con: openssl rand -base64 32)
NEXTAUTH_SECRET=TU_SECRET_AQUI

# Google OAuth (desde Google Cloud Console)
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Gemini AI (desde Google AI Studio)
GEMINI_API_KEY=AIzaSyxxx

# Odoo (ajusta según tu configuración)
ODOO_URL=http://host.docker.internal:8080
ODOO_DB=odoo
ODOO_USERNAME=odoo
ODOO_PASSWORD=odoo
```

### Configurar Google OAuth

1. Ve a https://console.cloud.google.com/
2. Crea un proyecto o selecciona uno existente
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://IP_DE_TU_PC:3000/api/auth/callback/google` (si accedes desde otra PC)

### Obtener Gemini API Key

1. Ve a https://makersuite.google.com/app/apikey
2. Crea una nueva API key
3. Copia la key a `GEMINI_API_KEY`

## 📊 Arquitectura del Deployment

```
┌─────────────────────────────────────────────┐
│           Windows/WSL Host                   │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │    Docker Network: olivia-network      │ │
│  │                                        │ │
│  │  ┌──────────────┐   ┌──────────────┐  │ │
│  │  │  olivia-app  │   │   MongoDB    │  │ │
│  │  │   :3000      │──▶│   :27017     │  │ │
│  │  └──────┬───────┘   └──────────────┘  │ │
│  │         │                              │ │
│  │         │ host.docker.internal         │ │
│  │         ▼                              │ │
│  └─────────┼──────────────────────────────┘ │
│            │                                 │
│       ┌────▼─────┐                          │
│       │   Odoo   │                          │
│       │   :8080  │                          │
│       └──────────┘                          │
└─────────────────────────────────────────────┘
```

## 🔄 Flujo de Actualización

### Cuando hagas cambios en el código:

**En tu Mac**:
```bash
# Reconstruir y subir nueva versión
./scripts/push-to-dockerhub.sh frcuutn
```

**En Windows/WSL**:
```bash
# Descargar y aplicar actualización
docker-compose -f docker-compose.hub.yml pull
docker-compose -f docker-compose.hub.yml up -d --force-recreate app
```

## 📝 Comandos Útiles

### Ver estado
```bash
docker ps
docker-compose -f docker-compose.hub.yml ps
```

### Ver logs
```bash
# Logs de la aplicación
docker-compose -f docker-compose.hub.yml logs -f app

# Logs de MongoDB
docker-compose -f docker-compose.hub.yml logs -f mongodb
```

### Reiniciar servicios
```bash
# Reiniciar todo
docker-compose -f docker-compose.hub.yml restart

# Solo la aplicación
docker-compose -f docker-compose.hub.yml restart app

# Solo MongoDB
docker-compose -f docker-compose.hub.yml restart mongodb
```

### Detener
```bash
# Detener pero mantener datos
docker-compose -f docker-compose.hub.yml down

# Detener y eliminar TODOS los datos (¡cuidado!)
docker-compose -f docker-compose.hub.yml down -v
```

### Backup de MongoDB
```bash
# Crear backup
docker exec olivia-mongodb mongodump --db olivia --out /tmp/backup
docker cp olivia-mongodb:/tmp/backup ./mongodb-backup-$(date +%Y%m%d)

# Restaurar backup
docker cp ./mongodb-backup olivia-mongodb:/tmp/backup
docker exec olivia-mongodb mongorestore /tmp/backup
```

## 🐛 Troubleshooting Común

### 1. No puedo conectar con Odoo

**Síntoma**: Error `EHOSTUNREACH` o `ECONNREFUSED`

**Solución**:
```bash
# Verifica que Odoo esté corriendo
curl http://localhost:8080

# Si no funciona, obtén la IP de WSL
ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1

# Actualiza .env.production con la IP real
ODOO_URL=http://172.X.X.X:8080

# Reinicia la app
docker-compose -f docker-compose.hub.yml restart app
```

### 2. Error de MongoDB

**Síntoma**: `MongooseServerSelectionError`

**Solución**:
```bash
# Ver logs de MongoDB
docker logs olivia-mongodb

# Reiniciar MongoDB
docker-compose -f docker-compose.hub.yml restart mongodb

# Si persiste, verificar puerto
netstat -tuln | grep 27017
```

### 3. Puerto 3000 ocupado

**Solución**: Edita `docker-compose.hub.yml`:
```yaml
services:
  app:
    ports:
      - "3001:3000"  # Usa puerto 3001
```

Luego actualiza `NEXTAUTH_URL`:
```env
NEXTAUTH_URL=http://localhost:3001
```

### 4. Error de autenticación Google OAuth

**Verifica**:
- El redirect URI en Google Console sea exacto
- `NEXTAUTH_SECRET` esté configurado
- `NEXTAUTH_URL` coincida con la URL real

## 📚 Documentación Disponible

- **README.md** - Documentación general del proyecto
- **DEPLOY-DOCKERHUB.md** - Guía detallada de Docker Hub
- **DEPLOY.md** - Todas las opciones de deployment
- **QUICK-START.md** - Guía rápida de inicio
- **README-WINDOWS.md** - Incluido en el paquete de Windows

## ✨ Próximos Pasos

1. ✅ Imagen Docker construida y subida
2. ✅ Paquete de deployment creado
3. ⏳ Transferir `olivia-windows-deployment.tar.gz` a Windows
4. ⏳ Configurar `.env.production` con credenciales reales
5. ⏳ Ejecutar deployment en Windows/WSL
6. ⏳ Verificar que todo funcione correctamente

## 🎯 Checklist de Deployment

- [ ] Imagen subida a Docker Hub ✅
- [ ] Paquete de deployment creado ✅
- [ ] Archivo transferido a Windows
- [ ] `.env.production` configurado con credenciales reales
- [ ] Google OAuth configurado en Google Console
- [ ] Gemini API Key obtenida
- [ ] Odoo accesible desde WSL
- [ ] Deployment ejecutado exitosamente
- [ ] Aplicación accesible en http://localhost:3000
- [ ] Login con Google funciona
- [ ] Conexión a Odoo funciona
- [ ] Chat con Gemini funciona

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose -f docker-compose.hub.yml logs -f`
2. Verifica la configuración en `.env.production`
3. Consulta las guías de troubleshooting en DEPLOY-DOCKERHUB.md
4. Revisa que Odoo esté accesible: `curl http://localhost:8080`

---

**Última actualización**: 2026-01-19
**Versión de la imagen**: latest (20260119)
**Estado**: ✅ Listo para deployment
