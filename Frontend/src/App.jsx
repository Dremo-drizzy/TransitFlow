import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TransNavbar from './Components/TransNavbar';
import Footer from './Components/Footer';
import Home from './Pages/Home';
import PlanJourney from './Pages/PlanJourney';
import Commutes from './Pages/Commutes';
import './App.css';

export default function App() {
  const location = useLocation();

  return (
    <div className="app-wrapper d-flex flex-column min-vh-100">
      <TransNavbar/>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"        element={<Home />} />
          <Route path="/plan"    element={<PlanJourney />} />
          <Route path="/commutes" element={<Commutes />} />
        </Routes>
      </AnimatePresence>

      <Footer />
    </div>
  );
}