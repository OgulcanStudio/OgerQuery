import { defineConfig } from 'tsup';

export default defineConfig([
  // 1. Package Build: ESM, CommonJS, and IIFE (unminified CDN)
  {
    entry: {
      OgerQuery: 'src/index.ts',
    },
    format: ['esm', 'cjs', 'iife'],
    globalName: 'OgerQuery',
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    target: 'es2015',
    outExtension({ format }) {
      if (format === 'esm') return { js: '.esm.js' };
      if (format === 'iife') return { js: '.js' };
      return { js: '.cjs' };
    },
  },
  // 2. Minified CDN Build: IIFE format only
  {
    entry: {
      OgerQuery: 'src/index.ts',
    },
    format: ['iife'],
    globalName: 'OgerQuery',
    minify: true,
    sourcemap: true,
    clean: false, // Maintain files from the package build
    splitting: false,
    treeshake: true,
    target: 'es2015',
    outExtension() {
      return { js: '.min.js' };
    },
  },
]);
