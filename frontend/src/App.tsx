import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from './components/Header';
import GearSelection from './components/GearSelection';
import RoomSelection from './components/RoomSelection';
import PlotSection from './components/PlotSection';
import FloatingBackground from './components/FloatingBackground';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

function App() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    // Prevent browser from restoring scroll position
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Force scroll to top immediately and repeatedly
    const forceScrollToTop = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    forceScrollToTop();
    
    // Use requestAnimationFrame for better timing
    const rafId = requestAnimationFrame(forceScrollToTop);
    
    // Also use timeouts as backup
    const timeouts = [10, 50, 100, 200, 500].map(delay => 
      setTimeout(forceScrollToTop, delay)
    );

    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    
    // Add room selection to the fade-in system
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.room-selection');
      elements.forEach(el => {
        el.classList.add('fade-in');
      });
    }, 300);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
      timeouts.forEach(timeout => clearTimeout(timeout));
      clearTimeout(timer);
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="app">
        <motion.div 
          className="scroll-progress" 
          style={{ width: `${scrollProgress}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${scrollProgress}%` }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        />
        <FloatingBackground />
        <Header />
        <motion.main 
          className="main-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GearSelection />
          <RoomSelection />
          <PlotSection />
        </motion.main>
      </div>
    </ThemeProvider>
  );
}

export default App;
