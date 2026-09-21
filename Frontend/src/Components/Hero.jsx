import { motion } from 'framer-motion';
import '../css/Hero.css';

export default function Hero({ children, subtitle, eyebrow = 'Live Transit Updates', chips = [] }) {
  return (
    <motion.div
      className="hero-section"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="hero-eyebrow">{eyebrow}</div>

      <h1 className="hero-title">{children}</h1>

      <p className="hero-subtitle">{subtitle}</p>

      {chips.length > 0 && (
        <div className="hero-chips">
          {chips.map((chip, i) => (
            <span key={i} className="stat-chip">{chip}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
