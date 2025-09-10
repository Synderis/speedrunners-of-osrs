import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

interface ResultPlotProps {
    chartRef: React.RefObject<HTMLDivElement>;
    chartInView: boolean;
    isLoading: boolean;
    handleRecalculate: () => void;
    showSeconds: boolean;
    setShowSeconds: React.Dispatch<React.SetStateAction<boolean>>;
    chartType: 'line' | 'bar';
    setChartType: React.Dispatch<React.SetStateAction<'line' | 'bar'>>;
    plotDataToShow: any[];
    chartColors: any;
    theme: string;
    formatSeconds: (seconds: number) => string;
    fadeInOut: any;
}

const ResultPlot: React.FC<ResultPlotProps> = ({
    chartRef,
    chartInView,
    isLoading,
    handleRecalculate,
    showSeconds,
    setShowSeconds,
    chartType,
    setChartType,
    plotDataToShow,
    chartColors,
    theme,
    formatSeconds,
    fadeInOut,
}) => (
    <motion.div
        ref={chartRef}
        className="plot-container card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={chartInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
    >
        {/* Chart type and unit toggle buttons above the chart */}
        <div className="chart-controls">
            <motion.button
                className="btn"
                onClick={handleRecalculate}
                disabled={isLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isLoading ? 'Calculating...' : 'Calculate'}
            </motion.button>
            <motion.button
                className="btn"
                onClick={() => setShowSeconds(s => !s)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ marginLeft: 8 }}
            >
                Show in {showSeconds ? 'Ticks' : 'Seconds'}
            </motion.button>
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
            ) : plotDataToShow.length > 0 ? (
                <motion.div
                    className="chart-wrapper"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                >
                    <ResponsiveContainer width="100%" height={400}>
                        {chartType === 'line' ? (
                            <LineChart data={plotDataToShow} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis
                                    dataKey="time"
                                    stroke={chartColors.text}
                                    fontSize={12}
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    tickCount={plotDataToShow.length}
                                    label={{
                                        value: showSeconds ? 'Time (min:sec)' : 'Tick',
                                        position: 'insideBottom',
                                        offset: -10,
                                        style: { textAnchor: 'middle', fill: chartColors.text }
                                    }}
                                    tickFormatter={showSeconds ? formatSeconds : undefined}
                                />
                                <YAxis
                                    stroke={chartColors.text}
                                    fontSize={12}
                                    label={{ value: 'P(Dead)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: chartColors.text } }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                                        border: `1px solid ${chartColors.grid}`,
                                        borderRadius: '8px',
                                        color: chartColors.text
                                    }}
                                    formatter={(value, name) => [
                                        value,
                                        name === "P(Dead)" ? "P(Dead)" : name
                                    ]}
                                    labelFormatter={label =>
                                        showSeconds ? formatSeconds(label as number) : `Tick ${label}`
                                    }
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="dps"
                                    stroke={chartColors.primary}
                                    strokeWidth={2}
                                    dot={{ fill: chartColors.primary, strokeWidth: 2, r: 3 }}
                                    activeDot={{ r: 5, stroke: chartColors.primary, strokeWidth: 2 }}
                                    name="P(Dead)"
                                />
                            </LineChart>
                        ) : (
                            <BarChart data={plotDataToShow} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis
                                    dataKey="time"
                                    stroke={chartColors.text}
                                    fontSize={12}
                                    label={{ value: showSeconds ? 'Seconds' : 'Tick', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: chartColors.text } }}
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
            ) : (
                <motion.div
                    className="no-data-state"
                    {...fadeInOut}
                >
                    <p>Click "Recalculate" to generate DPS analysis</p>
                </motion.div>
            )}
        </AnimatePresence>
    </motion.div>
);

export default ResultPlot;