import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient;
try {
  aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.warn("OpenAI initialized without API key or threw error. Ensure OPENAI_API_KEY is embedded in .env before generation.");
}

export async function generateReadme(projectContext) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in the environment variables.');
  }

  // Re-initialize client to ensure picking up late-added keys
  if (!aiClient || aiClient.apiKey !== process.env.OPENAI_API_KEY) {
    aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

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
7. Architecture Diagram (CRITICAL: You MUST include a valid Mermaid.js graph chart \`\`\`mermaid ... \`\`\` showing the core system architecture and module relationships based on the provided codebase)

Please output ONLY the Markdown content for the README. Do not include any introductory or concluding remarks. Make sure the Mermaid block is properly enclosed in \`\`\`mermaid ... \`\`\`.

Project Context:
${projectContext.substring(0, 50000)}
`;

  try {
    // ---- MOCK RESPONSE START ----
    // Bypassing actual API call to avoid 401 errors
    const mockReadme = `
# Readme Genesis Pro (MOCK)

This is a **mocked** README generated without consuming an actual OpenAI API key.

## Features
- Successfully parsed \`\${projectContext.length}\` characters of context.
- Skips the OpenAI API cost.

## Architecture Diagram
\`\`\`mermaid
graph TD;
    A[Client] -->|Uploads ZIP/GitHub| B(Server Express.js);
    B --> C{Utils};
    C -->|Extract Context| D[AI Generator MOCK];
    D -->|Returns simulated MarkDown| B;
\`\`\`
`;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockReadme;
    // ---- MOCK RESPONSE END ----

    /* 
    const response = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
    */
  } catch (error) {
    console.error('Error calling OpenAI model:', error);
    if (error.status === 429) {
       throw new Error('OpenAI API Rate Limit Exceeded (429). Please wait a moment and try again.');
    }
    throw new Error(error.message || 'Failed to generate README from AI model.');
  }
}
