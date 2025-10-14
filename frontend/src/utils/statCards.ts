import { getMonstersByRoom } from './helpers';

export function createStatCards(
    activeRoom: any,
    selectedMonsterIdx: number,
    activeStats: any,
    showSeconds: boolean,
    formatSeconds: (seconds: number) => string
) {
    return [
        {
            title: 'Combat Type',
            value: (() => {
                if (!activeRoom) return '--';
                const monsters = getMonstersByRoom(activeRoom);
                const monster = monsters[selectedMonsterIdx];
                const perMonsterArr = activeStats.result || [];
                const perMonster = monster
                    ? perMonsterArr.find((pm: any) => String(pm.monster_id) === String(monster.id))
                    : null;
                return perMonster ? `${perMonster.combat_type}` : '--';
            })()
        },
        {
            title: 'Attack Style',
            value: (() => {
                if (!activeRoom) return '--';
                const monsters = getMonstersByRoom(activeRoom);
                const monster = monsters[selectedMonsterIdx];
                const perMonsterArr = activeStats.result || [];
                const perMonster = monster
                    ? perMonsterArr.find((pm: any) => String(pm.monster_id) === String(monster.id))
                    : null;
                return perMonster ? `${perMonster.attack_style}` : '--';
            })()
        },
        {
            title: 'Avg Phase Count',
            value: (() => {
                const phaseResults = activeStats.phase_results || [];
                if (!phaseResults.length) return null;
                const avg = phaseResults.reduce((sum: number, val: number) => sum + val, 0) / phaseResults.length;
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
                const onePhaseCount = phaseResults.filter((val: number) => val <= 1).length;
                if (phaseResults.filter((val: number) => val > 0).length === 0) return null;
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
                const avg = phaseTimeResults.reduce((sum: number, val: number) => sum + val, 0) / phaseTimeResults.length;
                if (showSeconds) {
                    return formatSeconds(avg * 0.6);
                } else {
                    return avg.toFixed(1);
                }
            })(),
            unit: showSeconds ? 'min:sec' : 'ticks'
        },
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
}