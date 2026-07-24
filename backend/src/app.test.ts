import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();

describe('seguridad de la app', () => {
  it('responde al health check sin filtrar el framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('aplica cabeceras de seguridad de helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('devuelve 404 JSON para rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('rechaza orígenes CORS no permitidos', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://atacante.example');
    // El middleware CORS no añade la cabecera de permiso para orígenes no listados.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('permite el origen del frontend en desarrollo', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5174');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
  });
});
