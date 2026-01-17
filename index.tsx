import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- ENVIRONMENT CONFIGURATION ---
// We define process.env globally here so the Gemini features work in the browser.
// Note: In a production app, you would typically use a .env file and a build tool (like Vite).
(window as any).process = {
  env: {
    // ⚠️ SECURITY WARNING: You posted this key in a public chat. 
    // Please revoke it in Google AI Studio and generate a new one for production.
    API_KEY: "AIzaSyCEdiDjD0EZ2Ke3hKAWETU5WOWjNWFH-Kw" 
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
