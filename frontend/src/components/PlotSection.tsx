import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut } from '../utils/animations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '../hooks/useTheme';
import './PlotSection.css';

interface PlotDataPoint {
  time: number;
  dps: number;
  accuracy: number;
}

const PlotSection: React.FC = () => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [plotData, setPlotData] = useState<PlotDataPoint[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const titleRef = useRef(null);
  const statsRef = useRef(null);
  const chartRef = useRef(null);
  const controlsRef = useRef(null);

  const titleInView = useInView(titleRef, { once: true, amount: 0.8 });
  const statsInView = useInView(statsRef, { once: true, amount: isMobile ? 0.1 : 0.3 });
  const chartInView = useInView(chartRef, { once: true, amount: isMobile ? 0.1 : 0.2 });
  const controlsInView = useInView(controlsRef, { once: true, amount: 0.5 });

  useEffect(() => {
    // Simulate loading WebAssembly data
    const loadData = async () => {
      setIsLoading(true);

      // Placeholder data - replace with actual WebAssembly call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const sampleData: PlotDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
        time: i,
        dps: Math.random() * 20 + 30 + Math.sin(i * 0.2) * 10,
        accuracy: Math.random() * 10 + 85
      }));

      setPlotData(sampleData);
      setIsLoading(false);
    };

    loadData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartColors = {
    primary: '#3b82f6',
    secondary: '#6366f1',
    grid: theme === 'light' ? '#e9ecef' : '#333333',
    text: theme === 'light' ? '#0a0a0a' : '#ffffff',
    background: 'transparent'
  };

  return (
    <motion.section
      id="plots"
      className="section"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="container">
        <motion.h2
          ref={titleRef}
          className="section-title"
          initial={{ opacity: 0, y: -20 }}
          animate={titleInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          Statistics & Analysis
        </motion.h2>

        <div className="plot-content">
          <motion.div
            ref={statsRef}
            className="stats-cards"
            initial={{ opacity: 0 }}
            animate={statsInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {['Max DPS', 'Average DPS', 'Accuracy', 'Time to Kill'].map((title, index) => (
              <motion.div
                key={title}
                className="stat-card card"
                initial={{ opacity: 0, y: 30 }}
                animate={statsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{
                  duration: 0.5,
                  delay: statsInView ? index * 0.1 : 0,
                  ease: [0.25, 0.1, 0.25, 1]
                }}
                whileHover={{
                  y: -4,
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
              >
                <h3>{title}</h3>
                <motion.p
                  className="stat-value"
                  initial={{ scale: 0 }}
                  animate={statsInView ? { scale: 1 } : { scale: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: statsInView ? 0.3 + index * 0.1 : 0
                  }}
                >
                  {title === 'Accuracy' ? '92.4%' : title === 'Time to Kill' ? '18.2s' : (Math.random() * 20 + 30).toFixed(1)}
                </motion.p>
                <span className="stat-unit">{title === 'Accuracy' ? 'hit rate' : title.includes('Time') ? 'seconds' : 'damage/sec'}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            ref={chartRef}
            className="plot-container card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={chartInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="plot-header">
              <h3>DPS Analysis</h3>
              <div className="chart-controls">
                {['line', 'bar'].map((type) => (
                  <motion.button
                    key={type}
                    className={`chart-type-btn ${chartType === type ? 'active' : ''}`}
                    onClick={() => setChartType(type as 'line' | 'bar')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                  </motion.button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  className="loading-state"
                  {...fadeInOut}
                >
                  <motion.div
                    className="loading-spinner"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                  <p>Calculating DPS...</p>
                </motion.div>
              ) : (
                <motion.div
                  className="chart-wrapper"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <ResponsiveContainer width="100%" height={400}>
                    {chartType === 'line' ? (
                      <LineChart data={plotData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis
                          dataKey="time"
                          stroke={chartColors.text}
                          fontSize={12}
                          label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: chartColors.text } }}
                        />
                        <YAxis
                          stroke={chartColors.text}
                          fontSize={12}
                          label={{ value: 'DPS', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartColors.text } }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                            border: `1px solid ${chartColors.grid}`,
                            borderRadius: '8px',
                            color: chartColors.text
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="dps"
                          stroke={chartColors.primary}
                          strokeWidth={2}
                          dot={{ fill: chartColors.primary, strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5, stroke: chartColors.primary, strokeWidth: 2 }}
                          name="DPS"
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={plotData.slice(0, 20)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis
                          dataKey="time"
                          stroke={chartColors.text}
                          fontSize={12}
                        />
                        <YAxis
                          stroke={chartColors.text}
                          fontSize={12}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                            border: `1px solid ${chartColors.grid}`,
                            borderRadius: '8px',
                            color: chartColors.text
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="dps"
                          fill={chartColors.primary}
                          name="DPS"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            ref={controlsRef}
            className="plot-controls card"
            initial={{ opacity: 0, y: 30 }}
            animate={controlsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3>Analysis Controls</h3>
            <div className="control-group">
              <label>Target Defense:</label>
              <input type="range" min="0" max="200" defaultValue="100" className="slider" />
              <span>100</span>
            </div>
            <div className="control-group">
              <label>Combat Style:</label>
              <select className="control-select">
                <option>Accurate</option>
                <option>Aggressive</option>
                <option>Defensive</option>
                <option>Controlled</option>
              </select>
            </div>
            <button className="btn">Recalculate</button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default PlotSection;
