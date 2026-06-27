import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:8081';

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de multer para subida de archivos temporales
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Rutas
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor API de PDF funcionando correctamente' });
});

// Ruta de prueba para comprobar la conexión con Gotenberg
app.get('/api/gotenberg-health', async (req, res) => {
  try {
    const response = await axios.get(`${GOTENBERG_URL}/health`);
    res.json({
      status: 'connected',
      gotenbergUrl: GOTENBERG_URL,
      details: response.data
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      gotenbergUrl: GOTENBERG_URL,
      error: error.message,
      help: 'Asegúrate de que Docker Desktop esté encendido y el contenedor de Gotenberg esté corriendo.'
    });
  }
});

// Endpoint ejemplo de conversión de Office a PDF usando Gotenberg
app.post('/api/convert/office', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
  }

  const filePath = req.file.path;

  try {
    // Gotenberg requiere enviar el archivo a su endpoint /forms/libreoffice/convert
    const form = new FormData();
    form.append('files', fs.createReadStream(filePath), req.file.originalname);

    const gotenbergResponse = await axios.post(
      `${GOTENBERG_URL}/forms/libreoffice/convert`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        responseType: 'stream'
      }
    );

    // Configuramos la cabecera para devolver el archivo PDF resultante
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.parse(req.file.originalname).name}.pdf"`);
    
    // Pipear el stream de Gotenberg directamente al cliente
    gotenbergResponse.data.pipe(res);

    // Borrar el archivo temporal después de procesarlo
    gotenbergResponse.data.on('end', () => {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al borrar el archivo temporal:', err);
      });
    });

  } catch (error) {
    console.error('Error de conversión en Gotenberg:', error.message);
    
    // Intentar borrar el archivo temporal si existe
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      error: 'Error al convertir el documento a PDF',
      details: error.message
    });
  }
});

// Inicialización
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
  console.log(`👉 Conexión con Gotenberg configurada en ${GOTENBERG_URL}`);
});
