import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {CcProvider} from './lib/ctx.tsx';
import './index.css';
import Layout from './Layout.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CcProvider>
      <Layout />
    </CcProvider>
  </StrictMode>,
);
