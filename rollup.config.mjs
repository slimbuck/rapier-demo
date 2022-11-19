import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { wasm } from '@rollup/plugin-wasm';
import copyAndWatch from "./copy-and-watch.mjs";

export default {
    input: 'src/index.ts',
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true
    },
    plugins: [
        copyAndWatch({
            targets: [
                { src: 'src/index.html' },
                { src: 'static/' }
            ]
        }),
        wasm(),
        resolve(),
        typescript({
            compilerOptions: {
                target: "es6",
                esModuleInterop : true
            },
            // typescript's sourcemaps aren't compatible, so rely on rollup's
            sourceMap: false
        })
    ]
};
