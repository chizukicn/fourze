# Fourze Vite Plugin

## Usage

`pnpm add @fourze/vite`

vite.config.ts

```ts
import fourze from "@fourze/vite";

export default defineConfig({
  plugins: [
    fourze({
      base: "/api"
    })
  ],
});
```

then you can fetch `/api/hello` to get response.
