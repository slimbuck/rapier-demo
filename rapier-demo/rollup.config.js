import resolve from "@rollup/plugin-node-resolve";
import { wasm } from '@rollup/plugin-wasm';
import copyAndWatch from "./copy-and-watch";

export default {
    input: 'src/index.js',
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true
    },
    plugins: [
        copyAndWatch({
            targets: [
                { src: 'src/index.html' },
                { src: 'src/styles.css' }
            ]
        }),
        wasm(),
        resolve()
    ]
};
