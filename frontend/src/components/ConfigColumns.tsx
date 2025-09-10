import React from 'react';
import { miscIcons } from '../data/constants';

const defaultIcon = '/gear/default.webp';

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


interface ConfigSection {
    key: string;
    title: string;
    data: Record<string, Record<string, any>>;
}

interface ConfigColumnsProps {
    configSections: ConfigSection[];
}

const ConfigColumns: React.FC<ConfigColumnsProps> = ({ configSections }) => (
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
);

export default ConfigColumns;