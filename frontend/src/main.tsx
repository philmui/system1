import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@xyflow/react/dist/style.css';
import './theme.css';
import './styles.css';
import './workflow.css';
import './comparison.css';
import './replay.css';
import './classification.css';
import './flow-motion.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
