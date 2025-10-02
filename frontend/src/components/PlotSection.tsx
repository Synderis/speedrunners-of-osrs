import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { fadeInOut } from '../utils/animations';
import type { PlotDataPoint } from '../types/loaders';
import type { Monster, Floor, Room } from '../data/monsterStats';
import { useTheme } from '../hooks/useTheme';
import type { GearSets, CombatStats, Equipment, InventoryItem } from '../types/player';
import './PlotSection.css';
import { getCombatStylesForCategory } from '../services/weaponStylesService';
import { cmMonsters, RAID_FLOORS } from '../data/monsterStats';
import ResultPlot from './ResultPlot';
import ConfigColumns from './ConfigColumns';
import { GEAR_TYPES, DEFAULT_GEAR_STATS, wasmModelLoaders } from '../data/constants';


interface PlotSectionProps {
  gearSets?: GearSets;
  combatStats?: CombatStats;
  selectedRooms?: Room[];
  selectedInventoryItems?: InventoryItem[];
  selectedMethods?: { [roomId: string]: string[] }; // Changed to match RoomSelection format
  roomSpecs?: { [roomId: string]: { weapon: string; count: number } };
}

type Stats = {
  total_hits: number;
  total_expected_seconds: number;
  total_expected_ticks: number;
  result?: any;
  phase_time_results?: any[];
  phase_results: any[]
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
      // Bonuses (keep special logic for magic_str)
      totalStats.bonuses.str += eq.bonuses.str ?? 0;
      totalStats.bonuses.ranged_str += eq.bonuses.ranged_str ?? 0;
      totalStats.bonuses.magic_str += (eq.bonuses.magic_str ? eq.bonuses.magic_str * 0.1 : 0);
      totalStats.bonuses.prayer += eq.bonuses.prayer ?? 0;
      // Offensive stats
      for (const statName of Object.keys(totalStats.offensive)) {
        totalStats.offensive[statName as keyof typeof totalStats.offensive] += 
          eq.offensive[statName as keyof typeof eq.offensive] ?? 0;
      }
      // Defensive stats
      for (const statName of Object.keys(totalStats.defensive)) {
        totalStats.defensive[statName as keyof typeof totalStats.defensive] += 
          eq.defensive[statName as keyof typeof eq.defensive] ?? 0;
      }
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

// Add this helper function after the existing helper functions (around line 200)
const cropDistributionTo999 = (data: PlotDataPoint[]): PlotDataPoint[] => {
  if (!data || data.length === 0) return data;

  // Find the index where cumulative probability reaches 0.999
  const cropIndex = data.findIndex(point => point.dps >= 0.999);

  if (cropIndex === -1) {
    // If we never reach 0.999, return the full distribution
    return data;
  }

  // Return data up to and including the 0.999 point, plus a few extra points for smoothness
  const extraPoints = Math.min(10, data.length - cropIndex - 1);
  return data.slice(0, cropIndex + 1 + extraPoints);
};

// Modify the calculateCombinedDistribution function around line 350
const calculateCombinedDistribution = (
  room1Data: PlotDataPoint[],
  room2Data: PlotDataPoint[],
  delayTicks: number = 89
): PlotDataPoint[] => {
  // Input validation
  if (!room1Data || !room2Data || !Array.isArray(room1Data) || !Array.isArray(room2Data)) {
    console.error('Invalid input data for combined distribution');
    return [];
  }

  if (!room1Data.length || !room2Data.length) {
    console.error('Empty data arrays for combined distribution');
    return [];
  }

  try {
    // Validate data structure
    const validateData = (data: PlotDataPoint[], name: string) => {

      for (let i = 0; i < data.length; i++) {
        const point = data[i];
        if (!point || typeof point.time !== 'number' || typeof point.dps !== 'number') {
          console.error(`Invalid data point in ${name} at index ${i}:`, point);
          return false;
        }
        // Relax the validation - allow dps values greater than 1 since they might be cumulative probabilities
        if (isNaN(point.time) || isNaN(point.dps) || point.time < 0 || point.dps < 0) {
          console.error(`Invalid values in ${name} at index ${i}:`, point, {
            timeNaN: isNaN(point.time),
            dpsNaN: isNaN(point.dps),
            timeNegative: point.time < 0,
            dpsNegative: point.dps < 0
          });
          return false;
        }
      }
      return true;
    };

    if (!validateData(room1Data, 'room1') || !validateData(room2Data, 'room2')) {
      return [];
    }

    // Get the max times for both distributions
    const maxTime1 = Math.max(...room1Data.map(d => d.time));
    const maxTime2 = Math.max(...room2Data.map(d => d.time));

    if (!isFinite(maxTime1) || !isFinite(maxTime2) || maxTime1 <= 0 || maxTime2 <= 0) {
      console.error('Invalid max times:', { maxTime1, maxTime2 });
      return [];
    }

    const maxCombinedTime = maxTime1 + maxTime2 + delayTicks;

    if (maxCombinedTime > 10000) { // Prevent memory issues
      console.error('Combined time too large:', maxCombinedTime);
      return [];
    }

    // Convert cumulative distributions to probability mass functions
    const convertToPMF = (data: PlotDataPoint[], maxTime: number) => {
      const pmf = new Array(Math.floor(maxTime) + 1).fill(0);

      let totalMassAdded = 0;
      let nonZeroCount = 0;

      for (let i = 0; i < data.length - 1; i++) {
        const currentProb = data[i].dps;
        const nextProb = data[i + 1]?.dps || 0;
        // For increasing CDF, probability mass is nextProb - currentProb
        const probMass = Math.max(0, nextProb - currentProb);
        const timeIndex = Math.floor(data[i].time);

        if (timeIndex >= 0 && timeIndex < pmf.length && probMass > 0 && isFinite(probMass)) {
          pmf[timeIndex] = probMass;
          totalMassAdded += probMass;
          nonZeroCount++;
        }
      }

      return pmf;
    };

    const pmf1 = convertToPMF(room1Data, maxTime1);
    const pmf2 = convertToPMF(room2Data, maxTime2);

    // Validate PMFs
    if (!pmf1.length || !pmf2.length) {
      console.error('Failed to create PMFs');
      return [];
    }

    // Convolve the distributions with delay
    const combinedPMF = new Array(Math.floor(maxCombinedTime) + 1).fill(0);

    for (let t1 = 0; t1 < pmf1.length; t1++) {
      if (pmf1[t1] > 0) {
        for (let t2 = 0; t2 < pmf2.length; t2++) {
          if (pmf2[t2] > 0) {
            const combinedTime = t1 + t2 + delayTicks;
            if (combinedTime >= 0 && combinedTime < combinedPMF.length) {
              const product = pmf1[t1] * pmf2[t2];
              if (isFinite(product)) {
                combinedPMF[combinedTime] += product;
              }
            }
          }
        }
      }
    }

    // Convert back to cumulative distribution - ONLY ADD NON-ZERO POINTS
    const combinedData: PlotDataPoint[] = [];
    let cumulativeProb = 0;

    // For increasing CDF, we build from left to right (time 0 to max)
    for (let t = 0; t < combinedPMF.length; t++) {
      if (isFinite(combinedPMF[t])) {
        cumulativeProb += combinedPMF[t];
      }

      // ONLY add data points where there's actual probability mass or where cumulative changes
      if (combinedPMF[t] > 0 || (combinedData.length > 0 && cumulativeProb !== combinedData[combinedData.length - 1].dps)) {
        combinedData.push({
          time: t,
          dps: Math.min(1, Math.max(0, cumulativeProb)) // Ensure probability is between 0 and 1
        });
      }
    }

    // Crop the distribution to 99.9%
    const croppedData = cropDistributionTo999(combinedData);

    if (!croppedData.length) {
      console.error('No combined data generated after cropping');
      return [];
    }

    return croppedData;
  } catch (error) {
    console.error('Error calculating combined distribution:', error);
    return [];
  }
};

function monsterStatScaling(monster: Monster, playerHp: number) {
  if (monster.name === "Head" || monster.name === "Melee Hand" || monster.name === "Mage Hand") {
    return monster.skills; // No scaling for Olm forms
  }
  const isTekton = monster.name === "Tekton" || monster.name === "Tekton (enraged)";
  const cmScale = isTekton ? 1.2 : 1.5;
  const hpScaling = (Math.floor(playerHp * (4.0 / 9.0)) + 55.0) / 99.0;

  const scale = (val: number) =>
    Math.floor(Math.floor(Math.floor(val / cmScale) * hpScaling) * cmScale);

  return {
    atk: scale(monster.skills.atk),
    def: scale(monster.skills.def),
    hp: monster.skills.hp,
    magic: scale(monster.skills.magic),
    ranged: scale(monster.skills.ranged),
    str: scale(monster.skills.str),
  };
}

function monsterHpScaling(monster: Monster, combatStats: CombatStats) {
  if (monster.name === "Head" || monster.name === "Melee Hand" || monster.name === "Mage Hand") {
    return monster.skills.hp; // No scaling for Olm forms
  }
  const base =
    (combatStats.defence +
      combatStats.hitpoints +
      Math.floor(combatStats.prayer * 0.5)) *
    0.25;
  const melee = ((combatStats.attack + combatStats.strength) * 13.0) / 40.0;
  const ranged = ((combatStats.ranged * 1.5) * 13.0) / 40.0;
  const magic = ((combatStats.magic * 1.5) * 13.0) / 40.0;
  const cmScale = 1.5;

  let baseHp: number;
  if (monster.name === "Guardian (Chambers of Xeric)") {
    const reducedHp = Math.floor(monster.skills.hp / cmScale);
    baseHp = Math.floor(reducedHp - 99.0 + combatStats.mining);
  } else {
    baseHp = Math.floor(monster.skills.hp / cmScale);
  }
  const combatLevel = Math.floor(base + Math.max(melee, ranged, magic));
  return Math.floor(Math.floor(baseHp * (combatLevel / 126.0)) * cmScale);
}

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
    defence: 99,
    ranged: 99,
    magic: 99,
    hitpoints: 99,
    prayer: 99,
    woodcutting: 99,
    mining: 99,
    thieving: 99
  },
  selectedRooms = [],
  selectedInventoryItems = [],
  selectedMethods = {},
  roomSpecs = {}
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
  const [selectedMonsterIdx, setSelectedMonsterIdx] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [activeFloor, setActiveFloor] = useState<string>(''); // New state for active floor tab
  const combinedChartRef = useRef(null);

  // --- New state variables for combined analysis ---
  const [availableFloors, setAvailableFloors] = useState<Floor[]>([]);
  const [combinedRoomAnalysis, setCombinedRoomAnalysis] = useState<Record<string, {
    plotData: PlotDataPoint[];
    expectedTime: number;
    floorName: string;
    roomStats: Array<{ name: string; stats: Stats }>;
    floorId: string;
  } | null>>({});

  // --- Default Stats (needed for combined room analysis) ---
  const defaultStats: Stats = {
    total_hits: 0,
    phase_time_results: [],
    phase_results: [],
    total_expected_seconds: 0,
    total_expected_ticks: 0,
  };

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
      setSelectedMonsterIdx(0); // Reset monster selection as well
    }
  }, [selectedRooms, activeTab]);

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
  const currentMonster = monstersInRoom.length > 0 ? monstersInRoom[selectedMonsterIdx] : null;
  const plotData = plotDataDict[activeTab] || [];
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
          'magic_defence': allGearStats[type].defensive.magic || 0,
          'ranged_defence': allGearStats[type].defensive.ranged || 0
        }
      }
    }));

  const configSections = [
    ...gearConfigSections,
    {
  key: 'monster',
  title: 'Monster Stats',
  data: (() => {
    if (!currentMonster) {
      return {
        'Combat Levels': {
          'hitpoints': 0,
          'attack': 0,
          'strength': 0,
          'defence': 0,
          'ranged': 0,
          'magic': 0
        },
        'Offensive Bonuses': {
          'max_hit': 0,
          'attack': 0,
          'strength': 0,
          'ranged': 0,
          'magic': 0,
          'ranged_strength': 0,
          'magic_strength': 0,
        },
        'Defensive Bonuses': {
          'stab': 0,
          'slash': 0,
          'crush': 0,
          'magic_defence': 0,
          'light': 0,
          'standard': 0,
          'heavy': 0,
          'flat_armor': 0,
        }
      };
    }

    // Apply scaling (returns raw stats for Olm, scaled stats for others)
    const scaledStats = monsterStatScaling(currentMonster, combatStats.hitpoints);
    const scaledHp = monsterHpScaling(currentMonster, combatStats);

    return {
      'Combat Levels': {
        'hitpoints': scaledHp,
        'attack': scaledStats.atk,
        'strength': scaledStats.str,
        'defence': scaledStats.def,
        'ranged': scaledStats.ranged,
        'magic': scaledStats.magic
      },
      'Offensive Bonuses': {
        'max_hit': currentMonster.max_hit || 0,
        'attack': currentMonster.offensive.atk || 0,
        'strength': currentMonster.offensive.str || 0,
        'ranged': currentMonster.offensive.ranged || 0,
        'magic': currentMonster.offensive.magic || 0,
        'ranged_strength': currentMonster.offensive.ranged_str || 0,
        'magic_strength': currentMonster.offensive.magic_str || 0,
      },
      'Defensive Bonuses': {
        'stab': currentMonster.defensive.stab || 0,
        'slash': currentMonster.defensive.slash || 0,
        'crush': currentMonster.defensive.crush || 0,
        'magic_defence': currentMonster.defensive.magic || 0,
        'light': currentMonster.defensive.light || 0,
        'standard': currentMonster.defensive.standard || 0,
        'heavy': currentMonster.defensive.heavy || 0,
        'flat_armor': currentMonster.defensive.flat_armour || 0,
      }
    };
  })()
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
              .map(slot => slot.selected)
              .filter((item): item is Equipment => Boolean(item))
          };
          return acc;
        }, {} as any),
        inventory: inventoryWithStyles
      };
      console.log('Player Data for WASM:', playerData);

      // Loop over all selected monsters (PARALLELIZED)
      const roomPromises = selectedRooms.map(async (room) => {
        const model = room.id || 'tekton';
        const loader = wasmModelLoaders[model] || wasmModelLoaders['tekton'];
        if (!loader) {
          console.error(`No WASM loader for model: ${model}`);
          return null;
        }
        // Get the full monster objects for this room
        const monsters = getMonstersByRoom(room);
        const selectedMethodsForRoom = selectedMethods && selectedMethods[room.id];
        let filteredMethods: string[] = [];

        // Only include methods if they are explicitly selected
        if (selectedMethodsForRoom && Array.isArray(selectedMethodsForRoom) && selectedMethodsForRoom.length > 0) {
          filteredMethods = selectedMethodsForRoom;
        } else if (room.methods && room.methods.length === 1 && !selectedMethodsForRoom) {
          // Special case: if there's only one method and no explicit selection, include it
          filteredMethods = room.methods;
        } else {
          // No methods selected - send empty array
          filteredMethods = [];
        }

        const roomPayload = {
          ...room,
          methods: filteredMethods,
          monsters,
          specialAttacks: roomSpecs[room.id] && roomSpecs[room.id].weapon
            ? [{ name: roomSpecs[room.id].weapon, count: roomSpecs[room.id].count }]
            : []
        };
        console.log('Sending to WASM:', { room: roomPayload, monsters });
        const result = await loader(playerData, roomPayload);
        const key = String(room.id || 'default');
        console.log(`WASM result for room ${room.name} (${key}):`, result, result.perMonster);
        return {
          key,
          plotData: result.tickData,
          stats: {
            total_hits: result.summary.expectedHits,
            total_expected_ticks: result.summary.ticksTimeToKill,
            total_expected_seconds: result.summary.secondsTimeToKill,
            result: result.perMonster,
            phase_time_results: result.summary.phaseTimeResults || [],
            phase_results: result.summary.phaseResults || [],
          }
        };
      });

      const results = await Promise.all(roomPromises);

      const plotDataUpdates: Record<string, PlotDataPoint[]> = {};
      const statsUpdates: Record<string, Stats> = {};

      results.forEach(res => {
        if (res) {
          plotDataUpdates[res.key] = res.plotData;
          statsUpdates[res.key] = res.stats;
        }
      });

      // setPlotDataDict(prev => ({ ...prev, ...plotDataUpdates }));
      // setStatsDict(prev => ({ ...prev, ...statsUpdates }));
      setPlotDataDict(plotDataUpdates);
      setStatsDict(statsUpdates);

      // Check if Vespula Pots Skip is selected
      let tightropeDelayAdjustment = 0;
      if (selectedMethods && selectedMethods['vespula'] && selectedMethods['vespula'].includes('Vespula Pots Skip')) {
        tightropeDelayAdjustment = 11;
      }

      // Pass adjustment to combined floor analysis
      calculateCombinedFloorAnalysis(plotDataUpdates, statsUpdates, tightropeDelayAdjustment);

    } catch (error) {
      console.error('WASM calculation failed:', error);
    }
    setIsLoading(false);
  };

  // New function to calculate combined analysis
  const calculateCombinedFloorAnalysis = (
    plotData: Record<string, PlotDataPoint[]>,
    statsData: Record<string, Stats>,
    tightropeDelayAdjustment: number = 0
  ) => {
    console.log('Calculating combined floor analysis');

    if (selectedRooms.length < 2) {
      setAvailableFloors([]);
      setCombinedRoomAnalysis({});
      return;
    }

    // Find which floors can be analyzed based on selected rooms
    const floors = RAID_FLOORS.filter(floor => {
      const combatRooms = floor.rooms.filter(room => !room.isDelay);
      const hasAllRoomsSelected = combatRooms.every(room =>
        selectedRooms.some(selectedRoom => selectedRoom.id === room.roomId)
      );
      const hasAllRoomsData = combatRooms.every(room =>
        plotData[room.roomId] && statsData[room.roomId]
      );

      return hasAllRoomsSelected && hasAllRoomsData;
    });

    setAvailableFloors(floors);

    // Set default active floor if needed
    if (floors.length > 0 && !floors.some(f => f.id === activeFloor)) {
      setActiveFloor(floors[0].id);
    }

    // Calculate analysis for ALL available floors
    const newCombinedAnalysis: Record<string, any> = {};

    for (const floor of floors) {
      try {
        let combinedPlotData: PlotDataPoint[] = [];
        let totalExpectedTime = 0;
        const roomStats: Array<{ name: string; stats: Stats }> = [];
        let pendingDelay = 0;

        for (let i = 0; i < floor.rooms.length; i++) {
          const room = floor.rooms[i];

          if (room.isDelay) {
            let delayTicks = room.delayTicks || 0;
            // If this is tightrope, apply adjustment
            if (room.roomId === 'tightrope' && tightropeDelayAdjustment > 0) {
              delayTicks = Math.max(0, delayTicks - tightropeDelayAdjustment);
            }
            pendingDelay += delayTicks;
            totalExpectedTime += delayTicks;
          } else {
            const roomData = plotData[room.roomId];
            const roomStatsData = statsData[room.roomId];

            if (!roomData || !roomStatsData) continue;

            roomStats.push({ name: room.name, stats: roomStatsData });
            totalExpectedTime += roomStatsData.total_expected_ticks || 0;

            if (combinedPlotData.length === 0) {
              combinedPlotData = [...roomData];
            } else {
              combinedPlotData = calculateCombinedDistribution(combinedPlotData, roomData, pendingDelay);
              if (combinedPlotData.length === 0) {
                console.error(`Failed to combine distribution for floor ${floor.id}`);
                break;
              }
            }
            pendingDelay = 0;
          }
        }

        // Apply final delay if any
        if (pendingDelay > 0) {
          combinedPlotData = combinedPlotData.map(point => ({
            ...point,
            time: point.time + pendingDelay
          }));
        }

        // Store the result for this floor
        newCombinedAnalysis[floor.id] = {
          plotData: combinedPlotData,
          expectedTime: totalExpectedTime,
          floorName: floor.name,
          roomStats: roomStats,
          floorId: floor.id
        };

      } catch (error) {
        console.error(`Error in floor analysis for ${floor.id}:`, error);
        newCombinedAnalysis[floor.id] = null;
      }
    }

    setCombinedRoomAnalysis(newCombinedAnalysis);
  };

  // --- Debug & Controls ---
  const handleRecalculate = () => {
    loadData();
  };

  const formatSeconds = (seconds: number) => {
    // Always show tenths, rounded
    const mins = Math.floor(seconds / 60);
    const secsFloat = seconds % 60;
    const secs = Math.floor(secsFloat);
    let tenths = Math.round((secsFloat - secs) * 10);
    // Handle rollover (e.g., 59.95 rounds to 60.0)
    let displaySecs = secs;
    let displayMins = mins;
    if (tenths === 10) {
      tenths = 0;
      displaySecs += 1;
      if (displaySecs === 60) {
        displaySecs = 0;
        displayMins += 1;
      }
    }
    return `${displayMins}:${displaySecs.toString().padStart(2, '0')}.${tenths}`;
  };

  const statCards = [
    {
      title: 'Combat Type', value: (() => {
        if (!activeRoom) return '--';
        const monsters = getMonstersByRoom(activeRoom);
        const monster = monsters[selectedMonsterIdx];
        const perMonsterArr = activeStats.result || [];
        // Find the matching perMonster entry by monster_id
        const perMonster = monster
          ? perMonsterArr.find((pm: any) => String(pm.monster_id) === String(monster.id))
          : null;
        return perMonster
          ? `${perMonster.combat_type}`
          : '--';
      })()
    },
    {
      title: 'Attack Style', value: (() => {
        if (!activeRoom) return '--';
        const monsters = getMonstersByRoom(activeRoom);
        const monster = monsters[selectedMonsterIdx];
        const perMonsterArr = activeStats.result || [];
        // Find the matching perMonster entry by monster_id
        const perMonster = monster
          ? perMonsterArr.find((pm: any) => String(pm.monster_id) === String(monster.id))
          : null;
        return perMonster
          ? `${perMonster.attack_style}`
          : '--';
      })()
    },

    // { title: 'Total Hit Value', value: activeStats.total_hits > 0 ? activeStats.total_hits.toFixed(1) : '--' },
    {
      title: 'Avg Phase Count',
      value: (() => {
        const phaseResults = activeStats.phase_results || [];
        if (!phaseResults.length) return null;
        const avg = phaseResults.reduce((sum, val) => sum + val, 0) / phaseResults.length;
        if (!avg || avg <= 0) return null;
        return avg.toFixed(2);
      })(),
      unit: activeRoom?.units || 'units'
    },
    {
      title: 'One Phase Odds',
      value: (() => {
        const phaseResults = activeStats.phase_results || [];
        if (!phaseResults.length) return null;
        const onePhaseCount = phaseResults.filter(val => val <= 1).length;
        if (phaseResults.filter(val => val > 0).length === 0) return null;
        const odds = onePhaseCount / phaseResults.length;
        if (!odds || odds <= 0) return null;
        return (odds * 100).toFixed(2) + '%';
      })(),
      unit: activeRoom?.units || 'units'
    },
    {
      title: 'Avg Phase Time',
      value: (() => {
        const phaseTimeResults = activeStats.phase_time_results || [];
        if (!phaseTimeResults.length) return null;
        const avg = phaseTimeResults.reduce((sum, val) => sum + val, 0) / phaseTimeResults.length;
        if (showSeconds) {
          return formatSeconds(avg * 0.6);
        } else {
          return avg.toFixed(1);
        }
      })(),
      unit: showSeconds ? 'min:sec' : 'ticks'
    },
    // { title: 'Total Hit Count', value: activeStats.total_expected_ticks > 0 ? activeStats.total_expected_ticks.toFixed(1) : '--' },
    // { title: 'Accuracy', value: activeStats.accuracy > 0 ? `${activeStats.accuracy.toFixed(1)}%` : '--', unit: 'hit rate' },
    {
      title: 'Time to Kill',
      value: activeStats.total_expected_ticks > 0
        ? (showSeconds
          ? formatSeconds(activeStats.total_expected_seconds)
          : activeStats.total_expected_ticks.toFixed(1))
        : '--',
      unit: showSeconds ? 'min:sec' : 'ticks'
    },
  ].filter(stat => stat.value !== null);

  // Computed value for combined plot data to show
  const combinedPlotDataToShow = useMemo(() => {
    if (!combinedRoomAnalysis[activeFloor]?.plotData) return [];

    return showSeconds
      ? combinedRoomAnalysis[activeFloor].plotData.map(d => ({ ...d, time: d.time * 0.6 }))
      : combinedRoomAnalysis[activeFloor].plotData;
  }, [combinedRoomAnalysis[activeFloor]?.plotData, showSeconds, activeFloor]);

  // Add this after the other useMemo hooks (around line 500)
  const shouldShowCombinedPlot = useMemo(() => {
    const hasBasicRequirements = selectedRooms.length >= 2 &&
      Object.keys(plotDataDict).length >= 2;

    const shouldShow = availableFloors.length > 0 &&
      combinedRoomAnalysis[activeFloor] &&
      combinedRoomAnalysis[activeFloor]!.plotData &&
      combinedRoomAnalysis[activeFloor]!.plotData.length > 0 &&
      combinedPlotDataToShow.length > 0;

    return hasBasicRequirements && (shouldShow || availableFloors.length > 0);
  }, [
    selectedRooms.length,
    Object.keys(plotDataDict).length,
    availableFloors.length,
    activeFloor,
    combinedRoomAnalysis[activeFloor]?.plotData?.length,
    combinedPlotDataToShow.length
  ]);

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
              {/* Room tabs (top row) */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '0.5rem' }}>
                {selectedRooms.map(room => (
                  <button
                    key={room.id}
                    className={`plot-tab${activeTab === room.id ? ' active' : ''}`}
                    onClick={() => {
                      setActiveTab(room.id);
                      setSelectedMonsterIdx(0); // Reset to first monster when tab changes
                    }}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
              {/* Monster selector buttons (below) */}
              {selectedRooms.map(room => {
                const monsters = getMonstersByRoom(room);
                // Get unique monster IDs
                const uniqueIds = Array.from(new Set(monsters.map(m => m.id)));
                return (
                  activeTab === room.id && uniqueIds.length > 1 && (
                    <div
                      key={room.id}
                      style={{
                        marginLeft: 0,
                        marginTop: 8,
                        marginBottom: 8,
                        display: 'flex',
                        gap: '2rem',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                      }}
                    >
                      {monsters.map((monster, idx) => (
                        <button
                          key={monster.id}
                          className={`plot-tab monster-tab${selectedMonsterIdx === idx ? ' active' : ''}`}
                          style={{ padding: '8px 18px' }}
                          onClick={() => setSelectedMonsterIdx(idx)}
                          type="button"
                        >
                          {monster.name}
                        </button>
                      ))}
                    </div>
                  )
                );
              })}
            </div>
            <button
              className="btn"
              style={{ margin: '0.5rem 0' }}
              onClick={() => setShowConfig(v => !v)}
              type="button"
            >
              {showConfig ? 'Hide Gear/Monster Config' : 'Show Gear/Monster Config'}
            </button>
            {showConfig && (
              <ConfigColumns configSections={configSections} />
            )}
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            ref={statsRef}
            className="stats-cards"
            initial={{ opacity: 0 }}
            animate={statsInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {statCards.map((stat, index) => (
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
          <ResultPlot
            chartRef={chartRef}
            chartName='result-plot'
            chartInView={chartInView}
            isLoading={isLoading}
            handleRecalculate={handleRecalculate}
            showSeconds={showSeconds}
            setShowSeconds={setShowSeconds}
            chartType={chartType}
            setChartType={setChartType}
            plotDataToShow={plotDataToShow}
            chartColors={chartColors}
            theme={theme}
            formatSeconds={formatSeconds}
            fadeInOut={fadeInOut}
            expectedTTK={showSeconds ? activeStats.total_expected_seconds.toFixed(1) : activeStats.total_expected_ticks.toFixed(1)}
          />

          {/* NEW COMBINED ROOMS PLOT SECTION - NOW FLOOR BASED */}
          {shouldShowCombinedPlot && (
            <div
              className="combined-plot-section"
              style={{
                marginTop: '1rem',
                display: 'block',
                visibility: 'visible',
                opacity: 1,
                minHeight: '400px',
                padding: '20px'
              }}
            >
              {/* Floor Tabs */}
              {availableFloors.length > 1 && (
                <div className="floor-tabs" style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  {availableFloors.map(floor => (
                    <button
                      key={floor.id}
                      className={`plot-tab${activeFloor === floor.id ? ' active' : ''}`}
                      onClick={() => setActiveFloor(floor.id)}
                      style={{
                        padding: '12px 24px',
                        fontSize: '1rem',
                        fontWeight: '600'
                      }}
                    >
                      {floor.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Combined Plot Title */}
              <h3
                className="combined-plot-title"
                style={{
                  textAlign: 'center',
                  margin: '2rem 0 1rem 0',
                  color: chartColors.text,
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  borderBottom: `2px solid ${chartColors.primary}`,
                  paddingBottom: '0.5rem',
                  opacity: 1
                }}
              >
                {combinedRoomAnalysis[activeFloor]?.floorName} Analysis
              </h3>

              {/* Plot and Stats Container - Side by Side */}
              <div style={{
                display: 'flex',
                gap: '2rem',
                alignItems: 'flex-start',
                justifyContent: 'center'
              }}>
                {/* Combined Plot - Left Side */}
                <div style={{ flex: '1', minWidth: '600px' }}>
                  <ResultPlot
                    key={`combined-plot-${activeFloor}`}
                    chartRef={combinedChartRef}
                    chartName='combined-plot'
                    chartInView={true}
                    isLoading={false}
                    handleRecalculate={() => { }}
                    showSeconds={showSeconds}
                    setShowSeconds={setShowSeconds}
                    chartType={chartType}
                    setChartType={setChartType}
                    plotDataToShow={combinedPlotDataToShow || []}
                    chartColors={{ ...chartColors, primary: chartColors.secondary }}
                    theme={theme}
                    formatSeconds={formatSeconds}
                    fadeInOut={fadeInOut}
                    expectedTTK={combinedRoomAnalysis[activeFloor] ? (showSeconds
                      ? (combinedRoomAnalysis[activeFloor]!.expectedTime * 0.6).toFixed(1)
                      : combinedRoomAnalysis[activeFloor]!.expectedTime.toFixed(1)
                    ) : '0'}
                  />
                </div>

                {/* Combined Stats Card - Right Side */}
                <div style={{ flexShrink: 0, width: '350px' }}>
                  <div
                    className="stat-card card combined-stat-card"
                    style={{
                      height: 'fit-content',
                      textAlign: 'center',
                      background: `linear-gradient(135deg, ${chartColors.primary}20, ${chartColors.secondary}20)`,
                      opacity: 1,
                      position: 'sticky',
                      top: '20px'
                    }}
                  >
                    <h3>Total Expected {combinedRoomAnalysis[activeFloor]?.floorName || 'Floor'} Time</h3>
                    <p
                      className="stat-value"
                      style={{ fontSize: '2rem', color: chartColors.primary, opacity: 1 }}
                    >
                      {combinedRoomAnalysis[activeFloor] ? (showSeconds
                        ? formatSeconds(combinedRoomAnalysis[activeFloor]!.expectedTime * 0.6)
                        : combinedRoomAnalysis[activeFloor]!.expectedTime.toFixed(1)
                      ) : '--'}
                    </p>
                    <span className="stat-unit">
                      {showSeconds ? 'min:sec' : 'ticks'} (including delays)
                    </span>
                    <div style={{
                      marginTop: '1rem',
                      fontSize: '0.9rem',
                      color: chartColors.text + '80'
                    }}>
                      {/* Header Row */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        borderBottom: `1px solid ${chartColors.text}40`,
                        fontWeight: 'bold',
                        marginBottom: '0.5rem'
                      }}>
                        <div>Room</div>
                        <div style={{ textAlign: 'center' }}>Time</div>
                        <div style={{ textAlign: 'center' }}>Total</div>
                      </div>

                      {/* Data Rows */}
                      {(() => {
                        if (!combinedRoomAnalysis[activeFloor]?.roomStats) return null;

                        const floor = RAID_FLOORS.find(f => f.id === activeFloor);
                        if (!floor) return null;

                        // Determine if Vespula Pots Skip is selected
                        let tightropeDelayAdjustment = 0;
                        if (selectedMethods && selectedMethods['vespula'] && selectedMethods['vespula'].includes('Vespula Pots Skip')) {
                          tightropeDelayAdjustment = 11;
                        }

                        let runningTotal = 0;
                        const rows: JSX.Element[] = [];
                        let roomStatsIndex = 0;

                        // Iterate through floor.rooms to maintain proper order and include delays
                        for (let i = 0; i < floor.rooms.length; i++) {
                          const floorRoom = floor.rooms[i];

                          if (floorRoom.isDelay) {
                            // Adjust tightrope delay if needed
                            let delayTicks = floorRoom.delayTicks || 0;
                            if (floorRoom.roomId === 'tightrope' && tightropeDelayAdjustment > 0) {
                              delayTicks = Math.max(0, delayTicks - tightropeDelayAdjustment);
                            }
                            runningTotal += delayTicks;
                            rows.push(
                              <div key={i} style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr',
                                gap: '0.5rem',
                                padding: '0.3rem 0',
                                borderBottom: `1px solid ${chartColors.text}20`,
                                fontStyle: 'italic',
                                color: chartColors.text + '99'
                              }}>
                                <div><strong>{floorRoom.name || 'Delay'}</strong></div>
                                <div style={{ textAlign: 'center' }}>
                                  {showSeconds
                                    ? formatSeconds(delayTicks * 0.6)
                                    : delayTicks.toFixed(1)
                                  }
                                </div>
                                <div style={{ textAlign: 'center', color: chartColors.primary }}>
                                  {showSeconds
                                    ? formatSeconds(runningTotal * 0.6)
                                    : runningTotal.toFixed(1)
                                  }
                                </div>
                              </div>
                            );
                          } else {
                            // This is a combat room
                            const roomStat = combinedRoomAnalysis[activeFloor]!.roomStats![roomStatsIndex];
                            if (roomStat) {
                              runningTotal += roomStat.stats.total_expected_ticks;
                              rows.push(
                                <div key={i} style={{
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 1fr 1fr',
                                  gap: '0.5rem',
                                  padding: '0.3rem 0',
                                  borderBottom: roomStatsIndex < combinedRoomAnalysis[activeFloor]!.roomStats!.length - 1
                                    ? `1px solid ${chartColors.text}20`
                                    : 'none'
                                }}>
                                  <div><strong>{roomStat.name}</strong></div>
                                  <div style={{ textAlign: 'center' }}>
                                    {showSeconds
                                      ? formatSeconds(roomStat.stats.total_expected_seconds)
                                      : roomStat.stats.total_expected_ticks.toFixed(1)
                                    }
                                  </div>
                                  <div style={{ textAlign: 'center', color: chartColors.primary }}>
                                    {showSeconds
                                      ? formatSeconds(runningTotal * 0.6)
                                      : runningTotal.toFixed(1)
                                    }
                                  </div>
                                </div>
                              );
                              roomStatsIndex++;
                            }
                          }
                        }

                        return rows;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default PlotSection;

