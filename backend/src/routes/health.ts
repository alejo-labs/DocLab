import { Router } from 'express';
import { isAiConfigured } from '../services/gemini.js';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'DocLab API', ai: isAiConfigured() });
});
