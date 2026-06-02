import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './lib/i18n'
import './index.css'

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>
)
