import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './responsive.css';
import './patientWorkflow.css';
import './ui-polish.css';
import './portal-refinements.css';

// Keep the stylesheet order deliberate: the base theme comes first, then the
// page/workflow layers, and finally the small visual refinements used to polish
// spacing and responsive behavior without changing application logic.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
