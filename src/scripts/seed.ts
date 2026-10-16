// src/scripts/seed.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';

const dummyUsers = [
  {
    name: 'Admin Ikobana',
    email: 'admin@ikobana.com',
    phone: '81234567899',
    password: 'admin123456',
    role: 'ADMIN',
  },
  {
    name: 'Andi Pratama',
    email: 'andi@email.com',
    phone: '81234567890',
    password: 'password123',
    role: 'USER',
  },
  {
    name: 'Budi Santoso',
    email: 'budi@email.com',
    phone: '81234567891',
    password: 'password123',
    role: 'USER',
  },
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...\n');

    // Hapus user lama
    await prisma.user.deleteMany({});
    console.log('🗑️  User lama dihapus\n');

    // Buat user baru
    for (const userData of dummyUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
      });
      console.log(`   ✅ ${user.role.padEnd(5)} | ${user.email}`);
    }

    console.log('');
    console.log('════════════════════════════════════════');
    console.log('🎉 SEEDING BERHASIL! Akun dummy siap:');
    console.log('════════════════════════════════════════');
    console.log('👤 ADMIN:');
    console.log('   Email    : admin@ikobana.com');
    console.log('   Password : admin123456');
    console.log('   Role     : ADMIN');
    console.log('');
    console.log('👤 USER 1:');
    console.log('   Email    : andi@email.com');
    console.log('   Password : password123');
    console.log('   Role     : USER');
    console.log('');
    console.log('👤 USER 2:');
    console.log('   Email    : budi@email.com');
    console.log('   Password : password123');
    console.log('   Role     : USER');
    console.log('════════════════════════════════════════');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

seedDatabase();