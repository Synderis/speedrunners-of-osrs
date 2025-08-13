import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGearFromSupabase, groupGearBySlot } from '../services/gearService';
import { presetsByType, type GearSetType } from '../data/gearTemplates';
import type { GearItem, GearSlot, GearSets, CombatStats } from '../types/gear';
import { defaultSlotImages, statImages } from '../data/constants';
import './GearSelection.css';

interface GearSelectionProps {
  gearSets: GearSets;
  setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
  combatStats: CombatStats;
  setCombatStats: React.Dispatch<React.SetStateAction<CombatStats>>;
  activeGearTab: GearSetType;
  setActiveGearTab: React.Dispatch<React.SetStateAction<GearSetType>>;
}

const GearSelection: React.FC<GearSelectionProps> = ({
  gearSets,
  setGearSets,
  combatStats,
  setCombatStats,
  activeGearTab,
  setActiveGearTab
}) => {
  const [isLoadingGear, setIsLoadingGear] = useState(true);
  const [gearData, setGearData] = useState<Record<string, GearItem[]>>({});

  // Single shared gear slots template
  const createBaseGearSlots = (): GearSlot[] => {
    const slotMapping = {
      'head': 'Head',
      'neck': 'Neck', 
      'cape': 'Cape',
      'shield': 'Shield',
      'body': 'Body',
      'legs': 'Legs',
      'hands': 'Hands',
      'feet': 'Feet',
      'ring': 'Ring',
      'ammo': 'Ammo'
    };

    // Combine weapon and 2h items into a single Weapon slot
    const weaponItems = [
      ...(gearData['weapon'] || []),
      ...(gearData['2h'] || [])
    ];

    const slots = Object.entries(slotMapping).map(([csvSlot, displaySlot]) => ({
      slot: displaySlot,
      items: gearData[csvSlot] || []
    })).filter(slot => slot.items.length > 0);

    // Add weapon slot if there are weapon items
    if (weaponItems.length > 0) {
      slots.unshift({
        slot: 'Weapon',
        items: weaponItems
      });
    }

    return slots;
  };

  const [selectedPresets, setSelectedPresets] = useState({
    melee: '',
    mage: '',
    ranged: ''
  });

  // Load gear data from Supabase on component mount
  useEffect(() => {
    const loadGearData = async () => {
      try {
        setIsLoadingGear(true);
        const gearItems = await fetchGearFromSupabase();
        const groupedGear = groupGearBySlot(gearItems);
        setGearData(groupedGear);
        
        console.log('Loaded gear data:', groupedGear);
      } catch (error) {
        console.error('Failed to load gear data, using empty state:', error);
        setGearData({}); // Set empty data instead of keeping old state
      } finally {
        setIsLoadingGear(false);
      }
    };

    loadGearData();
  }, []); // Remove gearData dependency to avoid infinite loop

  // Update gear sets when gearData changes
  useEffect(() => {
    if (Object.keys(gearData).length > 0) {
      const newGearSlots = createBaseGearSlots();
      setGearSets({
        melee: newGearSlots,
        mage: newGearSlots,
        ranged: newGearSlots
      });
    }
  }, [gearData]);

  const handleGearSelect = (slotIndex: number, item: GearItem) => {
    setGearSets(prev => ({
      ...prev,
      [activeGearTab]: prev[activeGearTab].map((slot, index) => 
        index === slotIndex ? { ...slot, selected: item } : slot
      )
    }));
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresets(prev => ({
      ...prev,
      [activeGearTab]: presetId
    }));

    if (!presetId) return;
    
    const preset = presetsByType[activeGearTab].find(p => p.id === presetId);
    if (!preset) return;

    // Batch the state update to avoid multiple re-renders
    requestAnimationFrame(() => {
      setGearSets(prev => ({
        ...prev,
        [activeGearTab]: prev[activeGearTab].map(slot => {
          const slotKey = slot.slot.toLowerCase().replace('-', '');
          const gearId = preset.gearIds[slotKey];
          
          if (gearId) {
            const selectedItem = slot.items.find(item => item.id === gearId);
            return { ...slot, selected: selectedItem };
          }
          
          return { ...slot, selected: undefined };
        })
      }));
    });
  };

  const clearAllGear = () => {
    setGearSets(prev => ({
      melee: prev.melee.map(slot => ({ ...slot, selected: undefined })),
      mage: prev.mage.map(slot => ({ ...slot, selected: undefined })),
      ranged: prev.ranged.map(slot => ({ ...slot, selected: undefined }))
    }));
    setSelectedPresets({
      melee: '',
      mage: '',
      ranged: ''
    });
  };

  const clearGearType = (gearType: GearSetType) => {
    setGearSets(prev => ({
      ...prev,
      [gearType]: prev[gearType].map(slot => ({ ...slot, selected: undefined }))
    }));
    setSelectedPresets(prev => ({
      ...prev,
      [gearType]: ''
    }));
  };

  const handleStatChange = (stat: keyof typeof combatStats, value: number) => {
    setCombatStats(prev => ({
      ...prev,
      [stat]: Math.max(1, Math.min(99, value))
    }));
  };

  if (isLoadingGear) {
    return (
      <section id="gear" className="section">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading gear data...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="gear" className="section">
      <div className="container">
        <motion.div 
          className="preset-controls"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="preset-dropdown-container">
            <label className="preset-label">Load Preset:</label>
            <select 
              className="preset-dropdown"
              onChange={(e) => handlePresetSelect(e.target.value)}
              value={selectedPresets[activeGearTab]}
            >
              <option value="">Choose a preset...</option>
              {presetsByType[activeGearTab].map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} - {preset.description}
                </option>
              ))}
            </select>
          </div>
          <div className="gear-tabs">
            {(['melee', 'mage', 'ranged'] as GearSetType[]).map(tabType => (
              <button
                key={tabType}
                className={`tab-button ${activeGearTab === tabType ? 'active' : ''}`}
                onClick={() => setActiveGearTab(tabType)}
              >
                {tabType.charAt(0).toUpperCase() + tabType.slice(1)}
              </button>
            ))}
          </div>
          <div className="clear-buttons">
            {(['melee', 'mage', 'ranged'] as GearSetType[]).map(gearType => (
              <button
                key={gearType}
                className={`btn clear-type-btn ${gearType}`}
                onClick={() => clearGearType(gearType)}
              >
                Clear {gearType.charAt(0).toUpperCase() + gearType.slice(1)}
              </button>
            ))}
            <button className="btn clear-type-btn all" onClick={clearAllGear}>
              Clear All
            </button>
          </div>
        </motion.div>

        <motion.div 
          className="stats-bar card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
            <h3>Combat Stats</h3>
            <div className="stats-list">
              {Object.entries(combatStats).map(([stat, value]) => (
                <div key={stat} className="stat-row">
                  <img 
                    src={statImages[stat as keyof typeof statImages]}
                    alt={stat}
                    className="stat-icon"
                  />
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={value}
                    onChange={(e) => handleStatChange(stat as keyof typeof combatStats, parseInt(e.target.value) || 1)}
                    className="stat-input"
                  />
                </div>
              ))}
            </div>
          </motion.div>

        <div className="gear-content">
          <motion.div 
            className="gear-slots"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <AnimatePresence mode="popLayout">
              {gearSets[activeGearTab].map((slot, index) => (
                <motion.div 
                  key={`${activeGearTab}-${slot.slot}-${index}`}
                  className="gear-slot card" 
                  data-slot={slot.slot.toLowerCase().replace('-', '')}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  layout
                  whileHover={{ 
                    y: -4,
                    transition: { duration: 0.2 }
                  }}
                >
                  <label className="gear-label">{slot.slot}</label>
                  <select 
                    className="gear-dropdown"
                    onChange={(e) => {
                      if (e.target.value === '') {
                        // Clear the selection when default option is chosen
                        setGearSets(prev => ({
                          ...prev,
                          [activeGearTab]: prev[activeGearTab].map((slot, idx) => 
                            idx === index ? { ...slot, selected: undefined } : slot
                          )
                        }));
                      } else {
                        const selectedItem = slot.items.find(item => item.id === e.target.value);
                        if (selectedItem) handleGearSelect(index, selectedItem);
                      }
                    }}
                    value={slot.selected?.id || ''}
                  >
                    <option value="">Select {slot.slot}</option>
                    {slot.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.div 
            className="character-models"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {(['melee', 'mage', 'ranged'] as GearSetType[]).map((gearType, index) => (
              <motion.div 
                key={gearType} 
                className="character-model card"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                whileHover={{ 
                  y: -6,
                  transition: { duration: 0.2 }
                }}
              >
                <motion.h3 
                  style={{
                    background: activeGearTab === gearType 
                      ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                      : 'none',
                    WebkitBackgroundClip: activeGearTab === gearType ? 'text' : 'unset',
                    WebkitTextFillColor: activeGearTab === gearType ? 'transparent' : 'var(--text-primary)',
                    backgroundClip: activeGearTab === gearType ? 'text' : 'unset'
                  }}
                  animate={{
                    scale: activeGearTab === gearType ? 1.05 : 1
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {gearType.charAt(0).toUpperCase() + gearType.slice(1)} Setup
                </motion.h3>
                <div className="model-container">
                  <div className="character-silhouette">
                    <AnimatePresence>
                      {gearSets[gearType].map((slot, slotIndex) => {
                        const slotKey = slot.slot.toLowerCase().replace('-', '') as keyof typeof defaultSlotImages;
                        const defaultImage = defaultSlotImages[slotKey];
                        
                        return (
                          <div 
                            key={`${gearType}-${slot.slot}-${slotIndex}`}
                            className={`equipped-${slotKey}`}
                          >
                            <img 
                              src={slot.selected?.image || defaultImage}
                              alt={slot.selected?.name || `Empty ${slot.slot}`}
                              className="equipped-item"
                            />
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default GearSelection;