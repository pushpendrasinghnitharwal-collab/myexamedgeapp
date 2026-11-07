import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './lib/store'
import { GoogleAuthProvider } from './lib/googleAuth'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource-variable/noto-sans-devanagari'
import './styles.css'
import './premium.css'
import './refresh.css'
import './catalog.css'
import './studio.css'
import './auth.css'
import './finale.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <GoogleAuthProvider>
        <App />
      </GoogleAuthProvider>
    </StoreProvider>
  </React.StrictMode>
)
