import { GearSlotMultiSelect } from './GearSlotMultiSelect';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGearFromSupabase } from '../services/gearService';
import { gearSetPresets, type GearSetType } from '../data/gearTemplates';
import type { GearItem, GearSets, CombatStats } from '../types/gear';
import { defaultSlotImages, statImages } from '../data/constants';
import './GearSelection.css';
import InventoryItems from './InventoryItems';

interface GearSelectionProps {
  gearSets: GearSets;
  setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
  combatStats: CombatStats;
  setCombatStats: React.Dispatch<React.SetStateAction<CombatStats>>;
  setIsGearLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isGearLoading: boolean;
}

const GearSelection: React.FC<GearSelectionProps> = ({
  gearSets,
  setGearSets,
  combatStats,
  setCombatStats,
  setIsGearLoading,
  isGearLoading
}) => {
  const [gearData, setGearData] = useState<GearItem[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => {
      const loadGearData = async () => {
        try {
          setIsGearLoading(true);
          const gearItems = await fetchGearFromSupabase();
          setGearData(gearItems);
        } catch (error) {
          setGearData([]);
        } finally {
          setIsGearLoading(false);
        }
      };
      loadGearData();
    }, []);

  useEffect(() => {
    if (gearData.length > 0) {
      // Build slots from flat gearData array
      const slotOrder = [
        { csv: 'weapon', display: 'Weapon' },
        { csv: 'head', display: 'Head' },
        { csv: 'neck', display: 'Neck' },
        { csv: 'cape', display: 'Cape' },
        { csv: 'shield', display: 'Shield' },
        { csv: 'body', display: 'Body' },
        { csv: 'legs', display: 'Legs' },
        { csv: 'hands', display: 'Hands' },
        { csv: 'feet', display: 'Feet' },
        { csv: 'ring', display: 'Ring' },
        { csv: 'ammo', display: 'Ammo' },
        { csv: '2h', display: 'Weapon' }, // 2h weapons also go in Weapon slot
      ];
      // Group items by slot field
      const slotMap: Record<string, GearItem[]> = {};
      for (const item of gearData) {
        const slot = item.slot.toLowerCase();
        if (!slotMap[slot]) slotMap[slot] = [];
        slotMap[slot].push(item);
      }
      // Merge weapon and 2h into Weapon slot
      const slots = slotOrder
        .filter(({ display }, idx, arr) => arr.findIndex(s => s.display === display) === idx) // dedupe Weapon
        .map(({ csv, display }) => {
          let items: GearItem[] = [];
          if (display === 'Weapon') {
            items = [ ...(slotMap['weapon'] || []), ...(slotMap['2h'] || []) ];
          } else {
            items = slotMap[csv] || [];
          }
          return { slot: display, items };
        })
        .filter(slot => slot.items.length > 0);
      setGearSets({ melee: slots, mage: slots, ranged: slots });
    }
  }, [gearData]);

  // Clear all gear for a specific gear type
  const clearGearType = (gearType: GearSetType) => {
    setGearSets(prev => ({
      ...prev,
      [gearType]: prev[gearType].map(slot => ({ ...slot, selected: undefined }))
    }));
    setSelectedPreset('');
  };

  // Clear all gear for all gear types
  const clearAllGear = () => {
    setGearSets(prev => ({
      melee: prev.melee.map(slot => ({ ...slot, selected: undefined })),
      mage: prev.mage.map(slot => ({ ...slot, selected: undefined })),
      ranged: prev.ranged.map(slot => ({ ...slot, selected: undefined }))
    }));
    setSelectedPreset('');
  };

  // Handle stat input changes
  const handleStatChange = (stat: keyof typeof combatStats, value: number) => {
    setCombatStats(prev => ({
      ...prev,
      [stat]: Math.max(1, Math.min(99, value))
    }));
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    if (!presetId) return;
    const preset = gearSetPresets.find(p => p.id === presetId);
    if (!preset) return;
    requestAnimationFrame(() => {
      setGearSets(prev => {
        const updated = { ...prev };
        (['melee', 'mage', 'ranged'] as GearSetType[]).forEach(type => {
          updated[type] = prev[type].map(slot => {
            const slotKey = slot.slot.toLowerCase().replace('-', '');
            const gearId = preset.gearSets[type][slotKey];
            if (gearId) {
              const selectedItem = slot.items.find(item => item.id === gearId);
              return { ...slot, selected: selectedItem };
            }
            return { ...slot, selected: undefined };
          });
        });
        return updated;
      });
    });
  };

  return (
      <section id="gear" className="section">
        <div className="container">
          {isGearLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Loading gear data...</p>
            </div>
          ) : (
            <>
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
                    value={selectedPreset}
                  >
                    <option value="">Choose a preset...</option>
                    {gearSetPresets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} - {preset.description}
                      </option>
                    ))}
                  </select>
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
                <div className="character-models-container">
                  <motion.div
                    className="character-models"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                  >
                    {(['melee', 'mage', 'ranged'] as GearSetType[]).map((gearType, modelIndex) => {
                      return (
                        <motion.div
                          key={gearType}
                          className="character-model card"
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.5 + modelIndex * 0.1 }}
                        >
                          <motion.h3
                            transition={{ duration: 0.3 }}
                          >
                            {gearType.charAt(0).toUpperCase() + gearType.slice(1)} Setup
                          </motion.h3>
                          {/* Single dropdown for this gear set */}
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
                                      style={{ position: 'relative', display: 'inline-block' }}
                                    >
                                      <img
                                        src={slot.selected?.image || defaultImage}
                                        alt={slot.selected?.name || `Empty ${slot.slot}`}
                                        className="equipped-item"
                                        style={{ cursor: slot.selected ? 'pointer' : 'default' }}
                                        onClick={() => {
                                          if (slot.selected) {
                                            setGearSets(prev => ({
                                              ...prev,
                                              [gearType]: prev[gearType].map(s =>
                                                s.slot === slot.slot ? { ...s, selected: undefined } : s
                                              )
                                            }));
                                          }
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          </div>
                          <div style={{ marginTop: 16 }}>
                            {/* Multi-slot select dropdown for this gear set */}
                            <GearSlotMultiSelect
                              gearType={gearType}
                              // gearSlots={gearSets[gearType]}
                              gearData={gearData}
                              setGearSets={setGearSets}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 1.15 }}
                  >
                    <InventoryItems />
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    );
  };


export default GearSelection;