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
import './learning.css';
import './experiment.css';
import './batch-comparison.css';
import './performance-report.css';
import './discovery-lesson.css';
import './workflow-glass.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
