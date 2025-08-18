import GearModelCard from './GearModelCard';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gearSetPresets, type GearSetType, type GearSetPreset } from '../data/gearTemplates';
import type { GearSets, CombatStats, Equipment, InventoryItem } from '../types/player';
import { statImages } from '../data/constants';
import './GearSelection.css';
import InventoryItems from './InventoryItems';

interface GearSelectionProps {
  gearSets: GearSets;
  setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
  selectedInventoryItems: InventoryItem[];
  setSelectedInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  combatStats: CombatStats;
  setCombatStats: React.Dispatch<React.SetStateAction<CombatStats>>;
  setIsGearLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isGearLoading: boolean;
  equipment: Equipment[];
}

const GearSelection: React.FC<GearSelectionProps> = ({
  gearSets,
  setGearSets,
  selectedInventoryItems,
  setSelectedInventoryItems,
  combatStats,
  setCombatStats,
  setIsGearLoading,
  isGearLoading,
  equipment
}) => {
  // Use equipment as the source of gear data
  const [gearData, setGearData] = useState<Equipment[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [allPresets, setAllPresets] = useState<GearSetPreset[]>([...gearSetPresets]);

  // Load custom presets from localStorage on mount and merge with defaults
  useEffect(() => {
    const stored = localStorage.getItem('customGearSetPresets');
    if (stored) {
      try {
        const custom = JSON.parse(stored);
        setAllPresets([...gearSetPresets, ...custom]);
      } catch {
        setAllPresets([...gearSetPresets]);
      }
    } else {
      setAllPresets([...gearSetPresets]);
    }
  }, []);

  // Save custom presets to localStorage whenever they change
  const saveCustomPresets = (custom: GearSetPreset[]) => {
    localStorage.setItem('customGearSetPresets', JSON.stringify(custom));
    setAllPresets([...gearSetPresets, ...custom]);
  };
  // Save current gearSets as a new custom preset
  const handleSavePreset = () => {
    const name = prompt('Enter a name for your preset:');
    if (!name) return;
    const description = prompt('Enter a description (optional):') || '';
    // Build the preset object
    const newPreset: GearSetPreset = {
      id: `custom_${Date.now()}`,
      name,
      description,
      gearSets: {
        melee: Object.fromEntries(
          gearSets.melee.map(slot => [
            slot.slot.toLowerCase().replace('-', ''),
            slot.selected?.id?.toString() || ''
          ])
        ) as Record<string, string>,
        mage: Object.fromEntries(
          gearSets.mage.map(slot => [
            slot.slot.toLowerCase().replace('-', ''),
            slot.selected?.id?.toString() || ''
          ])
        ) as Record<string, string>,
        ranged: Object.fromEntries(
          gearSets.ranged.map(slot => [
            slot.slot.toLowerCase().replace('-', ''),
            slot.selected?.id?.toString() || ''
          ])
        ) as Record<string, string>,
      },
  inventoryItems: selectedInventoryItems.map(item => item.equipment?.id?.toString() || '')
    };
    console.log('Saving preset:', newPreset);
    const custom = allPresets.filter(p => p.id.startsWith('custom_')).concat(newPreset);
    saveCustomPresets(custom);
    setSelectedPreset(newPreset.id);
  };

  // Delete a custom preset
  const handleDeletePreset = () => {
    if (!selectedPreset || !selectedPreset.startsWith('custom_')) return;
    if (!window.confirm('Delete this custom preset?')) return;
    const custom = allPresets.filter(p => p.id.startsWith('custom_') && p.id !== selectedPreset);
    saveCustomPresets(custom);
    setSelectedPreset('');
  };

  // Replace loading logic: set gearData from equipment prop
  useEffect(() => {
    setGearData(equipment);
    setIsGearLoading(equipment.length === 0);
  }, [equipment, setIsGearLoading]);

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
      const slotMap: Record<string, Equipment[]> = {};
      for (const item of gearData) {
        const slot = item.slot.toLowerCase();
        if (!slotMap[slot]) slotMap[slot] = [];
        slotMap[slot].push(item);
      }
      // Merge weapon and 2h into Weapon slot
      const slots = slotOrder
        .filter(({ display }, idx, arr) => arr.findIndex(s => s.display === display) === idx) // dedupe Weapon
        .map(({ csv, display }) => {
          let items: Equipment[] = [];
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
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return;
    requestAnimationFrame(() => {
      setGearSets(prev => {
        const updated = { ...prev };
          // Reconstruct selectedInventoryItems from preset.inventoryItems (string[] of IDs)
          setSelectedInventoryItems(
            (preset.inventoryItems || [])
              .map(id => {
                // Search all equipment for a match
                const eq = gearData.find(e => e.id.toString() === id);
                return eq ? { name: eq.name, equipment: eq } : null;
              })
              .filter(Boolean) as InventoryItem[]
          );
        (['melee', 'mage', 'ranged'] as GearSetType[]).forEach(type => {
          updated[type] = prev[type].map(slot => {
            const slotKey = slot.slot.toLowerCase().replace('-', '');
            const gearId = preset.gearSets[type][slotKey];
            if (gearId) {
              const selectedItem = slot.items.find(item => item.id.toString() === gearId);
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
                    {allPresets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} - {preset.description}
                        {preset.id.startsWith('custom_') ? ' (Custom)' : ''}
                      </option>
                    ))}
                  </select>
                  <button className="btn save-preset-btn" onClick={handleSavePreset} style={{ marginLeft: 8 }}>
                    Save Preset
                  </button>
                  <button
                    className="btn delete-preset-btn"
                    onClick={handleDeletePreset}
                    style={{ marginLeft: 8 }}
                    disabled={!selectedPreset || !selectedPreset.startsWith('custom_')}
                  >
                    Delete Preset
                  </button>
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
                    {(['melee', 'mage', 'ranged'] as GearSetType[]).map((gearType) => (
                      <GearModelCard
                        key={gearType}
                        gearType={gearType}
                        gearSet={gearSets[gearType]}
                        setGearSets={setGearSets}
                        gearData={gearData} // gearData is now Equipment[]
                      />
                    ))}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 1.15 }}
                  >
                    <InventoryItems 
                      equipment={gearData}
                      selectedItems={selectedInventoryItems}
                      setSelectedItems={setSelectedInventoryItems}
                    />
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