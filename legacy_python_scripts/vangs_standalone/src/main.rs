#![allow(warnings)]
mod vangs;
mod vespula_replay;
mod guardians_replay;
mod osrs_shared_types;
mod osrs_shared_functions;

use std::fs;
use std::env;

fn main() {
    // let args: Vec<String> = env::args().collect();
    // if args.len() < 2 {
    //     eprintln!("Usage: {} <input_json>", args[0]);
    //     std::process::exit(1);
    // }
    let input_path = "/home/synderis/Documents/github_repos/speedrunners-of-osrs/legacy_python_scripts/vangs_standalone/src/input.json";
    let json = fs::read_to_string(input_path).expect("Failed to read input JSON");
    // let result = vangs::calculate_dps_with_objects_vangs(&json);
    // let damage_values = vec![47,0,0,29,34,2,25,0,55,10,30,33,9,43,34,30,0,50,50,14,0,53,0,53,0,34,26,30,11,65];
    // println!("Damage values length: {}", damage_values.len());
    // println!("damage to time mapping: {}", damage_values.len() as f64 * 5.0);
    // let damage_values = vec![16,8,16,25,15,58,1,16,11,34,47,1,29,0,57,4,46,26,25,33,16,33,19,59,0,11,26,1,57,32,43];
    
    // println!("damage to time mapping: {}", damage_values.len() as f64 * 5.0);
    // let damage_values = vec![56,13,56,39,53,21,31,53,23,9,31,57,10,0,50,25,31,2,0,8,39,19,23,21,47,1,0,4,50];
    // println!("Damage values length: {}", damage_values.len());
    let damage_values = vec![1,46,14,0,29,0,30,0,51,26,9,35,32,29,58,0,42,11,42,11,53,11,51,46,61,26,12,60];
    println!("Damage values length: {}", damage_values.len());
    let hit_flags: Vec<bool> = damage_values.iter().map(|&dmg| dmg != 0).collect();
    let result = guardians_replay::simulate_guardians_with_damage(&json, &damage_values, Some(&hit_flags));
    println!("{}", result);
}
