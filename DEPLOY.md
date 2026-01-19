# Guía de Deployment - OlivIA

Esta guía te ayudará a desplegar OlivIA en la PC con Windows/WSL donde está corriendo Odoo.

## Pre-requisitos

- Windows con WSL 2 instalado
- Docker Desktop para Windows (con integración WSL 2)
- Odoo corriendo en el mismo sistema (puerto 8080)

## Opción 1: Construir en la PC de destino

### Paso 1: Transferir el código fuente

```bash
# En tu Mac, crea un archivo comprimido (sin node_modules)
tar -czf olivia-source.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='exports' \
  --exclude='.git' \
  .

# Transfiere a la PC Windows (puedes usar USB, red compartida, etc.)
```

### Paso 2: En la PC Windows/WSL

```bash
# Extrae el código
tar -xzf olivia-source.tar.gz -C ~/olivia
cd ~/olivia

# Construye la imagen Docker
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh
```

### Paso 3: Configura las variables de entorno

```bash
# Crea el archivo .env.production
cp .env.production.example .env.production

# Edita con tus valores reales
nano .env.production
```

Asegúrate de configurar:
```env
NEXTAUTH_SECRET=tu-secret-generado
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GEMINI_API_KEY=tu-gemini-api-key

# Odoo en localhost (WSL)
ODOO_URL=http://host.docker.internal:8080
ODOO_DB=odoo
ODOO_USERNAME=odoo
ODOO_PASSWORD=odoo
```

### Paso 4: Inicia los servicios

```bash
# Carga las variables de entorno y levanta los contenedores
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Ver los logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Opción 2: Transferir imagen Docker pre-construida

### Paso 1: En tu Mac, construye y exporta la imagen

```bash
# Construye la imagen
chmod +x scripts/build-docker.sh scripts/export-docker.sh
./scripts/build-docker.sh

# Exporta a archivo .tar
./scripts/export-docker.sh
```

Esto creará un archivo en `exports/olivia-app_YYYYMMDD_HHMMSS.tar`

### Paso 2: Transfiere el archivo .tar a Windows

Copia el archivo a la PC Windows usando:
- USB
- Carpeta compartida en red
- SCP/SFTP
- OneDrive/Google Drive

### Paso 3: En Windows WSL, carga la imagen

```bash
# Desde WSL
cd /mnt/c/Users/TuUsuario/Downloads  # o donde esté el archivo

# Carga la imagen en Docker
docker load -i olivia-app_20250119_123456.tar

# Verifica que se cargó
docker images | grep olivia
```

### Paso 4: Prepara los archivos de configuración

```bash
# Crea un directorio para OlivIA
mkdir -p ~/olivia
cd ~/olivia

# Copia o crea estos archivos:
```

Crea `docker-compose.prod.yml` (igual que en el repo)

Crea `.env.production` con tus valores:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret
GOOGLE_CLIENT_ID=tu-id
GOOGLE_CLIENT_SECRET=tu-secret
GEMINI_API_KEY=tu-key
ODOO_URL=http://host.docker.internal:8080
ODOO_DB=odoo
ODOO_USERNAME=odoo
ODOO_PASSWORD=odoo
```

### Paso 5: Inicia los servicios

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Verificación

### 1. Verifica que los contenedores están corriendo

```bash
docker ps
```

Deberías ver:
- `olivia-app` (puerto 3000)
- `olivia-mongodb` (puerto 27017)

### 2. Verifica los logs

```bash
# Logs de la app
docker logs olivia-app -f

# Logs de MongoDB
docker logs olivia-mongodb
```

### 3. Prueba la aplicación

Abre un navegador en Windows y ve a:
```
http://localhost:3000
```

### 4. Verifica la conexión a Odoo

```bash
# Entra al contenedor de la app
docker exec -it olivia-app sh

# Prueba conectividad a Odoo (debe responder)
wget -O- http://host.docker.internal:8080/web/database/selector
```

## Troubleshooting

### Error: No se puede conectar a Odoo

**Problema**: `EHOSTUNREACH` o `ECONNREFUSED`

**Solución**:
1. Verifica que Odoo esté corriendo: `curl http://localhost:8080`
2. Verifica que Docker Desktop tenga habilitado "Expose daemon on tcp://localhost:2375 without TLS"
3. Prueba cambiar `host.docker.internal` por la IP de WSL:
   ```bash
   # Obtén la IP de WSL
   ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1

   # Usa esa IP en ODOO_URL
   ODOO_URL=http://172.X.X.X:8080
   ```

### Error: MongoDB connection failed

**Solución**:
```bash
# Verifica que MongoDB esté corriendo
docker ps | grep mongodb

# Reinicia MongoDB si es necesario
docker-compose -f docker-compose.prod.yml restart mongodb

# Verifica logs
docker logs olivia-mongodb
```

### Error: Cannot read .env.production

**Solución**:
```bash
# Asegúrate de que el archivo existe y tiene el formato correcto
cat .env.production

# Verifica que no tenga caracteres especiales de Windows
dos2unix .env.production  # si está disponible
```

## Comandos Útiles

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f app

# Reiniciar la app
docker-compose -f docker-compose.prod.yml restart app

# Detener todo
docker-compose -f docker-compose.prod.yml down

# Detener y eliminar volúmenes (¡cuidado! Borra la DB)
docker-compose -f docker-compose.prod.yml down -v

# Ver uso de recursos
docker stats

# Actualizar la app (después de reconstruir imagen)
docker-compose -f docker-compose.prod.yml up -d --force-recreate app
```

## Actualizar la aplicación

Cuando necesites actualizar OlivIA:

```bash
# 1. Construye nueva imagen (o carga desde .tar)
docker build -t olivia-app:latest .

# 2. Reinicia el contenedor
docker-compose -f docker-compose.prod.yml up -d --force-recreate app
```

## Backup de datos

Para hacer backup de las conversaciones en MongoDB:

```bash
# Crear backup
docker exec olivia-mongodb mongodump --db olivia --out /tmp/backup
docker cp olivia-mongodb:/tmp/backup ./mongodb-backup

# Restaurar backup
docker cp ./mongodb-backup olivia-mongodb:/tmp/backup
docker exec olivia-mongodb mongorestore /tmp/backup
```

## Acceso desde otras PCs en la red

Si quieres acceder desde otras computadoras en tu red local:

1. Obtén la IP de tu PC Windows:
   ```bash
   # En PowerShell
   ipconfig
   # Busca IPv4 Address, ej: 192.168.1.21
   ```

2. Configura el firewall de Windows para permitir el puerto 3000

3. Actualiza `NEXTAUTH_URL` en `.env.production`:
   ```env
   NEXTAUTH_URL=http://192.168.1.21:3000
   ```

4. Reinicia la app:
   ```bash
   docker-compose -f docker-compose.prod.yml restart app
   ```

5. Accede desde otras PCs: `http://192.168.1.21:3000`

## Soporte

Para más información:
- Logs de la aplicación: `docker logs olivia-app -f`
- Documentación de Docker: https://docs.docker.com/
- Documentación de Next.js: https://nextjs.org/docs
