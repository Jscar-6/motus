// App shell: routes with an animated, one-at-a-time page transition (each page owns its enter and exit).
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Results from './pages/Results';
import Session from './pages/Session';
import Setup from './pages/Setup';

const Doctor = lazy(() => import('./pages/Doctor'));
const Physician = lazy(() => import('./pages/Physician'));
const PatientOverview = lazy(() => import('./pages/PatientOverview'));

/** Routes keyed by pathname so AnimatePresence waits for the old page to leave. */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/session" element={<Session />} />
        <Route
          path="/doctor"
          element={
            <Suspense fallback={null}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                <Doctor />
              </motion.div>
            </Suspense>
          }
        />
        <Route path="/physician" element={<Suspense fallback={null}><Physician /></Suspense>} />
        <Route path="/physician/:patientId" element={<Suspense fallback={null}><PatientOverview /></Suspense>} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/results" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

/** Root component. */
export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
