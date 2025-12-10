import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/Authorforge/',
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        '@google/generative-ai',
        'uuid',
        'recharts',
        'mammoth',
        'react-markdown',
        'js-tiktoken',
        '@mlc-ai/web-llm'
      ],
      output: {
        paths: {
          'react': 'https://esm.sh/react@18.3.1',
          'react-dom': 'https://esm.sh/react-dom@18.3.1',
          'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client',
          'lucide-react': 'https://esm.sh/lucide-react@0.372.0',
          '@google/generative-ai': 'https://esm.sh/@google/genai@0.12.0',
          'uuid': 'https://esm.sh/uuid@9.0.1',
          'recharts': 'https://esm.sh/recharts@2.12.5?bundle',
          'mammoth': 'https://esm.sh/mammoth@1.6.0',
          'react-markdown': 'https://esm.sh/react-markdown@9.0.1?bundle',
          'js-tiktoken': 'https://esm.sh/js-tiktoken@1.0.12',
          '@mlc-ai/web-llm': 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.42/dist/web-llm.mjs'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  }
})
