import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // https://vuetifyjs.com/
    // https://www.npmjs.com/package/vite-plugin-vuetify
    vuetify({ autoImport: true }),
  ],
})
