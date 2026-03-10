import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { generateReadme } from './ai.js';
import { extractZipAndBuildContext, fetchGithubAndBuildContext } from './utils.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.send('README Genesis Pro API is running.');
});

app.post('/api/generate/zip', upload.single('projectZip'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No zip file provided' });
    }

    const fileContext = await extractZipAndBuildContext(req.file.buffer);
    const readmeContent = await generateReadme(fileContext);
    
    res.json({ readme: readmeContent });
  } catch (error) {
    console.error('ZIP processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process zip and generate README' });
  }
});

app.post('/api/generate/github', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ error: 'No GitHub repository URL provided' });
    }

    const fileContext = await fetchGithubAndBuildContext(repoUrl);
    const readmeContent = await generateReadme(fileContext);
    
    res.json({ readme: readmeContent });
  } catch (error) {
    console.error('GitHub processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process GitHub URL and generate README' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
