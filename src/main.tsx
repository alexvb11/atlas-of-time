import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/applySettings'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// installable and usable offline (production builds only; development stays uncached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // hand over what this first visit already loaded, so it works offline too
        const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((e) => e.name)]
        reg.active?.postMessage({ type: 'cache', urls })
      })
      .catch(() => {})
  })
}
