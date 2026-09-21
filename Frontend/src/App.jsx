import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TransNavbar from './Components/TransNavbar';
import Footer from './Components/Footer';
import ErrorBoundary from './Components/ErrorBoundary';
import Home from './Pages/Home';
import PlanJourney from './Pages/PlanJourney';
import Commutes from './Pages/Commutes';
import About from './Pages/About';
import NotFound from './Pages/NotFound';
import { useServerWake } from './hooks/useServerWake';
import './App.css';

export default function App() {
  const location = useLocation();
  const waking = useServerWake();

  return (
    <div className="app-wrapper d-flex flex-column min-vh-100">
      <TransNavbar/>
      {/* Plain for now — a later stage restyles this. */}
      {waking && (
        <div className="text-center bg-warning text-dark py-2">
          Waking the server up — this can take about a minute…
        </div>
      )}
      {/* Keyed by pathname so a route that previously errored recovers on navigation. */}
      <ErrorBoundary key={location.pathname}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"           element={<Home />} />
            {/* Keyed by location.search so navigating to /plan with new params
                while already on /plan remounts the page — see PlanJourney.jsx. */}
            <Route path="/plan"       element={<PlanJourney key={location.search} />} />
            <Route path="/commutes"   element={<Commutes />} />
            <Route path="/about"      element={<About />} />
            <Route path="*"           element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </ErrorBoundary>

      <Footer />
    </div>
  );
}