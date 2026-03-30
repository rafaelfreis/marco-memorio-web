import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Lambda root is the function bundle root; included_files adds ./build/server/** there.
 * Dynamic import keeps the Vite ESM server bundle out of esbuild CJS merging (top-level await).
 */
const serverEntry = join(process.cwd(), 'build/server/index.js');

export const handler = async (event, context) => {
  const { default: fn } = await import(pathToFileURL(serverEntry).href);
  return fn(event, context);
};
