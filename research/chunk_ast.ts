import { parse } from '@babel/parser';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import * as recast from 'recast';
import { getEncoding } from 'tiktoken';

const encoder = getEncoding('cl100k_base');
const MAX_TOKENS_PER_CHUNK = 500;
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

/**
 * Parse a single file into AST
 */
async function parseFile(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const ast = recast.parse(content, {
    parser: {
      parse: (source: string) =>
        parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }),
    },
  });
  return { ast, content };
}

/**
 * Extract code chunks (functions, classes) from AST
 */
function extractChunksFromAST(ast: any, content: string, filePath: string) {
  const chunks: { code: string; file: string; line: number }[] = [];

  recast.types.visit(ast, {
    visitFunctionDeclaration(path) {
      const node = path.node;
      const startLine = node.loc?.start.line ?? 0;
      const code = recast.print(node).code;
      chunks.push({ code, file: filePath, line: startLine });
      this.traverse(path);
    },
    visitClassDeclaration(path) {
      const node = path.node;
      const startLine = node.loc?.start.line ?? 0;
      const code = recast.print(node).code;
      chunks.push({ code, file: filePath, line: startLine });
      this.traverse(path);
    },
  });

  return chunks;
}

/**
 * Dynamically batch small chunks into bigger ones (based on token count)
 */
function batchChunks(chunks: { code: string; file: string; line: number }[]) {
  const batched: { code: string; sources: { file: string; line: number }[] }[] =
    [];
  let currentBatch = '';
  let currentSources: { file: string; line: number }[] = [];
  let currentTokens = 0;

  for (const chunk of chunks) {
    const tokenCount = encoder.encode(chunk.code).length;

    if (currentTokens + tokenCount > MAX_TOKENS_PER_CHUNK) {
      if (currentBatch) {
        batched.push({
          code: currentBatch.trim(),
          sources: [...currentSources],
        });
      }
      currentBatch = '';
      currentSources = [];
      currentTokens = 0;
    }

    currentBatch += chunk.code + '\n\n';
    currentSources.push({ file: chunk.file, line: chunk.line });
    currentTokens += tokenCount;
  }

  if (currentBatch) {
    batched.push({ code: currentBatch.trim(), sources: [...currentSources] });
  }

  return batched;
}

/**
 * Walk directory and collect all code chunks
 */
async function collectCodeChunks(rootDir: string) {
  const files = await fg(['**/*.{js,ts,jsx,tsx}'], {
    cwd: rootDir,
    absolute: true,
  });
  let allChunks: { code: string; file: string; line: number }[] = [];

  for (const filePath of files) {
    const { ast, content } = await parseFile(filePath);
    const chunks = extractChunksFromAST(
      ast,
      content,
      path.relative(rootDir, filePath)
    );
    allChunks = allChunks.concat(chunks);
  }

  const batchedChunks = batchChunks(allChunks);

  return batchedChunks;
}

/**
 * Example usage
 */
async function main() {
  const rootDir = './your-project-root'; // change this
  const chunks = await collectCodeChunks(rootDir);

  console.log('Total final chunks:', chunks.length);
  console.log('First chunk sample:', JSON.stringify(chunks[0], null, 2));
}

main().catch(console.error);
