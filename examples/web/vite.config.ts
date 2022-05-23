import { defineConfig } from "vite"
import fourze from "@fourze/vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
    plugins: [
        react(),
        fourze({
            dir: path.resolve(__dirname, "mock"),
            base: "/api",
            filePattern: [".ts$", ".js$"],
            renders: [
                {
                    path: "//stat",
                    dir: path.resolve(__dirname, "static")
                }
            ],
            mock: true,
            hmr: true,
            logLevel: "info"
        })
    ]
})
