import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import {registerShell} from './resilience/offline';
import './styles/base.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('Missing application mount');
createRoot(mount).render(<StrictMode><App /></StrictMode>);
// The build shell installs only on secure preview/production origins, never in Vite dev.
void registerShell();
