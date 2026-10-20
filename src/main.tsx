import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppProviders from './app/providers.tsx';
import { registerNotificationWorker } from './lib/messageNotifications';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerNotificationWorker();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
