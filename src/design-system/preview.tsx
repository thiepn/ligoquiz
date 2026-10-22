import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {StudioPopPreview} from './StudioPopPreview';

const mount=document.getElementById('studio-pop-root');
if(!mount)throw new Error('Studio Pop preview mount not found');
createRoot(mount).render(<StrictMode><StudioPopPreview/></StrictMode>);
