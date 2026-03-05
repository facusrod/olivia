/**
 * Seed de usuarios admin iniciales
 * Uso: node scripts/seed-admin.js
 * Requiere MONGODB_URI en .env o como variable de entorno
 */

const mongoose = require('mongoose');
const path = require('path');

// Cargar .env si existe
try {
  const fs = require('fs');
  const envPath = path.resolve(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#') && vals.length > 0) {
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
} catch (e) {
  // No .env file, use existing env vars
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI no definido. Configura .env o pasa como variable de entorno.');
  process.exit(1);
}

// Usuarios admin iniciales
const ADMIN_USERS = [
  { email: 'frcuutn@gmail.com', name: 'Facundo Rodriguez', role: 'admin' },
  { email: 'pontelli58@gmail.com', name: 'Pontelli', role: 'admin' },
  { email: 'greenhouse.cdelu@gmail.com', name: 'Green House CdelU', role: 'user' }
];

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, default: '' },
  googleId: { type: String, default: null },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isActive: { type: Boolean, default: true },
  usage: {
    totalMessages: { type: Number, default: 0 },
    totalConversations: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: null },
  },
}, { timestamps: true });

async function seed() {
  console.log('Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado.\n');

  const User = mongoose.model('User', UserSchema);

  for (const admin of ADMIN_USERS) {
    const existing = await User.findOne({ email: admin.email });
    if (existing) {
      if (existing.role !== admin.role) {
        existing.role = admin.role;
        await existing.save();
        console.log(`🔄 ${admin.email} role actualizado: ${existing.role} → ${admin.role}`);
      } else {
        console.log(`✓ ${admin.email} ya existe (role: ${existing.role}, active: ${existing.isActive})`);
      }
    } else {
      const user = await User.create({
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: true,
      });
      console.log(`✅ ${admin.email} creado como ${admin.role} (id: ${user._id})`);
    }
  }

  console.log('\nSeed completado.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
