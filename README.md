# OlivIA - Asistente Inteligente para Tienda de Productos Saludables

Asistente con IA integrado con Odoo 18 para gestion de inventario, ventas y consultas de productos.

## Stack

- **App**: Next.js 14, TypeScript, Tailwind CSS
- **DB**: MongoDB (Mongoose) - singleton para serverless
- **IA**: Google Gemini AI
- **ERP**: Odoo 18 (XML-RPC)
- **Auth**: NextAuth.js (Google OAuth)
- **Produccion**: Vercel + MongoDB Atlas
- **Dev local**: Docker (MongoDB + Odoo 18 + PostgreSQL)

## Desarrollo local

### Prerequisitos
- Node.js 20+
- Docker / Docker Compose

### Setup

```bash
# 1. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 2. Levantar servicios (MongoDB + Odoo 18 + PostgreSQL)
docker compose -f docker-compose.dev.yml up -d

# 3. Configurar Odoo (primera vez)
# Ir a http://localhost:8069 y crear la base de datos "odoo"
# Credenciales por defecto: admin / admin

# 4. Instalar dependencias y correr
npm install
npm run dev
```

App disponible en http://localhost:3000

### Configurar Google OAuth

1. Ir a [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials
2. Create Credentials > OAuth Client ID > Web application
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copiar Client ID y Client Secret al `.env`

### Generar NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

## Produccion (Vercel)

### Deploy
1. Conectar el repo en [vercel.com](https://vercel.com)
2. Configurar variables de entorno (ver `.env.production.example`)
3. Configurar dominio: `olivia.tu-dominio.com` → CNAME `cname.vercel-dns.com`

### Conexion Odoo desde Vercel
Odoo puede estar protegido por Cloudflare Zero Trust.

Opciones:
1. **Service Token de Zero Trust** - CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
2. **Subdominio API** - subdominio sin Zero Trust + API key de Odoo

## Estructura del proyecto

```
app/
  (protected)/            # Rutas protegidas (chat, dashboard, products, suggestions)
  api/                    # API routes (serverless en Vercel)
    auth/[...nextauth]/   # NextAuth
    chat/                 # Chat con Gemini
    conversations/        # CRUD conversaciones
    dashboard/            # Metricas
    products/             # Productos Odoo
    purchase-suggestions/ # Sugerencias IA
  login/                  # Login page
lib/
  mongodb.ts              # Conexion MongoDB (singleton serverless-safe)
  odoo.ts                 # Cliente XML-RPC Odoo 18
  gemini.ts               # Servicio Gemini AI
  auth-options.ts         # Config NextAuth
models/
  Conversation.ts         # Schema conversaciones
  PurchaseSuggestion.ts   # Schema sugerencias
docker-compose.dev.yml    # MongoDB + Odoo 18 para dev local
odoo.conf                 # Config Odoo local
```

## Funcionalidades

- **Chat con IA**: consultas sobre productos (Keto, vegano, sin gluten), stock, ventas
- **Dashboard**: metricas de ventas, stock bajo, productos por vencer
- **Productos**: inventario en tiempo real desde Odoo
- **Sugerencias de compra**: analisis automatico con IA basado en ventas y stock
- **Historial**: conversaciones almacenadas por usuario en MongoDB

## Troubleshooting

| Error | Solucion |
|-------|----------|
| `Odoo authentication failed` | Verificar credenciales en `.env` y que Odoo este corriendo en :8069 |
| `MongooseServerSelectionError` | Verificar que MongoDB este corriendo: `docker compose -f docker-compose.dev.yml up -d` |
| `OAuthCallback error` | Verificar redirect URI en Google Console y credenciales en `.env` |
| `Error al procesar el mensaje` | Verificar `GEMINI_API_KEY` y cuota en Google AI Studio |

## Notas tecnicas

- `xmlrpc` funciona en Vercel serverless (usa Node.js http module)
- Odoo XML-RPC es stateless, no necesita sesion persistente
- MongoDB usa singleton en `global` para reusar conexion en warm invocations
- El cliente xmlrpc cachea instancias para evitar recrearlas en cada llamada

## Comandos utiles

```bash
npm run dev       # Desarrollo
npm run build     # Build produccion
npm run lint      # Linting
```

---

Uso interno - Todos los derechos reservados
