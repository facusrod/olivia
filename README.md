# OlivIA - Asistente Inteligente para Tienda de Productos Saludables

Sistema completo de gestión de inventario, ventas y asistente de chat con IA integrado con Odoo.

## Características

- **Chat Inteligente con Gemini AI**: Consultas rápidas sobre productos (dietas Keto, veganas, etc.)
- **Integración con Odoo**: Conexión XML-RPC para acceder a productos, ventas y órdenes
- **Gestión de Inventario**: Visualización en tiempo real de productos y stock
- **Sugerencias de Compra**: Análisis automático con IA basado en ventas y stock
- **Historial de Conversaciones**: Almacenamiento de chats por usuario en MongoDB
- **Autenticación con Google**: Login seguro usando Google OAuth

## Stack Tecnológico

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de Datos**: MongoDB (conversaciones)
- **IA**: Google Gemini AI
- **ERP**: Odoo (XML-RPC)
- **Autenticación**: NextAuth.js con Google OAuth
- **Containerización**: Docker & Docker Compose

## Requisitos Previos

- Node.js 20+
- Docker y Docker Compose
- Odoo instalado y corriendo (localhost:8069 por defecto)
- Cuenta de Google Cloud (para OAuth)
- API Key de Gemini AI

## Instalación

### 1. Clonar el repositorio

```bash
cd olivia
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env` con tus datos:

```env
# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-generado-con-openssl

# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret

# Gemini AI
GEMINI_API_KEY=tu-api-key-de-gemini

# MongoDB
MONGODB_URI=mongodb://mongodb:27017/olivia

# Odoo XML-RPC
ODOO_URL=http://host.docker.internal:8069
ODOO_DB=nombre-de-tu-base-de-datos
ODOO_USERNAME=tu-usuario-odoo
ODOO_PASSWORD=tu-password-odoo
```

### 3. Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita "Google+ API"
4. Ve a **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **OAuth Client ID**
6. Tipo de aplicación: **Web application**
7. Nombre: **OlivIA**
8. **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`
9. Copia el **Client ID** y **Client Secret** a tu `.env`

### 4. Generar NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Copia el resultado en `NEXTAUTH_SECRET` en tu `.env`

### 5. Configurar Odoo

Asegúrate de que tu instancia de Odoo esté corriendo y que tengas:
- Nombre de la base de datos
- Usuario con permisos de acceso
- Contraseña del usuario

**Nota**: Si Odoo está en localhost, usa `http://host.docker.internal:8069` en Docker.

## Uso

### Opción 1: Desarrollo Local (Sin Docker para la App)

Ejecuta solo MongoDB en Docker y la app localmente:

```bash
# Iniciar MongoDB
docker-compose -f docker-compose.dev.yml up -d

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

### Opción 2: Todo en Docker (Producción)

```bash
# Construir y ejecutar todo
docker-compose up --build

# O en modo background
docker-compose up -d --build
```

Para ver los logs:
```bash
docker-compose logs -f
```

Para detener:
```bash
docker-compose down
```

## Deployment en Producción (Windows/WSL con Odoo)

Si quieres desplegar OlivIA en la misma PC donde está corriendo Odoo (Windows con WSL):

### ⭐ Opción Recomendada: Docker Hub (Más fácil)

```bash
# 1. En tu Mac: Subir a Docker Hub
./scripts/push-to-dockerhub.sh TU_USUARIO

# 2. En Windows WSL: Descargar y ejecutar
./scripts/deploy-from-hub.sh TU_USUARIO
```

**✨ Ventajas**: No necesitas transferir archivos manualmente, actualizaciones simples con `docker pull`

**📖 Guía completa**: Ver [DEPLOY-DOCKERHUB.md](./DEPLOY-DOCKERHUB.md)

### Opción B: Construir localmente

```bash
# 1. Construir la imagen Docker
./scripts/build-docker.sh

# 2. Configurar variables de entorno
cp .env.production.example .env.production
nano .env.production

# 3. Iniciar servicios de producción
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Opción C: Exportar e importar imagen (.tar)

```bash
# En tu Mac: Exportar imagen
./scripts/build-docker.sh
./scripts/export-docker.sh

# Esto crea: exports/olivia-app_TIMESTAMP.tar
# Transfiere este archivo a la PC Windows (USB, red, etc.)

# En Windows WSL: Importar imagen
docker load -i olivia-app_TIMESTAMP.tar
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

**📖 Más opciones de deployment**: Ver [DEPLOY.md](./DEPLOY.md) para instrucciones detalladas

## Estructura del Proyecto

```
olivia/
├── app/
│   ├── (protected)/           # Rutas protegidas (requieren autenticación)
│   │   ├── layout.tsx        # Layout compartido con sidebar
│   │   ├── chat/             # Chat con OlivIA
│   │   │   └── page.tsx
│   │   ├── products/         # Gestión de productos
│   │   │   └── page.tsx
│   │   ├── suggestions/      # Sugerencias de compra IA
│   │   │   └── page.tsx
│   │   ├── history/          # Historial de conversaciones
│   │   │   └── page.tsx
│   │   └── conversation/[id] # Vista de conversación individual
│   │       └── page.tsx
│   ├── api/                  # API Routes
│   │   ├── auth/[...nextauth] # NextAuth endpoint
│   │   ├── chat/             # Endpoint de chat con Gemini
│   │   ├── products/         # API de productos Odoo
│   │   ├── conversations/    # CRUD de conversaciones
│   │   └── purchase-suggestions/ # Generación de sugerencias
│   ├── login/                # Página de login
│   │   └── page.tsx
│   ├── page.tsx              # Página principal (redirige a /chat)
│   └── layout.tsx            # Layout raíz
├── components/               # Componentes React reutilizables
│   ├── DashboardWrapper.tsx  # Contenedor con sidebar
│   ├── Sidebar.tsx           # Navegación lateral
│   └── Providers.tsx         # Proveedores de contexto
├── lib/                      # Utilidades y servicios
│   ├── auth.ts               # Helpers de autenticación
│   ├── gemini.ts             # Cliente de Gemini AI
│   ├── mongodb.ts            # Conexión MongoDB
│   └── odoo.ts               # Cliente XML-RPC Odoo
├── models/                   # Modelos de MongoDB
│   └── Conversation.ts       # Esquema de conversaciones
├── scripts/                  # Scripts de utilidad
│   └── test-odoo-connection.js # Diagnóstico de conexión
├── docker-compose.yml        # Configuración Docker completa
├── docker-compose.dev.yml    # Solo MongoDB para desarrollo
└── Dockerfile                # Imagen de producción
```

### Nota sobre `(protected)`
En Next.js 13+, los paréntesis crean un "route group" que:
- **NO aparece en la URL**: `/chat`, `/products`, etc. (sin "/protected")
- **Comparte layout**: Todas las rutas heredan el layout con autenticación y sidebar
- **Organiza código**: Agrupa rutas relacionadas sin afectar las URLs

## Funcionalidades Principales

### 1. Chat con OlivIA

- Pregunta sobre productos por características (Keto, vegano, sin gluten, etc.)
- Consulta stock disponible
- Obtén información de ventas
- Recibe recomendaciones personalizadas

**Ejemplos de preguntas:**
- "¿Qué productos Keto tenemos disponibles?"
- "¿Cuáles son los productos más vendidos este mes?"
- "¿Qué productos tienen bajo stock?"

### 2. Gestión de Productos

- Visualización completa del inventario
- Búsqueda por nombre o código
- Indicadores de stock (disponible, bajo, sin stock)
- Información de precios y categorías

### 3. Sugerencias de Compra

- Análisis automático de productos con bajo stock
- Identificación de productos más vendidos
- Recomendaciones de IA sobre qué comprar
- Justificaciones basadas en datos reales

### 4. Historial de Conversaciones

- Almacena todas las conversaciones por usuario
- Búsqueda y revisión de chats anteriores
- Gestión de conversaciones (eliminar)

## Solución de Problemas

### Error de conexión a Odoo

```
Error: Odoo authentication failed
```

**Solución:**
- Verifica que Odoo esté corriendo
- Confirma las credenciales en `.env`
- Si usas Docker, asegúrate de usar `host.docker.internal` en lugar de `localhost`

### Error de conexión a MongoDB

```
MongooseServerSelectionError
```

**Solución:**
- Si usas desarrollo local: `docker-compose -f docker-compose.dev.yml up -d`
- Verifica que el puerto 27017 no esté en uso
- Revisa los logs: `docker-compose logs mongodb`

### Error de Google OAuth

```
OAuthCallback error
```

**Solución:**
- Verifica que el redirect URI en Google Console sea exactamente: `http://localhost:3000/api/auth/callback/google`
- Confirma que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén correctos
- Asegúrate de tener `NEXTAUTH_SECRET` configurado

### Error de Gemini AI

```
Error al procesar el mensaje
```

**Solución:**
- Verifica tu `GEMINI_API_KEY` en `.env`
- Confirma que tengas cuota disponible en tu cuenta de Google AI Studio
- Revisa los logs del servidor para más detalles

## Comandos Útiles

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build
npm start

# Linting
npm run lint

# Docker - Ver logs en tiempo real
docker-compose logs -f app

# Docker - Reiniciar solo la app
docker-compose restart app

# Docker - Limpiar todo y empezar de cero
docker-compose down -v
docker-compose up --build
```

## Seguridad

- **Nunca** commitees el archivo `.env`
- Usa variables de entorno diferentes para producción
- Las API keys deben mantenerse privadas
- Solo usuarios autenticados pueden acceder al sistema

## Contribuir

Este es un proyecto interno. Para reportar bugs o sugerencias, contacta al equipo de desarrollo.

## Licencia

Uso interno - Todos los derechos reservados

## Soporte

Para ayuda adicional:
- Revisa la documentación de [Next.js](https://nextjs.org/docs)
- Documentación de [Odoo XML-RPC](https://www.odoo.com/documentation/16.0/developer/reference/external_api.html)
- API de [Google Gemini](https://ai.google.dev/docs)

---

Desarrollado con ❤️ para optimizar la gestión de tu tienda de productos saludables
