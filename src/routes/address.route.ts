// src/routes/address.route.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/address.controller';

export const addressRouter = Router();

addressRouter.use(authMiddleware);
addressRouter.get('/', getAddresses);
addressRouter.post('/', createAddress);
addressRouter.put('/:id', updateAddress);
addressRouter.delete('/:id', deleteAddress);