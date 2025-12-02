use rand::rngs::mock::StepRng;
use cm_cox::simulate_vespula;
use osrs_shared_types::*;
use std::fs;

#[test]
fn test_vespula_deterministic_hits() {
    // Load player from JSON
    let player_json = fs::read_to_string("tests/test_payload_player.json").expect("player json");
    let player_val: serde_json::Value = serde_json::from_str(&player_json).unwrap();
    let player: Player = serde_json::from_value(player_val["player"].clone()).unwrap();

    // Load room from JSON
    let rooms_json = fs::read_to_string("tests/test_payload_rooms.json").expect("rooms json");
    let rooms_val: serde_json::Value = serde_json::from_str(&rooms_json).unwrap();
    let room: Room = serde_json::from_value(rooms_val["vespula"]["room"].clone()).unwrap();

    // Load config from player JSON (if present)
    let config: DPSConfig = serde_json::from_value(player_val["config"].clone()).unwrap_or(DPSConfig { cap: 1.0 });

    let payload = DPSRoomPayload {
        player,
        room,
        config,
    };

    // Load hardcoded hits from JSON
    let hits_json = fs::read_to_string("tests/hardcoded_hits.json").expect("hits json");
    let hits_val: serde_json::Value = serde_json::from_str(&hits_json).unwrap();
    let vespula_hits: Vec<i32> = serde_json::from_value(hits_val["vespula_hits"].clone()).unwrap();
    let mut hits_iter = vespula_hits.into_iter();
    // Use a dummy StepRng for tick alignment (always returns 0)
    let mut dummy_rng = StepRng::new(0, 0);
    let result_json = simulate_vespula(
        &payload,
        |_max_hit| hits_iter.next().expect("not enough hits"),
        &mut dummy_rng,
        1,
        true,
    );
    assert!(result_json.contains("\"total_expected_ticks\":98.0"));
}
