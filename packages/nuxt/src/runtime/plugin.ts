import { defineNuxtPlugin } from "#app"
import { createFourzeServer } from "@fourze/server"
import type { Nuxt } from "@nuxt/schema"

export default defineNuxtPlugin((nuxt: Nuxt) => {
    console.log("Nuxt is ready")
    const fourzeMiddleware = createFourzeServer()
})
