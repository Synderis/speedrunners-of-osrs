use wasm_bindgen::prelude::*;

/// Multiply a 1xN row vector by an NxN matrix (both row-major).
fn row_vec_times_square_mat(row: &[f64], mat: &[f64], n: usize) -> Vec<f64> {
    let mut out = vec![0.0; n];
    // out[j] = sum_i row[i] * mat[i,j]
    for i in 0..n {
        let r = row[i];
        if r == 0.0 { continue; }
        let row_start = i * n;
        for j in 0..n {
            out[j] += r * mat[row_start + j];
        }
    }
    out
}

/// Build transition matrix for a single-hit weapon:
/// accuracy=a, max hit=m, hp.
/// Returns row-major (hp+1) x (hp+1).
fn single_matrix_internal(a: f64, m: usize, hp: usize) -> Vec<f64> {
    let n = hp + 1;
    let mut mat = vec![0.0f64; n * n];

    for i in 0..n {
        let row_start = i * n;

        for j in 0..n {
            // Diagonal: stay in same state on miss (except absorbing last column)
            if j == i && j != hp {
                mat[row_start + j] = 1.0 - a;
            }
            // Past diagonal up to i+m: uniform damage distribution (except absorbing col)
            if j > i && j <= i + m && j != hp {
                mat[row_start + j] = a / (m as f64);
            }
        }

        // Final column j=hp gets the remaining probability mass, making rows sum to 1.
        let mut sum = 0.0;
        for j in 0..n {
            sum += mat[row_start + j];
        }
        mat[row_start + (n - 1)] = 1.0 - sum;
    }

    mat
}

fn npc_state_internal(hp: usize) -> Vec<f64> {
    let mut v = vec![0.0f64; hp + 1];
    v[0] = 1.0;
    v
}

/// Apply transition matrix `no_hits` times.
fn hitting_basic_npc_internal(hp: usize, max_hit: usize, acc: f64, no_hits: usize) -> Vec<f64> {
    let n = hp + 1;
    let t = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);
    for _ in 0..no_hits {
        state = row_vec_times_square_mat(&state, &t, n);
    }
    state
}

/// Distribution of P(dead) by number of hits, until cap is reached.
/// Returns a Vec of cumulative death probabilities per hit index (0-based: after i hits).
fn distribution_of_hits_to_kill_internal(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    let n = hp + 1;
    let t = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);

    let mut out = Vec::with_capacity(128);
    let mut p_dead = state[n - 1];
    out.push(p_dead);

    while p_dead < cap {
        state = row_vec_times_square_mat(&state, &t, n);
        p_dead = state[n - 1];
        out.push(p_dead);
    }

    out
}

/// Thrall matrix: accuracy 0.75, max hit 3
fn thrall_matrix_internal(hp: usize) -> Vec<f64> {
    single_matrix_internal(0.75, 3, hp)
}

/// Weapon+Thrall tick simulation:
/// - weapon hits every 5th tick, starting at tick 1 (ticks: 1,6,11,...)
/// - thrall hits every 4th tick, starting at tick 2 (ticks: 2,6,10,...)
/// Returns cumulative P(dead) per tick, until cap hit.
fn weapon_and_thrall_kill_times_internal(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    let n = hp + 1;
    let weapon = single_matrix_internal(acc, max_hit, hp);
    let thrall = thrall_matrix_internal(hp);
    let mut state = npc_state_internal(hp);

    let mut out = Vec::with_capacity(512);
    let mut p_dead = state[n - 1];
    let mut tick: usize = 0;

    while p_dead < cap {
        tick += 1;

        // weapon on ticks 1,6,11,... => tick % 5 == 1
        if tick % 5 == 1 {
            state = row_vec_times_square_mat(&state, &weapon, n);
        }
        // thrall on ticks 2,6,10,... => tick % 4 == 2
        if tick % 4 == 2 {
            state = row_vec_times_square_mat(&state, &thrall, n);
        }

        p_dead = state[n - 1];
        out.push(p_dead);
    }
    out
}

#[wasm_bindgen]
pub fn single_matrix(a: f64, m: usize, hp: usize) -> Vec<f64> {
    single_matrix_internal(a, m, hp)
}

#[wasm_bindgen]
pub fn npc_state(hp: usize) -> Vec<f64> {
    npc_state_internal(hp)
}

#[wasm_bindgen]
pub fn hitting_basic_npc(hp: usize, max_hit: usize, acc: f64, no_hits: usize) -> Vec<f64> {
    hitting_basic_npc_internal(hp, max_hit, acc, no_hits)
}

#[wasm_bindgen]
pub fn distribution_of_hits_to_kill(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    distribution_of_hits_to_kill_internal(hp, max_hit, acc, cap)
}

#[wasm_bindgen]
pub fn weapon_and_thrall_kill_times(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    weapon_and_thrall_kill_times_internal(hp, max_hit, acc, cap)
}
