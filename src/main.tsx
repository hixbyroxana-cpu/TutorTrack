import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ensureFirebaseAuth } from './db/firebase';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const renderApp = () => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

renderApp();

ensureFirebaseAuth().catch((error) => {
  console.error('Firebase anonymous auth failed. Firestore may reject requests.', error);
});
