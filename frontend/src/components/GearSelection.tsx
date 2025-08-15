import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGearFromSupabase, groupGearBySlot } from '../services/gearService';
import { presetsByType, type GearSetType } from '../data/gearTemplates';
import type { GearItem, GearSlot, GearSets, CombatStats } from '../types/gear';
import { defaultSlotImages, statImages } from '../data/constants';
import './GearSelection.css';
import InventoryItems from './InventoryItems';

interface GearSelectionProps {
  gearSets: GearSets;
  setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
  combatStats: CombatStats;
  setCombatStats: React.Dispatch<React.SetStateAction<CombatStats>>;
  activeGearTab: GearSetType;
  setActiveGearTab: React.Dispatch<React.SetStateAction<GearSetType>>;
  setIsGearLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isGearLoading: boolean;
}

const GearSelection: React.FC<GearSelectionProps> = ({
  gearSets,
  setGearSets,
  combatStats,
  setCombatStats,
  activeGearTab,
  setActiveGearTab,
  setIsGearLoading,
  isGearLoading
}) => {
  const [gearData, setGearData] = useState<Record<string, GearItem[]>>({});
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Helper to generate a unique inputId for each select
  const getInputId = (index: number) => `gear-dropdown-input-${index}`;

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

    const weaponItems = [
      ...(gearData['weapon'] || []),
      ...(gearData['2h'] || [])
    ];

    const slots = Object.entries(slotMapping).map(([csvSlot, displaySlot]) => ({
      slot: displaySlot,
      items: gearData[csvSlot] || []
    })).filter(slot => slot.items.length > 0);

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

  useEffect(() => {
    const loadGearData = async () => {
      try {
        setIsGearLoading(true);
        const gearItems = await fetchGearFromSupabase();
        const groupedGear = groupGearBySlot(gearItems);
        setGearData(groupedGear);
        console.log('Loaded gear data:', groupedGear);
      } catch (error) {
        console.error('Failed to load gear data, using empty state:', error);
        setGearData({});
      } finally {
        setIsGearLoading(false);
      }
    };

    loadGearData();
  }, []);

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

  // Robust outside click handler for react-select with custom trigger
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const menus = Array.from(document.querySelectorAll('.gear-dropdown__menu'));
      const controls = Array.from(document.querySelectorAll('.gear-dropdown__control'));
      const clickedInMenu = menus.some(menuEl => menuEl.contains(event.target as Node));
      const clickedInControl = controls.some(controlEl => controlEl.contains(event.target as Node));
      if (
        openMenuIndex !== null &&
        !clickedInMenu &&
        !clickedInControl
      ) {
        setOpenMenuIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuIndex]);

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
                  {gearSets[activeGearTab].map((slot, index) => {
                    type GearOption = { value: string; label: string; item?: GearItem };
                    const searchInput = inputValues[index] || '';
                    const options: GearOption[] = [
                      ...(searchInput ? [{ value: '__search__', label: searchInput }] : []),
                      { value: '', label: 'Clear item' },
                      ...slot.items.map(item => ({
                        value: item.id,
                        label: item.name,
                        item
                      }))
                    ];
                    const selectedValue: GearOption | null = slot.selected
                      ? { value: slot.selected.id, label: slot.selected.name, item: slot.selected }
                      : null;
                    const selectedItem = slot.selected;
                    const slotKey = slot.slot.toLowerCase().replace('-', '') as keyof typeof defaultSlotImages;
                    const defaultImage = defaultSlotImages[slotKey];

                    return (
                      <motion.div
                        key={index}
                        className={`gear-slot card${openMenuIndex === index ? ' gear-slot--active' : ''}`}
                        ref={el => (slotRefs.current[index] = el)}
                      >
                        <label className="gear-label">{slot.slot}</label>
                        {/* Image as dropdown trigger */}
                        <div
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                          onClick={() => {
                            setOpenMenuIndex(index);
                            setTimeout(() => {
                              const input = document.getElementById(getInputId(index)) as HTMLInputElement | null;
                              if (input) input.focus();
                            }, 0);
                          }}
                        >
                          <img
                            src={selectedItem?.image || defaultImage}
                            alt={selectedItem?.name || `Empty ${slot.slot}`}
                            className="equipped-item"
                          />
                        </div>
                        {/* Hidden Select, only dropdown menu is shown */}
                        <Select
                          inputId={getInputId(index)}
                          classNamePrefix="gear-dropdown"
                          className="gear-dropdown"
                          options={options}
                          value={selectedValue}
                          menuIsOpen={openMenuIndex === index}
                          onChange={option => {
                            const opt = option as GearOption | null;
                            setOpenMenuIndex(null); // Close after selection
                            if (!opt || !opt.item) {
                              setGearSets(prev => ({
                                ...prev,
                                [activeGearTab]: prev[activeGearTab].map((slot, idx) =>
                                  idx === index ? { ...slot, selected: undefined } : slot
                                )
                              }));
                            } else {
                              handleGearSelect(index, opt.item);
                            }
                          }}
                          onInputChange={(value, { action }) => {
                            if (action === 'input-change') {
                              setInputValues(prev => ({ ...prev, [index]: value }));
                            }
                          }}
                          inputValue={inputValues[index] || ''}
                          formatOptionLabel={option => (
                            option && option.item ? (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <img src={option.item.image} alt={option.label} style={{ width: 24, height: 24, marginRight: 8 }} />
                                {option.label}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>{option.label}</span>
                            )
                          )}
                          styles={{
                            menuPortal: base => ({ ...base, zIndex: 9999 }),
                            menu: base => ({ ...base, zIndex: 9999 })
                          }}
                          filterOption={(option, inputValue) => {
                            // Always show "Clear item"
                            if (option.data.value === '') return true;
                            // For all other options, use default filtering
                            if (!inputValue) return true;
                            return option.label.toLowerCase().includes(inputValue.toLowerCase());
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
              <div className="character-models-container">
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
                        className={activeGearTab === gearType ? 'gear-tab-gradient' : ''}
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