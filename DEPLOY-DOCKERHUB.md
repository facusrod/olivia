# Deployment con Docker Hub

Guía simplificada para desplegar OlivIA usando Docker Hub. Esta es la forma **más fácil y rápida** de deployment.

## 🎯 Ventajas de usar Docker Hub

- ✅ No necesitas transferir archivos .tar manualmente
- ✅ Actualizaciones simples con `docker pull`
- ✅ Versionado automático
- ✅ Acceso desde cualquier máquina con internet

## 📋 Pre-requisitos

1. Cuenta en [Docker Hub](https://hub.docker.com/) (gratis)
2. Docker instalado en ambas máquinas

## 🚀 Paso 1: Subir imagen desde tu Mac

### 1.1 Login a Docker Hub

```bash
docker login
# Ingresa tu usuario y password de Docker Hub
```

### 1.2 Construir y subir la imagen

```bash
# Opción A: Usar el script automático
./scripts/push-to-dockerhub.sh TU_USUARIO

# Ejemplo:
./scripts/push-to-dockerhub.sh facundo

# Opción B: Manualmente
docker build -t olivia-app:latest .
docker tag olivia-app:latest TU_USUARIO/olivia-app:latest
docker push TU_USUARIO/olivia-app:latest
```

Esto subirá la imagen a: `https://hub.docker.com/r/TU_USUARIO/olivia-app`

## 📥 Paso 2: Descargar y ejecutar en Windows/WSL

### 2.1 Preparar archivos de configuración

En Windows WSL, crea un directorio para OlivIA:

```bash
mkdir -p ~/olivia
cd ~/olivia
```

Necesitas solo **3 archivos**:

1. **docker-compose.hub.yml** - Copia desde el repositorio
2. **.env.production** - Copia desde .env.production.example y configura
3. **scripts/deploy-from-hub.sh** (opcional, para automatizar)

### 2.2 Crear .env.production

```bash
# Copia el ejemplo (o crea manualmente)
cat > .env.production << 'EOF'
# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-generado

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
DOCKER_USERNAME=TU_USUARIO
VERSION=latest
EOF

# Edita con tus valores
nano .env.production
```

### 2.3 Desplegar

**Opción A: Usar el script automático**

```bash
chmod +x scripts/deploy-from-hub.sh
./scripts/deploy-from-hub.sh TU_USUARIO
```

**Opción B: Manual**

```bash
# Descargar imagen
docker pull TU_USUARIO/olivia-app:latest

# Iniciar servicios
docker-compose -f docker-compose.hub.yml --env-file .env.production up -d

# Ver logs
docker-compose -f docker-compose.hub.yml logs -f
```

### 2.4 Verificar

```bash
# Ver contenedores corriendo
docker ps

# Deberías ver:
# - olivia-app (puerto 3000)
# - olivia-mongodb (puerto 27017)

# Accede a: http://localhost:3000
```

## 🔄 Actualizar la aplicación

Cuando hagas cambios en el código:

### En tu Mac:

```bash
# Reconstruir y subir nueva versión
./scripts/push-to-dockerhub.sh TU_USUARIO
```

### En Windows/WSL:

```bash
# Descargar nueva versión y actualizar
docker-compose -f docker-compose.hub.yml pull
docker-compose -f docker-compose.hub.yml up -d

# O en un solo comando:
docker-compose -f docker-compose.hub.yml pull && \
docker-compose -f docker-compose.hub.yml up -d --force-recreate app
```

## 🏷️ Versionado

Puedes usar versiones específicas en lugar de `latest`:

### Subir versión específica:

```bash
# En tu Mac
./scripts/push-to-dockerhub.sh TU_USUARIO v1.0.0
```

### Descargar versión específica:

```bash
# En Windows, edita .env.production:
VERSION=v1.0.0

# Luego despliega
docker-compose -f docker-compose.hub.yml up -d
```

## 📦 Hacer imagen privada (opcional)

Por defecto, las imágenes en Docker Hub son públicas. Para hacerla privada:

1. Ve a https://hub.docker.com/
2. Selecciona tu repositorio `olivia-app`
3. Settings → Make Private

Nota: Docker Hub permite 1 repositorio privado gratis.

## 🔐 Configuración de seguridad

### No incluir secretos en la imagen

La imagen **NO debe** contener:
- Archivos .env
- Credenciales
- API keys

Estos se configuran en tiempo de ejecución via `.env.production`.

### Verificar que .env está ignorado

```bash
# El .gitignore debe incluir:
.env
.env.production
.env*.local
```

## 🐛 Troubleshooting

### Error al hacer push: denied

```bash
# Asegúrate de hacer login primero
docker login

# Verifica que el nombre de usuario sea correcto
docker tag olivia-app:latest TU_USUARIO/olivia-app:latest
```

### Error al hacer pull en Windows

```bash
# Verifica que la imagen existe
# Ve a: https://hub.docker.com/r/TU_USUARIO/olivia-app

# Si la imagen es privada, haz login:
docker login
```

### Imagen muy pesada / tarda mucho

La primera vez puede tardar porque Docker Hub tiene que subir todos los layers. Las siguientes veces será más rápido porque solo sube los cambios.

Para optimizar:
- El Dockerfile usa multi-stage build (ya optimizado)
- Puedes habilitar buildkit: `export DOCKER_BUILDKIT=1`

### No puedo acceder desde otra PC en la red

Si quieres acceder desde otra PC (no solo localhost):

1. Obtén la IP de tu Windows:
   ```bash
   # En WSL
   ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1
   ```

2. Actualiza .env.production:
   ```env
   NEXTAUTH_URL=http://192.168.1.X:3000
   ```

3. Configura firewall de Windows para permitir puerto 3000

4. Reinicia:
   ```bash
   docker-compose -f docker-compose.hub.yml restart app
   ```

## 📊 Comandos útiles

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.hub.yml logs -f app

# Ver todas las imágenes locales
docker images | grep olivia

# Limpiar imágenes viejas
docker image prune -a

# Ver uso de espacio
docker system df

# Backup de MongoDB
docker exec olivia-mongodb mongodump --db olivia --out /tmp/backup
docker cp olivia-mongodb:/tmp/backup ./mongodb-backup-$(date +%Y%m%d).tar

# Restaurar backup
docker cp ./mongodb-backup.tar olivia-mongodb:/tmp/backup
docker exec olivia-mongodb mongorestore /tmp/backup
```

## 🌐 Alternativa: GitHub Container Registry

Si prefieres usar GitHub en lugar de Docker Hub:

```bash
# Login a GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u TU_USUARIO --password-stdin

# Tag y push
docker tag olivia-app:latest ghcr.io/TU_USUARIO/olivia-app:latest
docker push ghcr.io/TU_USUARIO/olivia-app:latest

# En Windows, pull desde GitHub:
docker pull ghcr.io/TU_USUARIO/olivia-app:latest
```

## 📚 Recursos

- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

---

**¿Necesitas ayuda?** Revisa los logs con `docker-compose -f docker-compose.hub.yml logs -f`
