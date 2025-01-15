import { defineConfig } from 'vite';
import viteTscPlugin from 'vite-plugin-tsc-transpile';
import dts from 'vite-plugin-dts';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                'src/index.ts'
            ),
            formats: ['es', 'cjs'],
            fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs')
        },
        rollupOptions: {
            external: [
                '@babel/code-frame',
                '@smushytaco/index-to-position',
                'type-fest'
            ]
        },
        sourcemap: true,
        minify: false
    },
    plugins: [
        viteTscPlugin(),
        dts({
            async afterBuild(emittedFiles) {
                for (const [filePath, content] of emittedFiles) {
                    if (filePath.endsWith('.d.ts')) {
                        const dMtsPath = filePath.replace(/\.d\.ts$/, '.d.mts');
                        const dCtsPath = filePath.replace(/\.d\.ts$/, '.d.cts');
                        await fs.writeFile(dMtsPath, content, 'utf-8');
                        await fs.writeFile(dCtsPath, content, 'utf-8');
                        await fs.unlink(filePath);
                    }
                }
            }
        })
    ]
});
