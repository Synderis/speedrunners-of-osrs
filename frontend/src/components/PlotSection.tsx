import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut } from '../utils/animations';
import { calculateDPSWithObjects } from '../utils/wasmLoader';
import type { PlotDataPoint } from '../utils/wasmLoader';
import type { Monster } from '../data/monsterStats';
import { fetchWeaponStatsFromS3, getWeaponStatsByItemId, type WeaponStat } from '../services/weaponStatsService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '../hooks/useTheme';
import type { GearSets, CombatStats } from '../types/gear';
import './PlotSection.css';

interface PlotSectionProps {
  gearSets?: GearSets;
  combatStats?: CombatStats;
  selectedMonsters?: Monster[];
  activeGearTab?: 'melee' | 'mage' | 'ranged';
}

const PlotSection: React.FC<PlotSectionProps> = ({ 
  gearSets = {
    melee: [],
    mage: [],
    ranged: []
  },
  combatStats = {
    attack: 99,
    strength: 99,
    defense: 99,
    ranged: 99,
    magic: 99,
    hitpoints: 99,
    prayer: 99,
    woodcutting: 99,
    mining: 99,
    thieving: 99
  },
  selectedMonsters = [],
  activeGearTab = 'melee'
}) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [plotData, setPlotData] = useState<PlotDataPoint[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [stats, setStats] = useState({
    maxDPS: 0,
    avgDPS: 0,
    accuracy: 0,
    timeToKill: 0
  });
  const [weaponStatsCache, setWeaponStatsCache] = useState<WeaponStat[]>([]);
  const [currentGearStats, setCurrentGearStats] = useState({
    attack_stab: 0,
    attack_slash: 0,
    attack_crush: 0,
    attack_magic: 0,
    attack_ranged: 0,
    defence_stab: 0,
    defence_slash: 0,
    defence_crush: 0,
    defence_magic: 0,
    defence_ranged: 0,
    melee_strength: 0,
    ranged_strength: 0,
    magic_damage: 0,
    prayer: 0
  });

  const titleRef = useRef(null);
  const statsRef = useRef(null);
  const chartRef = useRef(null);
  const controlsRef = useRef(null);

  const titleInView = useInView(titleRef, { once: true, amount: 0.8 });
  const statsInView = useInView(statsRef, { once: true, amount: isMobile ? 0.1 : 0.3 });
  const chartInView = useInView(chartRef, { once: true, amount: isMobile ? 0.1 : 0.2 });
  const controlsInView = useInView(controlsRef, { once: true, amount: 0.5 });

  // Load weapon stats on component mount
  useEffect(() => {
    const loadWeaponStats = async () => {
      console.log('🎯 PlotSection: Starting weapon stats load...');
      try {
        const weaponStats = await fetchWeaponStatsFromS3();
        setWeaponStatsCache(weaponStats);
        console.log('✅ PlotSection: Loaded weapon stats cache:', weaponStats.length, 'entries');
        
        // Log some sample entries for debugging
        if (weaponStats.length > 0) {
          console.log('🔍 Sample weapon stats entries:', weaponStats.slice(0, 5));
          console.log('🔍 Unique item_ids (first 20):', 
            [...new Set(weaponStats.map(ws => ws.item_id))].slice(0, 20)
          );
        }
      } catch (error) {
        console.error('❌ PlotSection: Failed to load weapon stats:', error);
        setWeaponStatsCache([]);
      }
    };

    loadWeaponStats();
  }, []);

  // Update current gear stats when gear or weapon stats change
  useEffect(() => {
    const updateGearStats = async () => {
      const stats = await calculateTotalGearStats();
      setCurrentGearStats(stats);
    };

    if (weaponStatsCache.length > 0 || gearSets[activeGearTab].length > 0) {
      updateGearStats();
    }
  }, [gearSets, activeGearTab, weaponStatsCache]);

  // Calculate total gear stats for current gear set
  const calculateTotalGearStats = async () => {
    // Safety check
    if (!gearSets || !gearSets[activeGearTab]) {
      return {
        attack_stab: 0,
        attack_slash: 0,
        attack_crush: 0,
        attack_magic: 0,
        attack_ranged: 0,
        defence_stab: 0,
        defence_slash: 0,
        defence_crush: 0,
        defence_magic: 0,
        defence_ranged: 0,
        melee_strength: 0,
        ranged_strength: 0,
        magic_damage: 0,
        prayer: 0
      };
    }

    const currentGearSet = gearSets[activeGearTab];
    const totalStats = {
      attack_stab: 0,
      attack_slash: 0,
      attack_crush: 0,
      attack_magic: 0,
      attack_ranged: 0,
      defence_stab: 0,
      defence_slash: 0,
      defence_crush: 0,
      defence_magic: 0,
      defence_ranged: 0,
      melee_strength: 0,
      ranged_strength: 0,
      magic_damage: 0,
      prayer: 0
    };

    for (const slot of currentGearSet) {
      if (slot.selected?.stats) {
        // First add the basic gear stats
        Object.keys(totalStats).forEach(stat => {
          totalStats[stat as keyof typeof totalStats] += slot.selected!.stats[stat as keyof typeof slot.selected.stats];
        });

        // If this is a weapon slot, fetch and add weapon stats
        if (slot.slot === 'Weapon' && weaponStatsCache.length > 0) {
          console.log(`🗡️ Processing weapon slot with item ID: ${slot.selected.id}`);
          console.log(`📦 Weapon stats cache size: ${weaponStatsCache.length}`);
          
          const weaponStats = getWeaponStatsByItemId(weaponStatsCache, slot.selected.id);
          if (weaponStats.length > 0) {
            console.log(`✅ Weapon ${slot.selected.name} has ${weaponStats.length} combat styles:`, 
              weaponStats.map(ws => ({
                style: ws.combat_style,
                attackType: ws.attack_type,
                attackBonus: ws.attack_bonus,
                experience: ws.experience,
                attackSpeed: ws.attack_speed
              }))
            );
            
            // For now, use the first weapon stat entry
            // TODO: Later allow user to select combat style
            const selectedWeaponStat = weaponStats[0];
            console.log(`🎯 Using combat style: ${selectedWeaponStat.combat_style} (${selectedWeaponStat.attack_type})`);
            
            // Store weapon stats in the selected item for later use
            slot.selected.weaponStats = weaponStats;
          } else {
            console.warn(`⚠️ No weapon stats found for weapon ID: ${slot.selected.id}`);
            console.log(`🔍 Weapon name: ${slot.selected.name}`);
            console.log(`🔍 Available weapon item_ids sample:`, 
              weaponStatsCache.slice(0, 10).map(ws => `${ws.item_id} (${ws.weapon_name})`)
            );
          }
        }
      }
    }

    return totalStats;
  };

  const loadData = async () => {
    setIsLoading(true);
    
    try {
      // Get current gear stats
      const gearStats = await calculateTotalGearStats();
      
      // Use first selected monster or default values
      const targetMonster = selectedMonsters[0];
      
      // Get weapon info if available
      const weaponSlot = gearSets[activeGearTab].find(slot => slot.slot === 'Weapon');
      const selectedWeapon = weaponSlot?.selected;
      
      if (!targetMonster) {
        console.warn('No monster selected, using default values');
        // Use legacy function with default values
        const { calculateDPS } = await import('../utils/wasmLoader');
        const result = await calculateDPS(450, 70, 0.7);
        setPlotData(result.tickData);
        setStats({
          maxDPS: result.summary.maxDPS,
          avgDPS: result.summary.avgDPS,
          accuracy: result.summary.accuracy,
          timeToKill: result.summary.timeToKill
        });
        setIsLoading(false);
        return;
      }

      console.log('Calculating with gear stats:', gearStats);
      console.log('Calculating against monster:', targetMonster);
      console.log('Combat stats:', combatStats);

      // Prepare player object for WASM
      const playerData = {
        combatStats,
        gearStats,
        activeGearTab,
        selectedWeapon: selectedWeapon ? {
          name: selectedWeapon.name,
          id: selectedWeapon.id,
          weaponStats: selectedWeapon.weaponStats || []
        } : null
      };

      // Prepare monster object for WASM
      const monsterData = {
        hitpoints: targetMonster.hitpoints,
        name: targetMonster.name,
        combat_level: targetMonster.combat_level,
        defence_level: targetMonster.defence_level,
        defence_slash: targetMonster.defence_slash,
        defence_stab: targetMonster.defence_stab,
        defence_crush: targetMonster.defence_crush,
        defence_magic: targetMonster.defence_magic,
        defence_ranged: targetMonster.defence_ranged,
        magic_level: targetMonster.magic_level,
        max_hit: targetMonster.max_hit
      };

      // Call new WASM function with objects
      const result = await calculateDPSWithObjects(playerData, monsterData);
      
      setPlotData(result.tickData);
      setStats({
        maxDPS: result.summary.maxDPS,
        avgDPS: result.summary.avgDPS,
        accuracy: result.summary.accuracy,
        timeToKill: result.summary.timeToKill
      });
    } catch (error) {
      console.error('WASM calculation failed:', error);
      setStats({
        maxDPS: 0,
        avgDPS: 0,
        accuracy: 0,
        timeToKill: 0
      });
      setPlotData([]);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleRecalculate = () => {
    console.log('Manual recalculation triggered');
    loadData();
  };

  const handleDebugLog = async () => {
    const gearStats = await calculateTotalGearStats();
    const targetMonster = selectedMonsters[0];
    
    // Get weapon info if available
    const weaponSlot = gearSets[activeGearTab].find(slot => slot.slot === 'Weapon');
    const selectedWeapon = weaponSlot?.selected;
    
    // Prepare the same data that gets sent to WASM
    const playerData = {
      combatStats,
      gearStats,
      activeGearTab,
      selectedWeapon: selectedWeapon ? {
        name: selectedWeapon.name,
        id: selectedWeapon.id,
        weaponStats: selectedWeapon.weaponStats || []
      } : null
    };

    const monsterData = {
      hitpoints: targetMonster?.hitpoints || 450,
      name: targetMonster?.name || 'No monster selected',
      combat_level: targetMonster?.combat_level || 1,
      defence_level: targetMonster?.defence_level || 1,
      defence_slash: targetMonster?.defence_slash || 0,
      defence_stab: targetMonster?.defence_stab || 0,
      defence_crush: targetMonster?.defence_crush || 0,
      defence_magic: targetMonster?.defence_magic || 0,
      defence_ranged: targetMonster?.defence_ranged || 0,
      magic_level: targetMonster?.magic_level || 1,
      max_hit: targetMonster?.max_hit || 0
    };

    const wasmInput = {
      player: playerData,
      monster: monsterData,
      wasmFunctionCall: {
        function: 'calculate_dps_with_objects',
        parameters: [playerData, monsterData]
      }
    };

    console.group('🔧 WASM Debug Information');
    console.log('📊 Complete WASM Input Data:', wasmInput);
    console.log('⚔️ Monster Data:', wasmInput.monster);
    console.log('👤 Player Data:', wasmInput.player);
    console.log('🗡️ Weapon Data:', wasmInput.player.selectedWeapon);
    console.log('🎯 WASM Function Call:', wasmInput.wasmFunctionCall);
    console.groupEnd();
  };

  const chartColors = {
    primary: '#3b82f6',
    secondary: '#6366f1',
    grid: theme === 'light' ? '#e9ecef' : '#333333',
    text: theme === 'light' ? '#0a0a0a' : '#ffffff',
    background: 'transparent'
  };

  // Get current monster
  const currentMonster = selectedMonsters[0];

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
          {/* Current Configuration Display */}
          <motion.div
            className="config-display card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3>Current Configuration</h3>
            <div className="config-info">
              <div className="config-item">
                <strong>Combat Style:</strong> {activeGearTab.charAt(0).toUpperCase() + activeGearTab.slice(1)}
              </div>
              <div className="config-item">
                <strong>Target Monster:</strong> {currentMonster ? `${currentMonster.name} (CB: ${currentMonster.combat_level})` : 'No monster selected'}
              </div>
              <div className="config-item">
                <strong>Attack Bonus:</strong> {
                  activeGearTab === 'melee' ? currentGearStats.attack_stab :
                  activeGearTab === 'ranged' ? currentGearStats.attack_ranged :
                  currentGearStats.attack_magic
                }
              </div>
              <div className="config-item">
                <strong>Strength Bonus:</strong> {
                  activeGearTab === 'melee' ? currentGearStats.melee_strength :
                  activeGearTab === 'ranged' ? currentGearStats.ranged_strength :
                  currentGearStats.magic_damage
                }
              </div>
            </div>
          </motion.div>

          <motion.div
            ref={statsRef}
            className="stats-cards"
            initial={{ opacity: 0 }}
            animate={statsInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {[
              { title: 'Max DPS', value: stats.maxDPS > 0 ? stats.maxDPS.toFixed(1) : '--', unit: 'damage/sec' },
              { title: 'Average DPS', value: stats.avgDPS > 0 ? stats.avgDPS.toFixed(1) : '--', unit: 'damage/sec' },
              { title: 'Accuracy', value: stats.accuracy > 0 ? `${stats.accuracy.toFixed(1)}%` : '--', unit: 'hit rate' },
              { title: 'Time to Kill', value: stats.timeToKill > 0 ? `${stats.timeToKill}` : '--', unit: 'ticks' }
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
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
                <h3>{stat.title}</h3>
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
                  {stat.value}
                </motion.p>
                <span className="stat-unit">{stat.unit}</span>
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
              ) : plotData.length > 0 ? (
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
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickCount={plotData.length}
                          label={{ value: 'Tick', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: chartColors.text } }}
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
                      <BarChart data={plotData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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

          <motion.div
            ref={controlsRef}
            className="plot-controls card"
            initial={{ opacity: 0, y: 30 }}
            animate={controlsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3>Analysis Controls</h3>
            <p>Click recalculate to run WASM analysis with your current configuration.</p>
            <div className="control-buttons">
              <button 
                className="btn" 
                onClick={handleRecalculate}
                disabled={isLoading}
              >
                {isLoading ? 'Calculating...' : 'Recalculate'}
              </button>
              <button className="btn debug-btn" onClick={handleDebugLog}>
                Debug WASM Input
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default PlotSection;