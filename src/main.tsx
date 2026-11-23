import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
// Captura cedo o pedido de instalação do app (Android/Chrome)
import './lib/pwa'

createRoot(document.getElementById("root")!).render(<App />);
