import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

export const healthRoutes: Router = Router();

healthRoutes.get('/', (req, res, next) => {
  getHealth(req, res).catch(next);
});
