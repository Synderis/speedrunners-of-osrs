import React, { useEffect, useRef } from 'react';
import './FloatingBackground.css';

const FloatingBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createFloatingElement = () => {
      const element = document.createElement('div');
      element.className = 'floating-element';
      
      // Random properties
      const size = Math.random() * 100 + 50;
      const x = Math.random() * window.innerWidth;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 5;
      
      element.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        bottom: -${size}px;
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
      `;
      
      container.appendChild(element);
      
      // Remove element after animation
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, (duration + delay) * 1000);
    };

    // Create initial elements
    for (let i = 0; i < 5; i++) {
      setTimeout(createFloatingElement, i * 2000);
    }

    // Create new elements periodically
    const interval = setInterval(createFloatingElement, 4000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <div ref={containerRef} className="floating-background" />;
};

export default FloatingBackground;
