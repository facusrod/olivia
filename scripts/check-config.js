// Script para verificar la configuración
require('dotenv').config({ path: '.env' });

console.log('🔍 Verificando configuración de OlivIA...\n');

const checks = {
  'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
  'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET ? '✓ Configurado' : '✗ Falta',
  'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID ? '✓ Configurado' : '✗ Falta',
  'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET ? '✓ Configurado' : '✗ Falta',
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? '✓ Configurado' : '✗ Falta',
  'MONGODB_URI': process.env.MONGODB_URI,
  'ODOO_URL': process.env.ODOO_URL,
  'ODOO_DB': process.env.ODOO_DB,
  'ODOO_USERNAME': process.env.ODOO_USERNAME ? '✓ Configurado' : '✗ Falta',
  'ODOO_PASSWORD': process.env.ODOO_PASSWORD ? '✓ Configurado' : '✗ Falta',
};

console.log('Variables de entorno:');
Object.entries(checks).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n📋 Checklist de Google OAuth:');
console.log('  1. Ve a: https://console.cloud.google.com/apis/credentials');
console.log('  2. Verifica que el Redirect URI sea EXACTAMENTE:');
console.log('     http://localhost:3000/api/auth/callback/google');
console.log('  3. Asegúrate de haber guardado los cambios en Google Cloud Console');
console.log('  4. Espera 1-2 minutos después de guardar cambios');

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'your-secret-here-generate-with-openssl-rand-base64-32') {
  console.log('\n⚠️  NEXTAUTH_SECRET no está configurado correctamente');
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.log('\n⚠️  Credenciales de Google OAuth faltantes');
}

console.log('\n✅ Si todo está bien arriba, el problema puede ser:');
console.log('  - Google OAuth redirect URI mal configurado');
console.log('  - Cambios recientes en Google Cloud Console no aplicados aún');
console.log('  - Cache del navegador (prueba en ventana incógnito)');
