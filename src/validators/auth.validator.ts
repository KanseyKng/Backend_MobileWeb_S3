// src/validators/auth.validator.ts

/**
 * Validasi register
 */
export const validateRegister = (body: any): string[] => {
  const errors: string[] = [];

  if (!body.name || body.name.trim().length < 2) {
    errors.push('Nama minimal 2 karakter');
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Format email tidak valid');
  }

  if (!body.phone || body.phone.replace(/\D/g, '').length < 10) {
    errors.push('Nomor HP minimal 10 digit');
  }

  if (!body.password || body.password.length < 8) {
    errors.push('Password minimal 8 karakter');
  }

  return errors;
};

/**
 * Validasi login
 */
export const validateLogin = (body: any): string[] => {
  const errors: string[] = [];

  if (!body.email && !body.phone) {
    errors.push('Email atau nomor HP wajib diisi');
  }

  if (!body.password) {
    errors.push('Password wajib diisi');
  }

  return errors;
};