import React, { useState, useEffect } from 'react';
import './GearSelection.css';

interface GearItem {
  id: string;
  name: string;
  image: string;
}

interface GearSlot {
  slot: string;
  items: GearItem[];
  selected?: GearItem;
}

interface GearPreset {
  id: string;
  name: string;
  description: string;
  gearIds: Record<string, string>;
}

type GearSetType = 'melee' | 'mage' | 'ranged';

const GearSelection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GearSetType>('melee');

  // Single shared gear slots template
  const createBaseGearSlots = (): GearSlot[] => [
    {
      slot: 'Weapon',
      items: [
        { id: 'abyssal_whip', name: 'Abyssal Whip', image: '/gear/130px-Abyssal_whip_detail.webp' },
        { id: 'dragon_scimitar', name: 'Dragon Scimitar', image: '/gear/130px-Dragon_scimitar_detail.webp' },
        { id: 'granite_maul', name: 'Granite Maul', image: '/gear/130px-Granite_maul_detail.webp' }
      ]
    },
    {
      slot: 'Offhand',
      items: [
        { id: 'dragon_defender', name: 'Dragon Defender', image: '/gear/150px-Dragon_defender_detail.webp' },
        { id: 'rune_kiteshield', name: 'Rune Kiteshield', image: '/gear/150px-Rune_kiteshield_detail.webp' }
      ]
    },
    {
      slot: 'Helmet',
      items: [
        { id: 'berserker_helm', name: 'Berserker Helm', image: '/gear/150px-Berserker_helm_detail.webp' },
        { id: 'rune_full_helm', name: 'Rune Full Helm', image: '/gear/120px-Rune_full_helm_detail.webp' }
      ]
    },
    {
      slot: 'Cape',
      items: [
        { id: 'fire_cape', name: 'Fire Cape', image: '/gear/150px-Fire_cape_detail.webp' },
        { id: 'obsidian_cape', name: 'Obsidian Cape', image: '/gear/150px-Obsidian_cape_detail.webp' },
        { id: 'legends_cape', name: 'Legends Cape', image: '/gear/150px-Legends_cape_detail.webp' }
      ]
    },
    {
      slot: 'Neck',
      items: [
        { id: 'amulet_of_fury', name: 'Amulet of Fury', image: '/gear/130px-Amulet_of_fury_detail.webp' },
        { id: 'amulet_of_glory', name: 'Amulet of Glory', image: '/gear/130px-Amulet_of_glory_detail.webp' },
        { id: 'amulet_of_strength', name: 'Amulet of Strength', image: '/gear/130px-Amulet_of_strength_detail.webp' }
      ]
    },
    {
      slot: 'Ammo',
      items: [
        { id: 'dragon_arrows', name: 'Dragon Arrows', image: '/gear/120px-Dragon_arrow_detail.webp' },
        { id: 'rune_arrows', name: 'Rune Arrows', image: '/gear/130px-Rune_arrows_detail.webp' },
        { id: 'adamant_arrows', name: 'Adamant Arrows', image: '/gear/130px-Adamant_arrows_detail.webp' }
      ]
    },
    {
      slot: 'Body',
      items: [
        { id: 'fighter_torso', name: 'Fighter Torso', image: '/gear/130px-Fighter_torso_detail.webp' },
        { id: 'rune_platebody', name: 'Rune Platebody', image: '/gear/130px-Rune_platebody_detail.webp' }
      ]
    },
    {
      slot: 'Legs',
      items: [
        { id: 'dragon_platelegs', name: 'Dragon Platelegs', image: '/gear/90px-Dragon_platelegs_detail.webp' },
        { id: 'rune_platelegs', name: 'Rune Platelegs', image: 'https://via.placeholder.com/64x64/6b7280/ffffff?text=RPL' },
        { id: 'obsidian_platelegs', name: 'Obsidian Platelegs', image: 'https://via.placeholder.com/64x64/3b82f6/ffffff?text=OPL' }
      ]
    },
    {
      slot: 'Gloves',
      items: [
        { id: 'barrows_gloves', name: 'Barrows Gloves', image: '/gear/150px-Barrows_gloves_detail.webp' },
        { id: 'dragon_gloves', name: 'Dragon Gloves', image: '/gear/150px-Dragon_gloves_detail.webp' },
        { id: 'rune_gloves', name: 'Rune Gloves', image: '/gear/150px-Rune_gloves_detail.webp' }
      ]
    },
    {
      slot: 'Boots',
      items: [
        { id: 'dragon_boots', name: 'Dragon Boots', image: '/gear/150px-Dragon_boots_detail.webp' },
        { id: 'rune_boots', name: 'Rune Boots', image: '/gear/150px-Rune_boots_detail.webp' },
        { id: 'climbing_boots', name: 'Climbing Boots', image: '/gear/150px-Climbing_boots_detail.webp' }
      ]
    },
    {
      slot: 'Ring',
      items: [
        { id: 'berserker_ring', name: 'Berserker Ring', image: '/gear/150px-Berserker_ring_detail.webp' },
        { id: 'warrior_ring', name: 'Warrior Ring', image: '/gear/150px-Warrior_ring_detail.webp' },
        { id: 'ring_of_wealth', name: 'Ring of Wealth', image: '/gear/150px-Ring_of_wealth_detail.webp' }
      ]
    }
  ];

  const [gearSets, setGearSets] = useState({
    melee: createBaseGearSlots(),
    mage: createBaseGearSlots(),
    ranged: createBaseGearSlots()
  });

  const [presetsByType] = useState<Record<GearSetType, GearPreset[]>>({
    melee: [
      {
        id: 'strength_training',
        name: 'Strength Training',
        description: 'Optimal setup for strength training',
        gearIds: {
          weapon: 'abyssal_whip',
          offhand: 'dragon_defender',
          helmet: 'berserker_helm',
          cape: 'fire_cape',
          neck: 'amulet_of_fury',
          ammo: 'dragon_arrows',
          body: 'fighter_torso',
          legs: 'dragon_platelegs',
          gloves: 'barrows_gloves',
          boots: 'dragon_boots',
          ring: 'berserker_ring'
        }
      },
      {
        id: 'budget_melee',
        name: 'Budget Melee',
        description: 'Affordable melee setup',
        gearIds: {
          weapon: 'dragon_scimitar',
          offhand: 'rune_kiteshield',
          helmet: 'rune_full_helm',
          cape: 'legends_cape',
          neck: 'amulet_of_strength',
          body: 'rune_platebody',
          legs: 'rune_platelegs',
          gloves: 'rune_gloves',
          boots: 'rune_boots',
          ring: 'ring_of_wealth'
        }
      },
      {
        id: 'obsidian_setup',
        name: 'Obsidian Tank',
        description: 'High defence obsidian setup',
        gearIds: {
          weapon: 'granite_maul',
          helmet: 'berserker_helm',
          cape: 'obsidian_cape',
          neck: 'amulet_of_glory',
          legs: 'obsidian_platelegs',
          gloves: 'dragon_gloves',
          boots: 'climbing_boots',
          ring: 'warrior_ring'
        }
      }
    ],
    mage: [
      {
        id: 'magic_training',
        name: 'Magic Training',
        description: 'Optimal setup for magic training',
        gearIds: {
          weapon: 'abyssal_whip',
          offhand: 'dragon_defender',
          helmet: 'berserker_helm',
          cape: 'fire_cape',
          neck: 'amulet_of_fury',
          ammo: 'dragon_arrows',
          body: 'fighter_torso',
          legs: 'dragon_platelegs',
          gloves: 'barrows_gloves',
          boots: 'dragon_boots',
          ring: 'berserker_ring'
        }
      },
      {
        id: 'budget_magic',
        name: 'Budget Magic',
        description: 'Affordable magic setup',
        gearIds: {
          weapon: 'dragon_scimitar',
          offhand: 'rune_kiteshield',
          helmet: 'rune_full_helm',
          cape: 'legends_cape',
          neck: 'amulet_of_strength',
          body: 'rune_platebody',
          legs: 'rune_platelegs',
          gloves: 'rune_gloves',
          boots: 'rune_boots',
          ring: 'ring_of_wealth'
        }
      },
      {
        id: 'obsidian_setup',
        name: 'Obsidian Tank',
        description: 'High defence obsidian setup',
        gearIds: {
          weapon: 'granite_maul',
          helmet: 'berserker_helm',
          cape: 'obsidian_cape',
          neck: 'amulet_of_glory',
          legs: 'obsidian_platelegs',
          gloves: 'dragon_gloves',
          boots: 'climbing_boots',
          ring: 'warrior_ring'
        }
      }
    ],
    ranged: [
      {
        id: 'ranged_training',
        name: 'Ranged Training',
        description: 'Optimal setup for ranged training',
        gearIds: {
          weapon: 'abyssal_whip',
          offhand: 'dragon_defender',
          helmet: 'berserker_helm',
          cape: 'fire_cape',
          neck: 'amulet_of_fury',
          ammo: 'dragon_arrows',
          body: 'fighter_torso',
          legs: 'dragon_platelegs',
          gloves: 'barrows_gloves',
          boots: 'dragon_boots',
          ring: 'berserker_ring'
        }
      },
      {
        id: 'budget_ranged',
        name: 'Budget Ranged',
        description: 'Affordable ranged setup',
        gearIds: {
          weapon: 'dragon_scimitar',
          offhand: 'rune_kiteshield',
          helmet: 'rune_full_helm',
          cape: 'legends_cape',
          neck: 'amulet_of_strength',
          body: 'rune_platebody',
          legs: 'rune_platelegs',
          gloves: 'rune_gloves',
          boots: 'rune_boots',
          ring: 'ring_of_wealth'
        }
      },
      {
        id: 'obsidian_setup',
        name: 'Obsidian Tank',
        description: 'High defence obsidian setup',
        gearIds: {
          weapon: 'granite_maul',
          helmet: 'berserker_helm',
          cape: 'obsidian_cape',
          neck: 'amulet_of_glory',
          legs: 'obsidian_platelegs',
          gloves: 'dragon_gloves',
          boots: 'climbing_boots',
          ring: 'warrior_ring'
        }
      }
    ]
  });

  const defaultSlotImages = {
    weapon: '/gear/weapon.webp',
    offhand: '/gear/offhand.webp', 
    helmet: '/gear/helmet.webp',
    cape: '/gear/cape.webp',
    neck: '/gear/neck.webp',
    ammo: '/gear/ammo.webp',
    body: '/gear/body.webp',
    legs: '/gear/legs.webp',
    gloves: '/gear/gloves.webp',
    boots: '/gear/boots.webp',
    ring: '/gear/ring.webp'
  };

  const [combatStats, setCombatStats] = useState({
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
  });

  const statImages = {
    attack: '/gear/attack.webp',
    strength: '/gear/strength.webp',
    defense: '/gear/defence.webp',
    ranged: '/gear/ranged.webp',
    hitpoints: '/gear/hitpoints.webp',
    magic: '/gear/magic.webp',
    prayer: '/gear/prayer.webp',
    mining: '/gear/mining.webp',
    woodcutting: '/gear/woodcutting.webp',
    thieving: '/gear/thieving.webp'
  };

  const [selectedPresets, setSelectedPresets] = useState({
    melee: '',
    mage: '',
    ranged: ''
  });

  const handleGearSelect = (slotIndex: number, item: GearItem) => {
    setGearSets(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map((slot, index) => 
        index === slotIndex ? { ...slot, selected: item } : slot
      )
    }));
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresets(prev => ({
      ...prev,
      [activeTab]: presetId
    }));

    if (!presetId) return;
    
    const preset = presetsByType[activeTab].find(p => p.id === presetId);
    if (!preset) return;

    // Batch the state update to avoid multiple re-renders
    requestAnimationFrame(() => {
      setGearSets(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(slot => {
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

  useEffect(() => {
    // Simple fade-in without intersection observer to avoid performance issues
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('.gear-slot, .preset-controls, .stats-bar, .character-model');
      elements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.add('fade-in');
        }, index * 50);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section id="gear" className="section">
      <div className="container">
        <div className="preset-controls">
          <div className="preset-dropdown-container">
            <label className="preset-label">Load Preset:</label>
            <select 
              className="preset-dropdown"
              onChange={(e) => handlePresetSelect(e.target.value)}
              value={selectedPresets[activeTab]}
            >
              <option value="">Choose a preset...</option>
              {presetsByType[activeTab].map(preset => (
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
                className={`tab-button ${activeTab === tabType ? 'active' : ''}`}
                onClick={() => setActiveTab(tabType)}
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
        </div>

        <div className="stats-bar card">
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
          </div>

        <div className="gear-content">
          <div className="gear-slots">
            {gearSets[activeTab].map((slot, index) => (
              <div 
                key={slot.slot} 
                className="gear-slot card" 
                data-slot={slot.slot.toLowerCase().replace('-', '')}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <label className="gear-label">{slot.slot}</label>
                <select 
                  className="gear-dropdown"
                  onChange={(e) => {
                    if (e.target.value === '') {
                      // Clear the selection when default option is chosen
                      setGearSets(prev => ({
                        ...prev,
                        [activeTab]: prev[activeTab].map((slot, idx) => 
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
              </div>
            ))}
          </div>

          <div className="character-models">
            {(['melee', 'mage', 'ranged'] as GearSetType[]).map((gearType, index) => (
              <div 
                key={gearType} 
                className="character-model card"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <h3 
                  style={{
                    background: activeTab === gearType 
                      ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                      : 'none',
                    WebkitBackgroundClip: activeTab === gearType ? 'text' : 'unset',
                    WebkitTextFillColor: activeTab === gearType ? 'transparent' : 'var(--text-primary)',
                    backgroundClip: activeTab === gearType ? 'text' : 'unset'
                  }}
                >
                  {gearType.charAt(0).toUpperCase() + gearType.slice(1)} Setup
                </h3>
                <div className="model-container">
                  <div className="character-silhouette">
                    {gearSets[gearType].map(slot => {
                      const slotKey = slot.slot.toLowerCase().replace('-', '') as keyof typeof defaultSlotImages;
                      const defaultImage = defaultSlotImages[slotKey];
                      
                      return (
                        <div key={slot.slot} className={`equipped-${slotKey}`}>
                          <img 
                            src={slot.selected?.image || defaultImage}
                            alt={slot.selected?.name || `Empty ${slot.slot}`}
                            className="equipped-item"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GearSelection;