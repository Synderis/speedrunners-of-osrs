import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { fadeInOut } from '../utils/animations';
import type { PlotDataPoint } from '../types/loaders';
import type { Monster, Room } from '../data/monsterStats';
import { calculateDPSWithObjectsTekton } from '../loaders/tektonWasm';
import { calculateDPSWithObjectsVasa } from '../loaders/vasaWasm';
import { calculateDPSWithObjectsVespula } from '../loaders/vespulaWasm';
import { calculateDPSWithObjectsMystics } from '../loaders/mysticsWasm';
import { useTheme } from '../hooks/useTheme';
import type { GearSets, CombatStats, Equipment, InventoryItem } from '../types/player';
import './PlotSection.css';
import { getCombatStylesForCategory } from '../services/weaponStylesService';
import { calculateDPSWithObjectsGuardians } from '../loaders/guardiansWasm';
import { cmMonsters } from '../data/monsterStats';
import { calculateDPSWithObjectsShamans } from '../loaders/shamansWasm';
import { calculateDPSWithObjectsMutta } from '../loaders/muttaWasm';
import { calculateDPSWithObjectsVangs } from '../loaders/vangsWasm';
import ResultPlot from './ResultPlot';
import ConfigColumns from './ConfigColumns';
import { calculateDPSWithObjectsOlm } from '../loaders/olmWasm';
import { calculateDPSWithObjectsIceDemon } from '../loaders/iceDemonWasm';



// --- Constants & Types ---
const GEAR_TYPES = ['melee', 'mage', 'ranged'] as const;

// Floor configuration for raid structure
interface FloorRoom {
  roomId: string;
  name: string;
  isDelay?: boolean;
  delayTicks?: number;
}

interface Floor {
  id: string;
  name: string;
  rooms: FloorRoom[];
}

const RAID_FLOORS: Floor[] = [
  {
    id: 'floor1',
    name: 'Floor 1',
    rooms: [
      { roomId: 'tekton', name: 'Tekton' },
      { roomId: 'crabs_delay', name: 'Crabs', isDelay: true, delayTicks: 89 },
      { roomId: 'ice_demon', name: 'Ice Demon' },
      { roomId: 'lizardman_shamans', name: 'Shamans' },
      { roomId: 'post_shamans_delay', name: 'Post Shamans', isDelay: true, delayTicks: 36 }
    ]
  },
  {
    id: 'floor2',
    name: 'Floor 2',
    rooms: [
      { roomId: 'vangs', name: 'Vanguards' },
      { roomId: 'thieving', name: 'Thieving', isDelay: true, delayTicks: 89 }, // Not implemented yet
      { roomId: 'vespula', name: 'Vespula' },
      { roomId: 'tightrope', name: 'Tightrope', isDelay: true, delayTicks: 77 },
      { roomId: 'post_tightrope_delay', name: 'Post Tightrope', isDelay: true, delayTicks: 18 }
    ]
  },
  {
    id: 'floor3',
    name: 'Floor 3',
    rooms: [
      { roomId: 'guardians', name: 'Guardians' },
      { roomId: 'vasa', name: 'Vasa' },
      { roomId: 'mystics', name: 'Mystics' },
      { roomId: 'muttadile', name: 'Muttadile' },
      { roomId: 'post_mutta_delay', name: 'Post Muttadile', isDelay: true, delayTicks: 40 }
    ]
  }
];

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
  selectedMethods?: { [roomId: string]: string | null };
}

type Stats = {
  total_hits: number;
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
  'vespula': calculateDPSWithObjectsVespula,
  'mystics': calculateDPSWithObjectsMystics,
  'lizardman_shamans': calculateDPSWithObjectsShamans,
  'muttadile': calculateDPSWithObjectsMutta,
  "olm": calculateDPSWithObjectsOlm,
  "vangs": calculateDPSWithObjectsVangs,
  "ice_demon": calculateDPSWithObjectsIceDemon
};

// Add this after the existing helper functions (around line 90)
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
      console.log(`Validating ${name} data:`, {
        length: data.length,
        sample: data.slice(0, 3),
        types: data.slice(0, 3).map(p => ({
          time: typeof p.time,
          dps: typeof p.dps,
          timeValue: p.time,
          dpsValue: p.dps
        }))
      });
      
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
      console.log(`${name} data validation passed`);
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
      
      console.log(`Converting to PMF for maxTime ${maxTime}, data length: ${data.length}`);
      console.log(`Data sample - first 5:`, data.slice(0, 5));
      console.log(`Data sample - middle 5:`, data.slice(Math.floor(data.length/2) - 2, Math.floor(data.length/2) + 3));
      console.log(`Data sample - last 5:`, data.slice(-5));
      
      let totalMassAdded = 0;
      let nonZeroCount = 0;
      
      for (let i = 0; i < data.length - 1; i++) {
        const currentProb = data[i].dps;
        const nextProb = data[i + 1]?.dps || 0;
        // For increasing CDF, probability mass is nextProb - currentProb
        const probMass = Math.max(0, nextProb - currentProb);
        const timeIndex = Math.floor(data[i].time);
        
        // Log a few examples
        if (i < 5 || i > data.length - 6 || (i > data.length/2 - 3 && i < data.length/2 + 3)) {
          console.log(`PMF conversion i=${i}: currentProb=${currentProb}, nextProb=${nextProb}, probMass=${probMass}, timeIndex=${timeIndex}`);
        }
        
        if (timeIndex >= 0 && timeIndex < pmf.length && probMass > 0 && isFinite(probMass)) {
          pmf[timeIndex] = probMass;
          totalMassAdded += probMass;
          nonZeroCount++;
        }
      }
      
      console.log(`PMF conversion result: totalMass=${totalMassAdded}, nonZeroCount=${nonZeroCount}, pmfLength=${pmf.length}`);
      console.log(`PMF sample (first 100):`, pmf.slice(0, 10));
      console.log(`PMF sample (last 10):`, pmf.slice(-10));
      
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

    // Convert back to cumulative distribution
    const combinedData: PlotDataPoint[] = [];
    let cumulativeProb = 0;
    
    console.log('Converting PMF back to CDF, combinedPMF length:', combinedPMF.length);
    console.log('CombinedPMF sample (first 10):', combinedPMF.slice(0, 10));
    console.log('CombinedPMF sample (last 10):', combinedPMF.slice(-10));
    
    // For increasing CDF, we build from left to right (time 0 to max)
    for (let t = 0; t < combinedPMF.length; t++) {
      if (isFinite(combinedPMF[t])) {
        cumulativeProb += combinedPMF[t];
      }
      
      // Always add a data point for every time tick
      combinedData.push({
        time: t,
        dps: Math.min(1, Math.max(0, cumulativeProb)), // Ensure probability is between 0 and 1
        accuracy: 0
      });
    }
    
    console.log('Final combined data:', {
      length: combinedData.length,
      first5: combinedData.slice(0, 5),
      last5: combinedData.slice(-5),
      maxDps: Math.max(...combinedData.map(d => d.dps)),
      minDps: Math.min(...combinedData.map(d => d.dps))
    });
    
    // console.log('Final combined data:', {
    //   length: combinedData.length,
    //   sample: combinedData.slice(0, 5),
    //   lastSample: combinedData.slice(-5)
    // });

    if (!combinedData.length) {
      console.error('No combined data generated');
      return [];
    }

    console.log(`Generated ${combinedData.length} combined data points`);
    return combinedData;
  } catch (error) {
    console.error('Error calculating combined distribution:', error);
    return [];
  }
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
  selectedInventoryItems = [],
  selectedMethods = {}
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
  const [combinedPlotKey, setCombinedPlotKey] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [activeFloor, setActiveFloor] = useState<string>(''); // New state for active floor tab
  const combinedChartRef = useRef(null);

  // --- Default Stats (needed for combined room analysis) ---
  const defaultStats: Stats = {
    total_hits: 0,
    phase_time_results: [],
    phase_results: [],
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

  // Force combined plot re-render when data changes
  useEffect(() => {
    if (selectedRooms.length >= 2 && Object.keys(plotDataDict).length >= 2) {
      setCombinedPlotKey(prev => prev + 1);
    }
  }, [plotDataDict, statsDict, selectedRooms, activeFloor]);

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
              .map(slot => slot.selected)
              .filter((item): item is Equipment => Boolean(item))
          };
          return acc;
        }, {} as any),
        inventory: inventoryWithStyles
      };
      console.log('Player Data for WASM:', playerData);

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
        // Always create a shallow copy of the room with the correct methods array
        const selectedMethod = selectedMethods && selectedMethods[room.id];
        let filteredMethods = room.methods;
        if (selectedMethod && typeof selectedMethod === 'string' && Array.isArray(room.methods)) {
          filteredMethods = room.methods.filter(m => m === selectedMethod);
        }
        const roomPayload = { ...room, methods: filteredMethods, monsters };
        console.log('Sending to WASM:', { room: roomPayload, monsters });
        const result = await loader(playerData, roomPayload);
        const key = String(room.id || 'default');
        console.log(`WASM result for room ${room.name} (${key}):`, result, result.perMonster);
        plotDataUpdates[key] = result.tickData;
        statsUpdates[key] = {
          total_hits: result.summary.expectedHits,
          total_expected_ticks: result.summary.ticksTimeToKill,
          result: result.perMonster,
          phase_time_results: result.summary.phaseTimeResults || [],
          phase_results: result.summary.phaseResults || [],
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

  // Combined floor analysis - now returns all available floors
  const availableFloors = useMemo(() => {
    console.log('Checking available floors. Selected rooms:', selectedRooms.length);
    
    if (selectedRooms.length < 2) {
      console.log('Not enough rooms selected for floor analysis');
      return [];
    }
    
    // Find which floors can be analyzed based on selected rooms
    const floors = RAID_FLOORS.filter(floor => {
      // Check if we have data for the combat rooms in this floor
      const combatRooms = floor.rooms.filter(room => !room.isDelay);
      const hasAllRoomsSelected = combatRooms.every(room => 
        selectedRooms.some(selectedRoom => selectedRoom.id === room.roomId)
      );
      const hasAllRoomsData = combatRooms.every(room => 
        plotDataDict[room.roomId] && statsDict[room.roomId]
      );
      
      console.log(`Floor ${floor.name}:`, {
        combatRooms: combatRooms.map(r => r.name),
        combatRoomIds: combatRooms.map(r => r.roomId),
        selectedRoomIds: selectedRooms.map(r => r.id),
        hasAllRoomsSelected,
        hasAllRoomsData,
        plotDataKeys: Object.keys(plotDataDict),
        statsKeys: Object.keys(statsDict)
      });
      
      return hasAllRoomsSelected && hasAllRoomsData;
    });

    console.log('Available floors for analysis:', floors.map(f => f.name));
    console.log('Total available floors count:', floors.length);
    return floors;
  }, [selectedRooms, plotDataDict, statsDict]);

  // Set default active floor when available floors change
  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.some(f => f.id === activeFloor)) {
      setActiveFloor(availableFloors[0].id);
    } else if (availableFloors.length === 0) {
      setActiveFloor('');
    }
  }, [availableFloors, activeFloor]);

  // Update combined plot key when floor changes
  useEffect(() => {
    if (availableFloors.length > 0) {
      setCombinedPlotKey(prev => prev + 1);
    }
  }, [activeFloor, availableFloors]);

  // Combined room analysis for the active floor
  const combinedRoomAnalysis = useMemo(() => {
    console.log('Combined room analysis for active floor:', activeFloor);
    
    if (!activeFloor || availableFloors.length === 0) {
      console.log('No active floor selected or no available floors');
      return null;
    }
    
    const floorToAnalyze = availableFloors.find(f => f.id === activeFloor);
    if (!floorToAnalyze) {
      console.log('Active floor not found in available floors');
      return null;
    }
    
    try {
      console.log('Analyzing floor:', floorToAnalyze.name);

      // Calculate the combined distribution for this floor
      let combinedPlotData: PlotDataPoint[] = [];
      let totalExpectedTime = 0;
      const roomStats: Array<{ name: string; stats: Stats }> = [];

      // Process each room in the floor sequence
      let pendingDelay = 0; // Track delay to be applied to the next room
      
      for (let i = 0; i < floorToAnalyze.rooms.length; i++) {
        const room = floorToAnalyze.rooms[i];
        
        if (room.isDelay) {
          // Accumulate delay time to be applied to the next combat room
          pendingDelay += room.delayTicks || 0;
          totalExpectedTime += room.delayTicks || 0;
          console.log(`Added delay from ${room.name}: ${room.delayTicks} ticks (pending delay: ${pendingDelay})`);
        } else {
          // This is a combat room
          const roomData = plotDataDict[room.roomId];
          const roomStatsData = statsDict[room.roomId];
          
          if (!roomData || !roomStatsData) {
            console.warn(`Missing data for room ${room.name}`);
            continue;
          }

          roomStats.push({
            name: room.name,
            stats: roomStatsData
          });
          
          totalExpectedTime += roomStatsData.total_expected_ticks || 0;

          // Combine distributions
          if (combinedPlotData.length === 0) {
            // First combat room - just copy the data (no previous distribution to combine with)
            combinedPlotData = [...roomData];
            console.log(`Started with ${room.name} data: ${combinedPlotData.length} points`);
          } else {
            // Convolve with previous combined data using pending delay
            console.log(`Combining ${room.name} with pending delay ${pendingDelay}`);
            combinedPlotData = calculateCombinedDistribution(combinedPlotData, roomData, pendingDelay);
            
            if (combinedPlotData.length === 0) {
              console.error(`Failed to combine distribution for ${room.name}`);
              return null;
            }
            console.log(`Combined with ${room.name}: ${combinedPlotData.length} points`);
          }
          
          // Reset pending delay after applying it
          pendingDelay = 0;
        }
      }

      // Handle any remaining delay at the end (like post_shamans_delay, post_mutta_delay, etc.)
      if (pendingDelay > 0) {
        console.log(`Applying final delay: ${pendingDelay} ticks`);
        // Shift the entire distribution by the final delay
        combinedPlotData = combinedPlotData.map(point => ({
          ...point,
          time: point.time + pendingDelay
        }));
        console.log(`Applied final delay, new data length: ${combinedPlotData.length}`);
      }

      if (combinedPlotData.length === 0) {
        console.log('No combined plot data generated');
        return null;
      }

      const result = {
        plotData: combinedPlotData,
        expectedTime: totalExpectedTime,
        floorName: floorToAnalyze.name,
        roomStats: roomStats,
        floorId: floorToAnalyze.id
      };
      
      console.log('Floor analysis result:', {
        plotDataLength: result.plotData.length,
        expectedTime: result.expectedTime,
        floorName: result.floorName,
        roomCount: result.roomStats.length
      });
      
      return result;
    } catch (error) {
      console.error('Error in floor analysis:', error);
      return null;
    }
  }, [activeFloor, availableFloors, plotDataDict, statsDict, defaultStats]);

  // Transform combined plot data for seconds/ticks
  const combinedPlotDataToShow: PlotDataPoint[] = useMemo(() => {
    if (!combinedRoomAnalysis?.plotData?.length) return [];
    
    try {
      const result = showSeconds
        ? combinedRoomAnalysis.plotData.map(d => ({ 
            ...d, 
            time: d.time * 0.6 
          }))
        : combinedRoomAnalysis.plotData;
      
      // Force re-render by adding timestamp to ensure React detects changes
      console.log('Combined plot data transformed at:', Date.now(), 'length:', result.length);
      return result;
    } catch (error) {
      console.error('Error transforming combined plot data:', error);
      return [];
    }
  }, [combinedRoomAnalysis, showSeconds, selectedRooms, plotDataDict, statsDict]);

  // --- Debug & Controls ---
  const handleRecalculate = () => {
    loadData();
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statCards = [
    { title: 'Combat Type', value: (() => {
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
      })() },
    { title: 'Attack Style', value: (() => {
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
      })() },
    
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
            ? formatSeconds(activeStats.total_expected_ticks * 0.6)
            : activeStats.total_expected_ticks.toFixed(1))
        : '--',
      unit: showSeconds ? 'min:sec' : 'ticks' 
    },
  ].filter(stat => stat.value !== null);

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
              className="config-toggle-btn"
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
          expectedTTK={showSeconds ? (activeStats.total_expected_ticks * 0.6).toFixed(1) : activeStats.total_expected_ticks.toFixed(1)}
        />

        {/* NEW COMBINED ROOMS PLOT SECTION - NOW FLOOR BASED */}
        {(() => {
          const hasBasicRequirements = selectedRooms.length >= 2 && 
                                      Object.keys(plotDataDict).length >= 2;
          
          const shouldShow = availableFloors.length > 0 && 
                            combinedRoomAnalysis && 
                            combinedRoomAnalysis.plotData && 
                            combinedRoomAnalysis.plotData.length > 0 && 
                            combinedPlotDataToShow.length > 0;
          
          console.log('Combined plot render check:', {
            hasBasicRequirements,
            availableFloorsLength: availableFloors.length,
            combinedRoomAnalysisExists: !!combinedRoomAnalysis,
            hasPlotData: !!combinedRoomAnalysis?.plotData,
            plotDataLength: combinedRoomAnalysis?.plotData?.length || 0,
            combinedPlotDataToShowLength: combinedPlotDataToShow.length,
            activeFloor,
            shouldShow,
            selectedRoomsCount: selectedRooms.length,
            plotDataDictKeys: Object.keys(plotDataDict),
            statsDictKeys: Object.keys(statsDict)
          });
          
          // For debugging, show if we have basic requirements even if floor analysis fails
          return hasBasicRequirements && (shouldShow || availableFloors.length > 0);
        })() && (
          <div
            className="combined-plot-section"
            style={{ 
              marginTop: '3rem', 
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
              {combinedRoomAnalysis?.floorName} Analysis
            </h3>

            {/* Combined Stats Card */}
            <div
              className="combined-stats"
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginBottom: '2rem',
                opacity: 1
              }}
            >
              <div
                className="stat-card card combined-stat-card"
                style={{ 
                  minWidth: '400px',
                  textAlign: 'center',
                  background: `linear-gradient(135deg, ${chartColors.primary}20, ${chartColors.secondary}20)`,
                  opacity: 1
                }}
              >
                <h3>Total Expected {combinedRoomAnalysis?.floorName} Time</h3>
                <p
                  className="stat-value"
                  style={{ fontSize: '2rem', color: chartColors.primary, opacity: 1 }}
                >
                  {combinedRoomAnalysis && (showSeconds 
                    ? formatSeconds(combinedRoomAnalysis.expectedTime * 0.6)
                    : combinedRoomAnalysis.expectedTime.toFixed(1)
                  )}
                </p>
                <span className="stat-unit">
                  {showSeconds ? 'min:sec' : 'ticks'} (including delays)
                </span>
                <div style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.9rem', 
                  color: chartColors.text + '80'
                }}>
                  {combinedRoomAnalysis?.roomStats.map((room, index) => (
                    <div key={index}>
                      {room.name}: {showSeconds 
                        ? formatSeconds(room.stats.total_expected_ticks * 0.6)
                        : room.stats.total_expected_ticks.toFixed(1)
                      } {showSeconds ? 'min:sec' : 'ticks'}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Combined Plot */}
            <ResultPlot
              key={`combined-plot-${combinedPlotKey}`}
              chartRef={combinedChartRef}
              chartInView={true} // Force to true for debugging
              isLoading={false}
              handleRecalculate={() => {}} // No separate recalculate for combined plot
              showSeconds={showSeconds}
              setShowSeconds={setShowSeconds}
              chartType={chartType}
              setChartType={setChartType}
              plotDataToShow={combinedPlotDataToShow || []}
              chartColors={{...chartColors, primary: chartColors.secondary}} // Use secondary color for distinction
              theme={theme}
              formatSeconds={formatSeconds}
              fadeInOut={fadeInOut}
              expectedTTK={combinedRoomAnalysis ? (showSeconds 
                ? (combinedRoomAnalysis.expectedTime * 0.6).toFixed(1) 
                : combinedRoomAnalysis.expectedTime.toFixed(1)
              ) : '0'}
            />
          </div>
        )}
        </div>
      </div>
    </motion.section>
  );
};

export default PlotSection;

