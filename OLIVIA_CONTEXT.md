# Olivia - Contexto del Proyecto

## Resumen
Olivia es una app Next.js 14 con MongoDB y conexion a Odoo 18 via XML-RPC.
- **Produccion**: Vercel + MongoDB Atlas
- **Desarrollo local**: Next.js dev server + Docker (MongoDB + Odoo 18 + PostgreSQL)

## Stack tecnico
- Next.js 14 + TypeScript + Tailwind CSS
- MongoDB (Mongoose) - singleton pattern para serverless
- NextAuth (Google OAuth)
- Google Generative AI (Gemini)
- xmlrpc + axios (conexion a Odoo 18)

## Desarrollo local

### Prerequisitos
- Node.js 20+
- Docker / Docker Compose

### Setup
```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con tus credenciales (Google OAuth, Gemini API key)

# 2. Levantar servicios (MongoDB + Odoo 18 + PostgreSQL)
docker compose -f docker-compose.dev.yml up -d

# 3. Configurar Odoo (primera vez)
# Ir a http://localhost:8069 y crear la base de datos "odoo"
# Las credenciales por defecto son admin/admin

# 4. Instalar dependencias y correr
npm install
npm run dev
# App disponible en http://localhost:3000
```

### Variables de entorno locales
```
MONGODB_URI=mongodb://localhost:27017/olivia
ODOO_URL=http://localhost:8069
ODOO_DB=odoo
ODOO_USERNAME=admin
ODOO_PASSWORD=admin
```

## Produccion (Vercel)

### Deploy
1. Conectar el repo en vercel.com
2. Configurar variables de entorno en Vercel (ver .env.production.example)
3. Configurar dominio: olivia.greenhouse.com.ar -> CNAME cname.vercel-dns.com

### Variables de entorno produccion
```
MONGODB_URI=mongodb+srv://...  (MongoDB Atlas)
ODOO_URL=https://odoo.greenhouse.com.ar
NEXTAUTH_URL=https://olivia.greenhouse.com.ar
```

### Conexion Odoo desde Vercel
Odoo esta en https://odoo.greenhouse.com.ar protegido por Cloudflare Zero Trust.
Opciones:
1. Service Token de Zero Trust (CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET)
2. Subdominio api.greenhouse.com.ar sin Zero Trust + API key

## Estructura de archivos clave
```
app/                    # Next.js App Router
  api/                  # API routes (serverless functions en Vercel)
  (protected)/          # Rutas protegidas (chat, dashboard, products)
lib/
  mongodb.ts            # Conexion MongoDB (singleton serverless-safe)
  odoo.ts               # Cliente XML-RPC para Odoo 18
  gemini.ts             # Servicio Gemini AI
  auth-options.ts       # Config NextAuth
models/                 # Schemas Mongoose
docker-compose.dev.yml  # MongoDB + Odoo para desarrollo local
odoo.conf               # Config Odoo local
```

## Dominios
| Dominio | Destino | Proteccion |
|---------|---------|------------|
| greenhouse.com.ar | Redirige a www | - |
| www.greenhouse.com.ar | Tienda Odoo | Publica |
| odoo.greenhouse.com.ar | Admin Odoo | Zero Trust |
| olivia.greenhouse.com.ar | Vercel | Por definir |

## Notas tecnicas
- xmlrpc funciona en Vercel serverless (usa Node.js http module, compatible)
- Odoo XML-RPC es stateless, no necesita sesion persistente
- MongoDB usa singleton en `global` para reusar conexion en warm invocations
- El cliente xmlrpc cachea instancias para evitar recrearlas en cada llamada
