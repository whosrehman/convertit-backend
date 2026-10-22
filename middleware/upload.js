const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Word to PDF: accept .doc, .docx
const wordFilter = (req, file, cb) => {
  const allowed = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(file.mimetype) || ['.doc', '.docx'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .doc and .docx files are allowed'), false);
  }
};

// PDF to Word: accept .pdf
const pdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'application/pdf' || ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only .pdf files are allowed'), false);
  }
};

const uploadWord = multer({ storage, fileFilter: wordFilter, limits: { fileSize: maxSize } });
const uploadPdf = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: maxSize } });

module.exports = { uploadWord, uploadPdf };
