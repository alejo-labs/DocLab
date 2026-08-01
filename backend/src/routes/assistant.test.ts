import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

// Estos tests corren sin GEMINI_API_KEY configurada (entorno de test).
describe('POST /api/assistant/search (sin IA configurada)', () => {
  it('responde 503 con fallback cuando la IA no está configurada', async () => {
    const res = await request(app)
      .post('/api/assistant/search')
      .send({ query: 'unir', tools: [{ id: 'unir-pdf', name: 'Unir PDF', description: 'Une PDFs' }] });
    expect(res.status).toBe(503);
    expect(res.body.fallback).toBe(true);
  });
});
