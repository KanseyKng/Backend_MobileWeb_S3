# 🧊 Ikobana Frozen Food — Backend API

Backend REST API dengan fitur **Authentication** & **RBAC** untuk aplikasi Ikobana Frozen Food.

**Tech Stack:** Node.js · TypeScript · Express · Prisma · SQLite · JWT · bcrypt

---

## ⚡ Cara Menjalankan (5 Langkah)

### 1. Install dependencies
```bash
npm install

2. buat .env di root folder
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET=rahasia_ikobana_super_aman
JWT_EXPIRES_IN=7d

3. setup database
npx prisma migrate dev --name init

4. isi akun dummy
npm run seed

5. jalankan server
npm run dev

admin:
email: admin@ikobana.com
password: admin123456