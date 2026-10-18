// Dev-only page (http://localhost:5173/pose-debug.html) to check the vision model (C1–C5) without the app shell.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import VisionCheck from './VisionCheck';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <VisionCheck />
    </main>
  </StrictMode>,
);
