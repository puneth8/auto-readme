import AdmZip from 'adm-zip';
import axios from 'axios';

// Limit file parsing to avoid massive context
const MAX_FILES = 20;
const MAX_FILE_SIZE = 50 * 1024; // 50 KB

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf', '.zip', '.tar', '.gz'];
const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', '.next', 'out'];

function isTextFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return !IGNORED_EXTENSIONS.includes(`.${ext}`);
}

function shouldProcessPath(filePath) {
  const parts = filePath.split('/');
  return !parts.some(part => IGNORED_DIRECTORIES.includes(part));
}

export async function extractZipAndBuildContext(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  
  let tree = "Folder Structure:\n";
  let context = "";
  let fileCount = 0;

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    
    const entryName = entry.entryName;
    if (!shouldProcessPath(entryName)) continue;
    
    // AdmZip handles paths with forward slashes usually
    tree += `- ${entryName}\n`;
    
    if (isTextFile(entryName) && entry.header.size < MAX_FILE_SIZE && fileCount < MAX_FILES) {
      const content = zip.readAsText(entry);
      context += `\n--- File: ${entryName} ---\n${content}\n`;
      fileCount++;
    }
  }

  return `${tree}\n\nCode Snippets:\n${context}`;
}

export async function fetchGithubAndBuildContext(repoUrl) {
  // Rough parsing of github url: https://github.com/owner/repo
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error("Invalid GitHub URL format.");
  }
  
  const owner = match[1];
  const repo = match[2].replace('.git', '');
  
  // Use GitHub API to fetch tree. Warning: Rate limited for unauthenticated requests.
  try {
    // 1. Get default branch
    const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
    const defaultBranch = repoInfo.data.default_branch;
    
    // 2. Get tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeData = await axios.get(treeUrl);
    
    let treeStr = "Folder Structure:\n";
    let context = "";
    let fileCount = 0;
    
    for (const item of treeData.data.tree) {
      if (item.type !== 'blob') continue;
      if (!shouldProcessPath(item.path)) continue;
      
      treeStr += `- ${item.path}\n`;
      
      if (isTextFile(item.path) && fileCount < MAX_FILES) {
        // Fetch raw content
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`;
        try {
          const fileContent = await axios.get(rawUrl);
          const dataStr = typeof fileContent.data === 'string' ? fileContent.data : JSON.stringify(fileContent.data, null, 2);
          if (dataStr.length < MAX_FILE_SIZE) {
            context += `\n--- File: ${item.path} ---\n${dataStr}\n`;
            fileCount++;
          }
        } catch(e) {
          // ignore error fetching single file
        }
      }
    }
    
    return `${treeStr}\n\nCode Snippets:\n${context}`;
    
  } catch (error) {
    console.error("GitHub Fetch Error", error.response?.data || error.message);
    throw new Error("Failed to fetch GitHub repository context.");
  }
}
