import React, { useState, useEffect } from 'react';
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

  const chartColors = {
    primary: '#3b82f6',
    secondary: '#6366f1',
    grid: theme === 'light' ? '#e9ecef' : '#333333',
    text: theme === 'light' ? '#0a0a0a' : '#ffffff',
    background: 'transparent'
  };

  return (
    <section id="plots" className="section">
      <div className="container">
        <h2 className="section-title">Statistics & Analysis</h2>
        
        <div className="plot-content">
          <div className="stats-cards">
            <div className="stat-card card fade-in">
              <h3>Max DPS</h3>
              <p className="stat-value">47.2</p>
              <span className="stat-unit">damage/sec</span>
            </div>
            
            <div className="stat-card card fade-in" style={{ animationDelay: '0.1s' }}>
              <h3>Average DPS</h3>
              <p className="stat-value">38.7</p>
              <span className="stat-unit">damage/sec</span>
            </div>
            
            <div className="stat-card card fade-in" style={{ animationDelay: '0.2s' }}>
              <h3>Accuracy</h3>
              <p className="stat-value">92.4%</p>
              <span className="stat-unit">hit rate</span>
            </div>
            
            <div className="stat-card card fade-in" style={{ animationDelay: '0.3s' }}>
              <h3>Time to Kill</h3>
              <p className="stat-value">18.2s</p>
              <span className="stat-unit">seconds</span>
            </div>
          </div>

          <div className="plot-container card">
            <div className="plot-header">
              <h3>DPS Analysis</h3>
              <div className="chart-controls">
                <button 
                  className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
                  onClick={() => setChartType('line')}
                >
                  Line Chart
                </button>
                <button 
                  className={`chart-type-btn ${chartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setChartType('bar')}
                >
                  Bar Chart
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Calculating DPS...</p>
              </div>
            ) : (
              <div className="chart-wrapper">
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
              </div>
            )}
          </div>

          <div className="plot-controls card">
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
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlotSection;
