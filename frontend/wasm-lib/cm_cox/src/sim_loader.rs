mod ice_demon;
mod tekton;
mod guardians;
mod vespula;
mod mutta;
mod mystics;
mod olm;
mod shamans;
mod thieving;
mod vangs;
mod vasa;
// ...add other rooms as needed

pub use ice_demon::calculate_dps_with_objects_ice_demon;
pub use tekton::calculate_dps_with_objects_tekton;
pub use guardians::calculate_dps_with_objects_guardians;
pub use mutta::calculate_dps_with_objects_mutta;
pub use vespula::calculate_dps_with_objects_vespula;
pub use mystics::calculate_dps_with_objects_mystics;
pub use olm::calculate_dps_with_objects_olm;
pub use shamans::calculate_dps_with_objects_shamans;
pub use thieving::calculate_dps_with_objects_thieving;
pub use vangs::calculate_dps_with_objects_vangs;
pub use vasa::calculate_dps_with_objects_vasa;
// ...add other pub uses as needed