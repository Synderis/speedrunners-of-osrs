import React from 'react';
import './GearSlotMultiSelect.css';
import Select from 'react-select';
import { FixedSizeList as List } from 'react-window';
import type { MultiValue, ActionMeta } from 'react-select';
import type { Equipment, GearSets, GearSetType } from '../types/equipment';

interface GearSlotMultiSelectProps {
    gearType: GearSetType;
    gearData: Equipment[];
    setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
}

// Virtualized MenuList for react-select
const MenuList = (props: any) => {
    const { children, maxHeight } = props;
    const height = 40; // px per option
    const itemCount = children.length;
    const listHeight = Math.min(maxHeight, itemCount * height);
    return (
        <List
            height={listHeight}
            itemCount={itemCount}
            itemSize={height}
            width="100%"
            style={{ zIndex: 9999 }}
        >
            {({ index, style }: { index: number; style: React.CSSProperties }) => (
                <div style={style}>
                    {children[index]}
                </div>
            )}
        </List>
    );
};

export const GearSlotMultiSelect: React.FC<GearSlotMultiSelectProps> = ({ gearType, gearData, setGearSets }) => {
    const [inputValue, setInputValue] = React.useState('');
    const [menuIsOpen, setMenuIsOpen] = React.useState(false);


    const slotOrder = [
        'Weapon', 'Head', 'Neck', 'Cape', 'Shield', 'Body', 'Legs', 'Hands', 'Feet', 'Ring', 'Ammo'
    ];

    // Build options: filter by input, group by slot
    const filteredOptions = slotOrder.flatMap(slotName => {
        const items = gearData.filter(item =>
            item.slot && item.slot.toLowerCase() === slotName.toLowerCase() &&
            item.name.toLowerCase().includes(inputValue.toLowerCase())
        );
        if (!items.length) return [];
        return items.map(item => ({
            value: item.id,
            label: item.name,
            slot: slotName,
            item
        }));
    });

    // When user selects an item, assign it to the correct slot
    const handleChange = (
        _unused: MultiValue<any>,
        actionMeta: ActionMeta<any>
    ) => {
        const { action, option, removedValue } = actionMeta as any;
        if (action === 'select-option' && option) {
            setGearSets(prev => {
                const updated = { ...prev };
                updated[gearType] = prev[gearType].map(slot =>
                    slot.slot === option.slot ? { ...slot, selected: option.item } : slot
                );
                return updated;
            });

        } else if (action === 'remove-value' && removedValue) {
            setGearSets(prev => {
                const updated = { ...prev };
                updated[gearType] = prev[gearType].map(slot =>
                    slot.slot === removedValue.slot ? { ...slot, selected: undefined } : slot
                );
                return updated;
            });

        } else if (action === 'clear') {
            setGearSets(prev => {
                const updated = { ...prev };
                updated[gearType] = prev[gearType].map(slot => ({ ...slot, selected: undefined }));
                return updated;
            });

        }
    };



    return (
        <Select
            classNamePrefix="gear-dropdown"
            isMulti
            options={filteredOptions}
            value={[]}
            inputValue={inputValue}
            onInputChange={(val, meta) => {
                if (meta.action === 'input-change') setInputValue(val);
            }}
            onChange={handleChange}
            menuIsOpen={menuIsOpen || !!inputValue}
            onMenuOpen={() => setMenuIsOpen(true)}
            onMenuClose={() => {
                setMenuIsOpen(false);
                setInputValue('');
            }}
            placeholder={`Type to search and assign gear to ${gearType}...`}
            closeMenuOnSelect={false}
            blurInputOnSelect={false}
            onBlur={() => {
                setMenuIsOpen(false);
                setInputValue('');
            }}
            styles={{
                menu: base => ({ ...base, zIndex: 9999 }),
                multiValue: base => ({ ...base, background: '#222' }),
                control: base => ({ ...base, minHeight: 48 })
            }}
            noOptionsMessage={() => inputValue ? 'No items found' : 'Type to search...'}
            components={{
                MultiValue: () => null, // Hide selected chips
                MultiValueRemove: () => null, // Hide the x/remove button
                Option: (props) => {
                    const { data, innerProps, isFocused, isSelected } = props;
                    return (
                        <div
                            {...innerProps}
                            className={`gear-dropdown__option${isFocused ? ' gear-dropdown__option--is-focused' : ''}${isSelected ? ' gear-dropdown__option--is-selected' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <img
                                src={`data:image/png;base64,${data.item.image}`}
                                alt={data.item.name}
                                style={{ width: 24, height: 24, objectFit: 'contain', marginRight: 8, borderRadius: 4 }}
                            />
                            <span>{data.label}</span>
                        </div>
                    );
                },
                MenuList
            }}
        />
    );
};
