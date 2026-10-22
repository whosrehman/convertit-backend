require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const convertRoutes = require('./routes/convert');
const { cleanupOldFiles } = require('./middleware/cleanup');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure directories exist
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const convertedDir = path.join(__dirname, process.env.CONVERTED_DIR || 'converted');
[uploadDir, convertedDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Routes
app.use('/api/convert', convertRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve converted files for download
app.use('/api/download', express.static(convertedDir, {
  setHeaders: (res, filePath) => {
    res.set('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  }
}));

// Cleanup old files every 10 minutes
const cleanupMinutes = parseInt(process.env.FILE_CLEANUP_MINUTES) || 60;
setInterval(() => {
  cleanupOldFiles(uploadDir, cleanupMinutes);
  cleanupOldFiles(convertedDir, cleanupMinutes);
}, 10 * 60 * 1000);

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`\n  🔄 ConvertIt API running at http://localhost:${PORT}`);
  console.log(`  📁 Uploads: ${uploadDir}`);
  console.log(`  📦 Converted: ${convertedDir}\n`);
});
