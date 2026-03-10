#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import ora from 'ora';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const program = new Command();
program
  .name('readme-genesis')
  .description('AI-powered documentation generator')
  .version('1.0.0')
  .option('-k, --key <key>', 'OpenAI API Key (or set OPENAI_API_KEY env var)')
  .option('-o, --out <file>', 'Output file', 'README.md')
  .action(async (options) => {
    const apiKey = options.key || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Error: OPENAI_API_KEY is not set. Please provide it via the --key option or set it as an environment variable.');
      process.exit(1);
    }

    const spinner = ora('Scanning project structure...').start();
    
    // Limits
    const MAX_FILES = 20;
    const MAX_FILE_SIZE = 50 * 1024;
    const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', '.next', 'out'];
    const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf', '.zip', '.tar', '.gz'];

    let treeStr = "Folder Structure:\n";
    let context = "";
    let fileCount = 0;

    function scanDirectory(dirPath, currentDepth = 0) {
      if (currentDepth > 5) return;
      
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const file of files) {
        if (IGNORED_DIRECTORIES.includes(file.name)) continue;
        
        const fullPath = path.join(dirPath, file.name);
        const relPath = path.relative(process.cwd(), fullPath);

        if (file.isDirectory()) {
          treeStr += `- ${relPath}/\n`;
          scanDirectory(fullPath, currentDepth + 1);
        } else {
          treeStr += `- ${relPath}\n`;
          
          const ext = path.extname(file.name).toLowerCase();
          if (!IGNORED_EXTENSIONS.includes(ext) && fileCount < MAX_FILES) {
            try {
              const stats = fs.statSync(fullPath);
              if (stats.size < MAX_FILE_SIZE) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                context += `\n--- File: ${relPath} ---\n${content}\n`;
                fileCount++;
              }
            } catch (err) {
              // Ignore read errors
            }
          }
        }
      }
    }

    try {
      scanDirectory(process.cwd());
      
      spinner.text = 'Analyzing with AI and generating README...';
      const aiClient = new OpenAI({ apiKey });
      const prompt = `
You are an expert developer and technical writer creating a professional README.md for a project.
Based on the provided codebase structure and file contents, generate a comprehensive, well-structured README.md file.

Include the following sections if applicable:
1. Title and Description
2. Features
3. Tech Stack
4. Installation Instructions
5. Usage Instructions
6. Project Structure
7. Architecture (if discernible)

Please output ONLY the Markdown content for the README. Do not include any introductory or concluding remarks.

Project Context:
${treeStr}\n\nCode Snippets:\n${context.substring(0, 150000)}
`;

// ---- MOCK RESPONSE START ----
      spinner.text = 'Using MOCK AI for README generation...';
      const mockReadme = `
# Readme Genesis Pro CLI (MOCK)

This is a **mocked** README generated via the CLI without consuming an actual OpenAI API key.

## Context Extracted:
- Context Length: ${context.length} characters
- Included Files: ${fileCount}

## Sample Architecture
\`\`\`mermaid
graph TD;
    A[User Codebase] --> B(CLI Parser);
    B --> C{AI Generator MOCK};
    C -->|Simulated MarkDown| D[README.md];
\`\`\`
`;
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      let readmeContent = mockReadme;
      // ---- MOCK RESPONSE END ----

      /* 
      const response = await aiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      });

      let readmeContent = response.choices[0].message.content;
      */
      
      // Clean up markdown wrapper if present
      if (readmeContent.startsWith('\`\`\`markdown')) {
        readmeContent = readmeContent.replace(/^\`\`\`markdown\n/, '').replace(/\n\`\`\`$/, '');
      }

      fs.writeFileSync(path.join(process.cwd(), options.out), readmeContent);
      spinner.succeed(`Successfully generated ${options.out}!`);

    } catch (error) {
      spinner.fail('Failed to generate README.');
      console.error(error.message || error);
    }
  });

program.parse(process.argv);
