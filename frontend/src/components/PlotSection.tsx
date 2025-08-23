import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut } from '../utils/animations';
import type { PlotDataPoint } from '../types/loaders';
import type { Monster, Room } from '../data/monsterStats';
import { miscIcons } from '../data/constants';
import { calculateDPSWithObjectsTekton } from '../loaders/tektonWasm';
import { calculateDPSWithObjectsVasa } from '../loaders/vasaWasm';
import { calculateDPSWithObjectsVespula } from '../loaders/vespulaWasm';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '../hooks/useTheme';
import type { GearSets, CombatStats, Equipment, InventoryItem } from '../types/player';
import './PlotSection.css';
import { getCombatStylesForCategory } from '../services/weaponStylesService';
import { calculateDPSWithObjectsGuardians } from '../loaders/guardiansWasm';
import { cmMonsters } from '../data/monsterStats';

const defaultIcon = '/gear/default.webp'; // You can change this later

const statIconMap: Record<string, keyof typeof miscIcons> = {
  'combat': 'levels',
  'attack': 'attack',
  'strength': 'strength',
  'defence': 'defense',
  'ranged': 'ranged',
  'hitpoints': 'hitpoints',
  'magic': 'magic',
  'stab': 'stab',
  'slash': 'slash',
  'crush': 'crush',
  'ranged_strength': 'ranged_strength',
  'magic_strength': 'magic_strength',
  'max_hit': 'max_hit',
  'flat_armor': 'flat_armor',
  'magic_defence': 'magic_defence',
  'ranged_defence': 'ranged_defence',
  'light': 'light',
  'standard': 'standard',
  'heavy': 'heavy'
};

// --- Constants & Types ---
const GEAR_TYPES = ['melee', 'mage', 'ranged'] as const;

const DEFAULT_GEAR_STATS = {
  bonuses: {
    str: 0,
    ranged_str: 0,
    magic_str: 0,
    prayer: 0
  },
  offensive: {
    stab: 0,
    slash: 0,
    crush: 0,
    magic: 0,
    ranged: 0
  },
  defensive: {
    stab: 0,
    slash: 0,
    crush: 0,
    magic: 0,
    ranged: 0
  }
};

interface PlotSectionProps {
  gearSets?: GearSets;
  combatStats?: CombatStats;
  selectedRooms?: Room[];
  selectedInventoryItems?: InventoryItem[];
}

type Stats = {
  total_hits: number;
  // expectedHits: number;
  // accuracy: number;
  total_expected_ticks: number;
};

// --- Helper Functions ---
const calculateGearStatsForSet = (
  gearType: typeof GEAR_TYPES[number],
  gearSets: GearSets
) => {
  if (!gearSets || !gearSets[gearType]) return { ...DEFAULT_GEAR_STATS };

  // Deep clone to avoid mutation
  const totalStats = JSON.parse(JSON.stringify(DEFAULT_GEAR_STATS));
  for (const slot of gearSets[gearType]) {
    const eq = slot.selected as Equipment | undefined;
    if (eq) {
      // Bonuses
      totalStats.bonuses.str += eq.bonuses.str ?? 0;
      totalStats.bonuses.ranged_str += eq.bonuses.ranged_str ?? 0;
      totalStats.bonuses.magic_str += (eq.bonuses.magic_str ? eq.bonuses.magic_str * 0.1 : 0);
      totalStats.bonuses.prayer += eq.bonuses.prayer ?? 0;
      // Offensive
      totalStats.offensive.stab += eq.offensive.stab ?? 0;
      totalStats.offensive.slash += eq.offensive.slash ?? 0;
      totalStats.offensive.crush += eq.offensive.crush ?? 0;
      totalStats.offensive.magic += eq.offensive.magic ?? 0;
      totalStats.offensive.ranged += eq.offensive.ranged ?? 0;
      // Defensive
      totalStats.defensive.stab += eq.defensive.stab ?? 0;
      totalStats.defensive.slash += eq.defensive.slash ?? 0;
      totalStats.defensive.crush += eq.defensive.crush ?? 0;
      totalStats.defensive.magic += eq.defensive.magic ?? 0;
      totalStats.defensive.ranged += eq.defensive.ranged ?? 0;
    }
  }
  return totalStats;
};
const getMonstersByRoom = (room: Room): Monster[] => {
  if (!room.monsters) return [];
  return room.monsters
    .map(monsterId => cmMonsters.find(m => m.id.toString() === monsterId))
    .filter((m): m is Monster => m !== undefined);
};
const wasmModelLoaders: Record<string, (player: any, monster: any) => Promise<any>> = {
  'tekton': calculateDPSWithObjectsTekton,
  'vasa': calculateDPSWithObjectsVasa,
  'guardians': calculateDPSWithObjectsGuardians,
  'vespula': calculateDPSWithObjectsVespula
};

// --- Main Component ---
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
  selectedRooms = [],
  selectedInventoryItems = []
}) => {
  // --- Theme & Chart Colors ---
  const { theme } = useTheme();
  const chartColors = {
    primary: '#3b82f6',
    secondary: '#6366f1',
    grid: theme === 'light' ? '#e9ecef' : '#333333',
    text: theme === 'light' ? '#0a0a0a' : '#ffffff',
    background: 'transparent'
  };

  // --- State ---
  const [isLoading, setIsLoading] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState<string>(
    selectedRooms.length > 0 ? selectedRooms[0].id : ''
  );
  const [allGearStats, setAllGearStats] = useState(() =>
    GEAR_TYPES.reduce((acc, type) => {
      acc[type] = { ...DEFAULT_GEAR_STATS };
      return acc;
    }, {} as Record<typeof GEAR_TYPES[number], typeof DEFAULT_GEAR_STATS>)
  );
  const [plotDataDict, setPlotDataDict] = useState<Record<string, PlotDataPoint[]>>({});
  const [statsDict, setStatsDict] = useState<Record<string, Stats>>({});
  const [showSeconds, setShowSeconds] = useState(false);

  // --- Refs ---
  const titleRef = useRef(null);
  const statsRef = useRef(null);
  const chartRef = useRef(null);

  // --- InView Hooks ---
  const titleInView = useInView(titleRef, { once: true, amount: 0.8 });
  const statsInView = useInView(statsRef, { once: true, amount: isMobile ? 0.1 : 0.3 });
  const chartInView = useInView(chartRef, { once: true, amount: isMobile ? 0.1 : 0.2 });

  // --- Effects ---
  // Responsive design
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (
      selectedRooms.length > 0 &&
      !selectedRooms.some(r => r.id === activeTab)
    ) {
      setActiveTab(selectedRooms[0].id);
    }
  }, [selectedRooms]);

  function isNonEmptyGearStats(stats: typeof DEFAULT_GEAR_STATS) {
    return Object.values(stats).some(group =>
      Object.values(group).some(val => val !== 0)
    );
  }

  // --- Core Logic ---
  useEffect(() => {
    // Calculate gear stats for all three gear sets (shared for all monsters)
    const newStats: Record<typeof GEAR_TYPES[number], typeof DEFAULT_GEAR_STATS> = {} as any;
    for (const type of GEAR_TYPES) {
      newStats[type] = calculateGearStatsForSet(type, gearSets);
    }
    setAllGearStats(newStats);
  }, [gearSets]);

  // --- Current Monster ---
  const activeRoom = selectedRooms.find(r => r.id === activeTab);
  const monstersInRoom = activeRoom ? getMonstersByRoom(activeRoom) : [];
  const currentMonster = monstersInRoom.length > 0 ? monstersInRoom[0] : null;
  const plotData = plotDataDict[activeTab] || [];
  const defaultStats: Stats = {
    total_hits: 0,
    // total_expected_hits: 0,
    total_expected_ticks: 0,
  };
  const activeStats = statsDict[activeTab] || defaultStats;

  // --- Transform plotData for seconds/ticks ---
  const plotDataToShow = showSeconds
    ? plotData.map(d => ({ ...d, time: d.time * 0.6 }))
    : plotData;

  const gearConfigSections = GEAR_TYPES
    .filter(type => isNonEmptyGearStats(allGearStats[type]))
    .map(type => ({
      key: type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Gear`,
      data: {
        'Offensive Bonuses': {
          'stab': allGearStats[type].offensive.stab || 0,
          'slash': allGearStats[type].offensive.slash || 0,
          'crush': allGearStats[type].offensive.crush || 0,
          'ranged': allGearStats[type].offensive.ranged || 0,
          'magic': allGearStats[type].offensive.magic || 0
        },
        'Strength Bonus': {
          'strength': allGearStats[type].bonuses.str || 0,
          'ranged_strength': allGearStats[type].bonuses.ranged_str || 0,
          'magic_strength': allGearStats[type].bonuses.magic_str || 0
        },
        'Defence Bonus': {
          'stab': allGearStats[type].defensive.stab || 0,
          'slash': allGearStats[type].defensive.slash || 0,
          'crush': allGearStats[type].defensive.crush || 0,
          'magic': allGearStats[type].defensive.magic || 0,
          'ranged': allGearStats[type].defensive.ranged || 0
        }
      }
    }));

  const configSections = [
    ...gearConfigSections,
    {
      key: 'monster',
      title: 'Monster Stats',
      data: {
        'Combat Levels': {
          'hitpoints': currentMonster?.skills.hp || 0,
          'attack': currentMonster?.skills.atk || 0,
          'strength': currentMonster?.skills.str || 0,
          'defence': currentMonster?.skills.def || 0,
          'ranged': currentMonster?.skills.ranged || 0,
          'magic': currentMonster?.skills.magic || 0
        },
        'Offensive Bonuses': {
          'max_hit': currentMonster?.max_hit || 0,
          'attack': currentMonster?.offensive.atk || 0,
          'strength': currentMonster?.offensive.str || 0,
          'ranged': currentMonster?.offensive.ranged || 0,
          'magic': currentMonster?.offensive.magic || 0,
          'ranged_strength': currentMonster?.offensive.ranged_str || 0,
          'magic_strength': currentMonster?.offensive.magic_str || 0,
        },
        'Defensive Bonuses': {
          'stab': currentMonster?.defensive.stab || 0,
          'slash': currentMonster?.defensive.slash || 0,
          'crush': currentMonster?.defensive.crush || 0,
          'magic_defence': currentMonster?.defensive.magic || 0,
          'light': currentMonster?.defensive.light || 0,
          'standard': currentMonster?.defensive.standard || 0,
          'heavy': currentMonster?.defensive.heavy || 0,
          'flat_armor': currentMonster?.defensive.flat_armour || 0,
        }
      }
    }
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (!selectedRooms.length) {
        setIsLoading(false);
        return;
      }

      // Calculate gear stats for all three gear sets (shared for all monsters)
      const calculatedGearStats: Record<typeof GEAR_TYPES[number], typeof DEFAULT_GEAR_STATS> = {} as any;
      for (const type of GEAR_TYPES) {
        calculatedGearStats[type] = await calculateGearStatsForSet(type, gearSets);
      }
      setAllGearStats(calculatedGearStats);

      // Get weapons for each gear set (shared for all monsters)
      const allWeapons: Record<typeof GEAR_TYPES[number], any> = GEAR_TYPES.reduce((acc, type) => {
        const weaponSlot = gearSets[type].find(slot => slot.slot === 'Weapon');
        const selectedWeapon = weaponSlot?.selected;
        acc[type] = selectedWeapon
          ? {
            ...selectedWeapon,
            weapon_styles: selectedWeapon.category
              ? getCombatStylesForCategory(selectedWeapon.category)
              : []
          }
          : null;
        return acc;
      }, {} as Record<typeof GEAR_TYPES[number], any>);

      // Apply the same logic to inventory items: add weapon_styles if category exists
      const inventoryWithStyles = selectedInventoryItems.map(item => {
        if (item.equipment && item.equipment.category && item.equipment.slot == 'weapon') {
          return {
            ...item,
            equipment: {
              ...item.equipment,
              weapon_styles: getCombatStylesForCategory(item.equipment.category)
            }
          };
        } else if (item.equipment) {
          return {
            ...item,
            equipment: {
              ...item.equipment,
              weapon_styles: []
            }
          };
        } else {
          return item;
        }
      });

      // Prepare player object for WASM (shared for all monsters)
      const playerData = {
        combatStats,
        gearSets: GEAR_TYPES.reduce((acc, type) => {
          acc[type] = {
            gearStats: calculatedGearStats[type],
            selectedWeapon: allWeapons[type],
            gearType: type,
            gearItems: gearSets[type]
              .map(slot => slot.selected?.name)
              .filter(Boolean)
          };
          return acc;
        }, {} as any),
        inventory: inventoryWithStyles
      };

      // Loop over all selected monsters
      const plotDataUpdates: Record<string, PlotDataPoint[]> = {};
      const statsUpdates: Record<string, Stats> = {};

      for (const room of selectedRooms) {
        const model = room.id || 'tekton';
        const loader = wasmModelLoaders[model] || wasmModelLoaders['tekton'];
        if (!loader) {
          console.error(`No WASM loader for model: ${model}`);
          continue;
        }
        // Get the full monster objects for this room
        const monsters = getMonstersByRoom(room);
        // Pass the array of monster objects as the "monsters" property
        const result = await loader(playerData, { ...room, monsters });
        const key = String(room.id || 'default');
        plotDataUpdates[key] = result.tickData;
        statsUpdates[key] = {
          total_hits: result.summary.expectedHits,
          total_expected_ticks: result.summary.ticksTimeToKill
        };
      }

      setPlotDataDict(prev => ({ ...prev, ...plotDataUpdates }));
      setStatsDict(prev => ({ ...prev, ...statsUpdates }));

    } catch (error) {
      console.error('WASM calculation failed:', error);
      // Optionally update statsDict/plotDataDict for all monsters with error values
    }
    setIsLoading(false);
  };

  // --- Debug & Controls ---
  const handleRecalculate = () => {
    loadData();
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          {/* Gear Configuration */}
          <motion.div
            className="config-display card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="plot-tabs">
              {selectedRooms.map(room => (
                <button
                  key={room.id}
                  className={`plot-tab${activeTab === room.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(room.id)}
                >
                  {room.name}
                </button>
              ))}
            </div>
            <div className="config-columns">
              {configSections.map(section => (
                <div className={`config-${section.key}`} key={section.key}>
                  <h3>{section.title}</h3>
                  <div className="config-info">
                    {Object.entries(section.data).map(([group, data]) => (
                      <div key={group} className="config-item">
                        <strong>{group}:</strong>
                        <div className="config-breakdown">
                          {Object.entries(data as Record<string, any>).map(([label, value]) => {
                            const iconKey = statIconMap[label] || '';
                            const iconSrc = miscIcons[iconKey as keyof typeof miscIcons] || defaultIcon;
                            return (
                              <span key={label} className="config-type">
                                <img
                                  src={iconSrc}
                                  alt={label}
                                  title={label}
                                />
                                {value ?? '--'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            ref={statsRef}
            className="stats-cards"
            initial={{ opacity: 0 }}
            animate={statsInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {[
              { title: 'Total Hit Value', value: activeStats.total_hits > 0 ? activeStats.total_hits.toFixed(1) : '--' },
              // { title: 'Total Hit Count', value: activeStats.total_expected_ticks > 0 ? activeStats.total_expected_ticks.toFixed(1) : '--' },
              // { title: 'Accuracy', value: activeStats.accuracy > 0 ? `${activeStats.accuracy.toFixed(1)}%` : '--', unit: 'hit rate' },
              { 
                title: 'Time to Kill', 
                value: activeStats.total_expected_ticks > 0
                  ? (showSeconds
                      ? formatSeconds(activeStats.total_expected_ticks * 0.6)
                      : activeStats.total_expected_ticks.toFixed(1))
                  : '--',
                unit: showSeconds ? 'min:sec' : 'ticks' 
              },
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

          {/* Chart */}
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
        </div>
      </div>
    </motion.section>
  );
};

export default PlotSection;

