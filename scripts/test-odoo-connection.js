#!/usr/bin/env node

const net = require('net');
const http = require('http');

const ODOO_HOST = '192.168.1.21';
const ODOO_PORT = 8069;

console.log('🔍 Diagnosticando conexión a Odoo...\n');

// Test 1: Ping TCP
console.log('Test 1: Verificando conectividad TCP...');
const socket = new net.Socket();
socket.setTimeout(5000);

socket.on('connect', () => {
  console.log('✅ Puerto 8069 está abierto y accesible');
  socket.destroy();
  testHTTP();
});

socket.on('timeout', () => {
  console.log('❌ Timeout al intentar conectar (firewall o puerto cerrado)');
  socket.destroy();
  showSolutions();
});

socket.on('error', (err) => {
  console.log(`❌ Error de conexión: ${err.message}`);
  if (err.code === 'EHOSTUNREACH') {
    console.log('   - No se puede alcanzar el host en la red');
  } else if (err.code === 'ECONNREFUSED') {
    console.log('   - El puerto está cerrado o Odoo no está corriendo');
  } else if (err.code === 'ETIMEDOUT') {
    console.log('   - Timeout de conexión (firewall o red lenta)');
  }
  showSolutions();
});

socket.connect(ODOO_PORT, ODOO_HOST);

// Test 2: HTTP Request
function testHTTP() {
  console.log('\nTest 2: Verificando respuesta HTTP...');

  const options = {
    hostname: ODOO_HOST,
    port: ODOO_PORT,
    path: '/web/database/selector',
    method: 'GET',
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Respuesta HTTP recibida (status: ${res.statusCode})`);
    console.log('\n🎉 Odoo está accesible!\n');
    testXMLRPC();
  });

  req.on('timeout', () => {
    console.log('❌ Timeout en petición HTTP');
    req.destroy();
    showSolutions();
  });

  req.on('error', (err) => {
    console.log(`❌ Error HTTP: ${err.message}`);
    showSolutions();
  });

  req.end();
}

// Test 3: XML-RPC
function testXMLRPC() {
  console.log('Test 3: Probando XML-RPC...');

  const xmlrpc = require('xmlrpc');

  const client = xmlrpc.createClient({
    host: ODOO_HOST,
    port: ODOO_PORT,
    path: '/xmlrpc/2/common',
  });

  client.methodCall('version', [], (error, value) => {
    if (error) {
      console.log(`❌ Error XML-RPC: ${error.message}`);
      showSolutions();
    } else {
      console.log('✅ XML-RPC funciona correctamente');
      console.log(`   Versión de Odoo:`, value);
      console.log('\n✨ Todo está funcionando correctamente!\n');
    }
  });
}

function showSolutions() {
  console.log('\n📋 Posibles soluciones:\n');
  console.log('1. Verifica que Odoo esté corriendo en 192.168.1.21');
  console.log('   - Accede a http://192.168.1.21:8069 desde un navegador\n');

  console.log('2. Verifica la configuración de Odoo:');
  console.log('   - Edita el archivo de configuración de Odoo (odoo.conf)');
  console.log('   - Asegúrate de que tenga: xmlrpc_interface = 0.0.0.0');
  console.log('   - Por defecto puede estar en: 127.0.0.1 (solo localhost)\n');

  console.log('3. Verifica el firewall en la PC de Odoo:');
  console.log('   Windows: Abre el puerto 8069 en Windows Firewall');
  console.log('   Linux: sudo ufw allow 8069\n');

  console.log('4. Verifica que ambas PCs estén en la misma red:');
  console.log('   Desde tu Mac, prueba: ping 192.168.1.21\n');

  console.log('5. Si Odoo está en Docker, asegúrate de mapear el puerto:');
  console.log('   docker run -p 8069:8069 ...\n');

  process.exit(1);
}
