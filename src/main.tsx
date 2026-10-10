import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import {registerShell} from './resilience/offline';
import './styles/base.css';
// Keep G15 projector contrast/geometry rules after the legacy base and game CSS.
import './styles/g15-projection.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('Missing application mount');
createRoot(mount).render(<StrictMode><App /></StrictMode>);
// The build shell installs only on secure preview/production origins, never in Vite dev.
void registerShell();
