const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const libre = require('libreoffice-convert');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { Document, Packer, Paragraph } = require('docx');
const { uploadWord, uploadPdf } = require('../middleware/upload');

const libreConvert = promisify(libre.convert);

const convertedDir = path.join(__dirname, '..', process.env.CONVERTED_DIR || 'converted');

async function convertPdfToWord(inputBuffer) {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(inputBuffer) });
  const pdf = await loadingTask.promise;

  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      pages.push(items
        .map(item => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .trim());
    }

    if (!pages.some(text => text.length > 0)) {
      const error = new Error('This PDF contains no extractable text. Scanned or image-only PDFs are not supported.');
      error.status = 422;
      throw error;
    }

    const children = pages.flatMap((text, pageIndex) => {
      const lines = text.split('\n');
      return lines.map((line, lineIndex) => new Paragraph({
        text: line || ' ',
        pageBreakBefore: pageIndex > 0 && lineIndex === 0,
      }));
    });
    const document = new Document({ sections: [{ children }] });

    return Packer.toBuffer(document);
  } finally {
    await pdf.destroy();
  }
}

// ─── Word to PDF ───────────────────────────────────────────
router.post('/word-to-pdf', uploadWord.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a .doc or .docx file.' });
  }

  const inputPath = req.file.path;
  const originalName = path.parse(req.file.originalname).name;
  const outputName = `${originalName}_${uuidv4().slice(0, 8)}.pdf`;
  const outputPath = path.join(convertedDir, outputName);

  try {
    const inputBuffer = fs.readFileSync(inputPath);
    const outputBuffer = await libreConvert(inputBuffer, '.pdf', undefined);

    fs.writeFileSync(outputPath, outputBuffer);

    // Clean up uploaded file
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      message: 'Conversion successful',
      file: {
        name: outputName,
        originalName: `${originalName}.pdf`,
        size: outputBuffer.length,
        downloadUrl: `/api/download/${outputName}`,
      },
    });
  } catch (err) {
    // Clean up on error
    try { fs.unlinkSync(inputPath); } catch {}

    console.error('Word to PDF error:', err.message);

    if (err.message.includes('LibreOffice') || err.message.includes('soffice')) {
      return res.status(500).json({
        error: 'LibreOffice is not installed on the server. Please install it to enable conversions.',
        details: 'Run: sudo apt-get install libreoffice-core libreoffice-writer',
      });
    }

    res.status(500).json({ error: 'Conversion failed. Please try again.' });
  }
});

// ─── PDF to Word ───────────────────────────────────────────
router.post('/pdf-to-word', uploadPdf.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a .pdf file.' });
  }

  const inputPath = req.file.path;
  const originalName = path.parse(req.file.originalname).name;
  const outputName = `${originalName}_${uuidv4().slice(0, 8)}.docx`;
  const outputPath = path.join(convertedDir, outputName);

  try {
    const inputBuffer = fs.readFileSync(inputPath);
    const outputBuffer = await convertPdfToWord(inputBuffer);

    fs.writeFileSync(outputPath, outputBuffer);

    // Clean up uploaded file
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      message: 'Conversion successful',
      file: {
        name: outputName,
        originalName: `${originalName}.docx`,
        size: outputBuffer.length,
        downloadUrl: `/api/download/${outputName}`,
      },
    });
  } catch (err) {
    // Clean up on error
    try { fs.unlinkSync(inputPath); } catch {}

    console.error('PDF to Word error:', err.message);

    if (err.status === 422) {
      return res.status(422).json({ error: err.message });
    }

    res.status(500).json({ error: 'Conversion failed. Please try again.' });
  }
});

// ─── Multer error handling ────────────────────────────────
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
