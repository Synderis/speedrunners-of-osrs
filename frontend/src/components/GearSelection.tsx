import GearModelCard from './GearModelCard';
import Select from 'react-select';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gearSetPresets, type GearSetType, type GearSetPreset } from '../data/gearTemplates';
import type { Equipment, InventoryItem } from '../types/player';
import { statImages } from '../data/constants';
import './GearSelection.css';
import InventoryItems from './InventoryItems';
import type { SelectedRoomWithMonster } from './RoomSelection';
import { rooms } from '../data/monsterStats';
import { useAppContext } from '../context/AppContext';

interface GearSelectionProps {
  setIsGearLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isGearLoading: boolean;
  equipment: Equipment[];
}

const GearSelection: React.FC<GearSelectionProps> = ({
  setIsGearLoading,
  isGearLoading,
  equipment,
}) => {
  // Get all the state from context instead of props
  const {
    gearSets, setGearSets,
    selectedInventoryItems, setSelectedInventoryItems,
    combatStats, setCombatStats,
    selectedPreset, setSelectedPreset,
    selectedRooms, setSelectedRooms,
    selectedMethods, setSelectedMethods,
    roomSpecs, setRoomSpecs
  } = useAppContext();

  // Use equipment as the source of gear data
  const [gearData, setGearData] = useState<Equipment[]>([]);
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
  // Modal-driven save current gearSets as a new custom preset
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showSaveModal) {
      // slight timeout to ensure modal is in DOM
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [showSaveModal]);

  const handleSavePreset = () => {
    setNewPresetName('');
    setNewPresetDescription('');
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    const name = newPresetName.trim();
    if (!name) return; // require a name
    const description = newPresetDescription.trim();

    // Build the rooms array with methods and specs
    const rooms = selectedRooms.map(room => ({
      id: room.id,
      methods: selectedMethods[room.id] || [],
      specs: roomSpecs[room.id] ? Object.entries(roomSpecs[room.id]).map(([weapon, count]) => ({ weapon, count })) : undefined
    }));

    const newPreset: GearSetPreset = {
      id: `custom_${Date.now()}`,
      name,
      description,
      gearSets: {
        melee: Object.fromEntries(gearSets.melee.map(slot => [slot.slot.toLowerCase().replace('-', ''), slot.selected?.id?.toString() || ''])) as Record<string, string>,
        mage: Object.fromEntries(gearSets.mage.map(slot => [slot.slot.toLowerCase().replace('-', ''), slot.selected?.id?.toString() || ''])) as Record<string, string>,
        ranged: Object.fromEntries(gearSets.ranged.map(slot => [slot.slot.toLowerCase().replace('-', ''), slot.selected?.id?.toString() || ''])) as Record<string, string>,
      },
      inventoryItems: selectedInventoryItems.map(item => item.equipment?.id?.toString() || ''),
      combatStats: { ...combatStats },
      rooms,
      roomSpecs
    };
    console.log('Saving new preset:', newPreset);
    const custom = allPresets.filter(p => p.id.startsWith('custom_')).concat(newPreset);
    saveCustomPresets(custom);
    // Apply the newly created preset immediately so rooms/methods/specs are set
    restorePreset(newPreset);
    setShowSaveModal(false);
  };

  const handleCancelSave = () => setShowSaveModal(false);

  // Delete a custom preset (modal-driven)
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const openDeleteModal = () => {
    if (!selectedPreset || !selectedPreset.startsWith('custom_')) return;
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedPreset) {
      setShowDeleteModal(false);
      return;
    }
    const custom = allPresets.filter(p => p.id.startsWith('custom_') && p.id !== selectedPreset);
    saveCustomPresets(custom);
    setSelectedPreset('');
    setShowDeleteModal(false);
  };

  const handleCancelDelete = () => setShowDeleteModal(false);

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
    setSelectedInventoryItems([]); // Clear inventory items
    setSelectedPreset('');
  };

  // Handle stat input changes
  const handleStatChange = (stat: keyof typeof combatStats, value: number) => {
    setCombatStats(prev => ({
      ...prev,
      [stat]: Math.max(1, Math.min(99, value))
    }));
  };

  // Controlled menu open state for react-select
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);

  const handlePresetSelect = (presetId: string) => {
    if (!presetId) {
      setSelectedPreset('');
      setPresetMenuOpen(false);
      return;
    }
    const preset = allPresets.find(p => p.id === presetId);
    if (!preset) return;
    restorePreset(preset);
  };

  // Helper to apply a preset object (used both when selecting and after saving)
  const restorePreset = (preset: GearSetPreset) => {
    setSelectedPreset(preset.id);
    setPresetMenuOpen(false);
    requestAnimationFrame(() => {
      setGearSets(prev => {
        const updated = { ...prev };
        // restore inventory
        setSelectedInventoryItems(
          (preset.inventoryItems || [])
            .map(id => {
              const eq = gearData.find(e => e.id.toString() === id);
              return eq ? { name: eq.name, equipment: eq } : null;
            })
            .filter(Boolean) as InventoryItem[]
        );

        // restore rooms and methods
        if (preset.rooms) {
          const presetRooms = preset.rooms
            .map(r => {
              const roomObj = rooms.find(room => room.id === r.id);
              if (!roomObj) return null;
              return {
                ...roomObj,
                monster: undefined,
                methods: r.method ? [r.method] : roomObj.methods
              };
            })
            .filter(Boolean);
          setSelectedRooms(presetRooms as SelectedRoomWithMonster[]);
          const newSelectedMethods: { [roomId: string]: string[] } = {};
          preset.rooms.forEach(r => {
            if (r.methods) {
              newSelectedMethods[r.id] = r.methods;
            } else if (r.method) {
              newSelectedMethods[r.id] = [r.method];
            } else {
              newSelectedMethods[r.id] = [];
            }
          });
          setSelectedMethods(newSelectedMethods);

          if (preset.roomSpecs) {
            setRoomSpecs(preset.roomSpecs);
          } else {
            const restoredRoomSpecs: { [roomId: string]: { [weaponName: string]: number } } = {};
            preset.rooms.forEach(r => {
              if (r.specs && Array.isArray(r.specs)) {
                const specsObj: { [weaponName: string]: number } = {};
                r.specs.forEach(spec => {
                  specsObj[spec.weapon] = spec.count;
                });
                restoredRoomSpecs[r.id] = specsObj;
              }
            });
            setRoomSpecs(restoredRoomSpecs);
          }
        }

        // restore combat stats
        if (preset.combatStats) {
          setCombatStats(prev => ({
            ...prev,
            ...preset.combatStats
          }));
        }

        // restore gear selections for each gear type
        (['melee', 'mage', 'ranged'] as GearSetType[]).forEach(type => {
          updated[type] = prev[type].map(slot => {
            const slotKey = slot.slot.toLowerCase().replace('-', '');
            const gearId = preset.gearSets[type][slotKey];
            if (gearId) {
              const selectedItem = slot.items.find(item => item.id.toString() === gearId);
              return { ...slot, selected: selectedItem };
            } else {
              return { ...slot, selected: undefined };
            }
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
                <Select
                  classNamePrefix="preset-dropdown"
                  options={allPresets.map(preset => ({
                    value: preset.id,
                    label: `${preset.name} - ${preset.description}${preset.id.startsWith('custom_') ? ' (Custom)' : ''}`,
                    preset
                  }))}
                  value={allPresets
                    .filter(p => p.id === selectedPreset)
                    .map(p => ({
                      value: p.id,
                      label: `${p.name} - ${p.description}${p.id.startsWith('custom_') ? ' (Custom)' : ''}`,
                      preset: p
                    }))}
                  onChange={option => {
                    if (option && option.value) handlePresetSelect(option.value);
                  }}
                  onMenuOpen={() => setPresetMenuOpen(true)}
                  onMenuClose={() => setPresetMenuOpen(false)}
                  menuIsOpen={presetMenuOpen}
                  placeholder="Choose a preset..."
                  isSearchable={false}
                  styles={{
                    menu: base => ({ ...base, zIndex: 9999 }),
                    control: base => ({ ...base, minHeight: 38 }),
                  }}
                  components={{
                    Option: (props) => {
                      const { data, innerProps, isFocused, isSelected } = props;
                      return (
                        <div
                          {...innerProps}
                          className={`preset-dropdown__option${isFocused ? ' preset-dropdown__option--is-focused' : ''}${isSelected ? ' preset-dropdown__option--is-selected' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <span>{data.label}</span>
                        </div>
                      );
                    }
                  }}
                />
                <button className="btn save-preset-btn" onClick={handleSavePreset} style={{ marginLeft: 8 }}>
                  Save Preset
                </button>
                <button
                  className="btn delete-preset-btn"
                  onClick={openDeleteModal}
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
                    className={`btn type-btn ${gearType}`}
                    onClick={() => clearGearType(gearType)}
                  >
                    Clear {gearType.charAt(0).toUpperCase() + gearType.slice(1)}
                  </button>
                ))}
                <button className="btn type-btn all" onClick={clearAllGear}>
                  Clear All
                </button>
              </div>
            </motion.div>

            {showSaveModal && (
              <div className="modal-overlay">
                <div className="modal">
                  <div className="modal__header">
                    <h4>Save Preset</h4>
                  </div>
                  <div className="modal__body">
                    <label className="modal__label">Name</label>
                    <input
                      ref={nameInputRef}
                      className="modal__input"
                      value={newPresetName}
                      onChange={e => setNewPresetName(e.target.value)}
                      placeholder="Preset name"
                    />
                    <label className="modal__label">Description (optional)</label>
                    <textarea
                      className="modal__textarea"
                      value={newPresetDescription}
                      onChange={e => setNewPresetDescription(e.target.value)}
                      placeholder="Short description"
                    />
                  </div>
                  <div className="modal__footer">
                    <button className="btn type-btn save" onClick={handleConfirmSave}>Save</button>
                    <button className="btn type-btn cancel" onClick={handleCancelSave}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {showDeleteModal && (
              <div className="modal-overlay">
                <div className="modal">
                  <div className="modal__header">
                    <h4>Delete Preset</h4>
                  </div>
                  <div className="modal__body">
                    <p>Are you sure you want to delete this preset?</p>
                    <p style={{ fontWeight: 600, marginTop: 8 }}>{allPresets.find(p => p.id === selectedPreset)?.name || ''}</p>
                  </div>
                  <div className="modal__footer">
                    <button className="btn type-btn delete" onClick={handleConfirmDelete}>Delete</button>
                    <button className="btn type-btn default" onClick={handleCancelDelete}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

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
                      gearData={gearData}
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