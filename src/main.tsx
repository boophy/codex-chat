import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {CcProvider} from './lib/ctx.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CcProvider>
      <App />
    </CcProvider>
  </StrictMode>,
);
