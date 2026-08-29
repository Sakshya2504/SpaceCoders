import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './responsive.css';
import './patientWorkflow.css';
import './ui-polish.css';

// Keep global theme styles first, then layer workflow-specific and small UI
// refinements on top. This makes the cascade predictable when the portal grows.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
