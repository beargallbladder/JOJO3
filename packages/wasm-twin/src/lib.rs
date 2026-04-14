use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---- Region definitions matching body-systems.ts ----

const REGIONS: &[&str] = &[
    "heart", "lungs", "liver", "kidneys", "gut", "thyroid", "adrenals",
    "brain", "spine", "upper_body", "lower_body", "joints", "skin",
    "blood", "immune", "reproductive",
];

const ADJACENCY: &[(&str, &str)] = &[
    ("heart", "lungs"), ("heart", "blood"), ("lungs", "blood"),
    ("liver", "gut"), ("liver", "kidneys"), ("liver", "blood"),
    ("kidneys", "adrenals"), ("kidneys", "blood"),
    ("gut", "immune"), ("gut", "liver"),
    ("thyroid", "adrenals"), ("thyroid", "brain"),
    ("adrenals", "kidneys"), ("adrenals", "brain"),
    ("brain", "spine"), ("brain", "immune"),
    ("spine", "upper_body"), ("spine", "lower_body"),
    ("upper_body", "joints"), ("lower_body", "joints"),
    ("joints", "skin"), ("skin", "immune"),
    ("blood", "immune"), ("immune", "gut"),
    ("reproductive", "adrenals"), ("reproductive", "hormonal_proxy"),
];

// ---- Data structures ----

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SignalInput {
    pub region: String,
    pub intensity: f64,    // 0-1, how activated/stressed
    pub recovery: f64,     // 0-1, recovery quality
    pub trend: f64,        // -1 to 1, declining vs improving
    pub data_quality: f64, // 0-1, confidence in data
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegionState {
    pub id: String,
    pub heat: f64,          // 0-1, thermal intensity (stress/activation)
    pub recovery: f64,      // 0-1, recovery level
    pub pulse_rate: f64,    // 0-3, animation pulse speed
    pub glow_intensity: f64,// 0-1, outer glow strength
    pub color: [f64; 4],    // RGBA 0-1
    pub trend_arrow: f64,   // -1 to 1
    pub confidence: f64,    // 0-1, data quality → opacity modifier
    pub label: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TwinFrame {
    pub timestamp: f64,
    pub regions: Vec<RegionState>,
    pub global_recovery: f64,
    pub global_stress: f64,
    pub dominant_system: String,
}

// ---- Color science ----

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t.clamp(0.0, 1.0)
}

fn recovery_color(heat: f64, recovery: f64) -> [f64; 4] {
    // Cool teal (recovered) → warm amber (stressed) → hot coral (critical)
    // Recovery modulates: high recovery pulls toward teal even at moderate heat
    let effective_heat = heat * (1.0 - recovery * 0.4);

    let (r, g, b) = if effective_heat < 0.3 {
        // Teal/green zone — recovered, healthy
        let t = effective_heat / 0.3;
        (
            lerp(0.20, 0.35, t),
            lerp(0.78, 0.72, t),
            lerp(0.70, 0.55, t),
        )
    } else if effective_heat < 0.6 {
        // Amber zone — moderate stress
        let t = (effective_heat - 0.3) / 0.3;
        (
            lerp(0.35, 0.90, t),
            lerp(0.72, 0.65, t),
            lerp(0.55, 0.20, t),
        )
    } else {
        // Coral/red zone — high stress, needs attention
        let t = (effective_heat - 0.6) / 0.4;
        (
            lerp(0.90, 0.95, t),
            lerp(0.65, 0.30, t),
            lerp(0.20, 0.25, t),
        )
    };

    let alpha = lerp(0.45, 1.0, heat.max(0.15));
    [r, g, b, alpha]
}

// ---- Heat diffusion ----

fn diffuse_heat(regions: &mut HashMap<String, (f64, f64)>, iterations: usize) {
    let diffusion_rate = 0.08;

    for _ in 0..iterations {
        let snapshot: HashMap<String, (f64, f64)> = regions.clone();

        for &(a, b) in ADJACENCY.iter() {
            let (heat_a, rec_a) = snapshot.get(a).copied().unwrap_or((0.0, 0.5));
            let (heat_b, rec_b) = snapshot.get(b).copied().unwrap_or((0.0, 0.5));

            let heat_diff = heat_a - heat_b;
            let rec_diff = rec_a - rec_b;

            if let Some(val) = regions.get_mut(a) {
                val.0 -= heat_diff * diffusion_rate;
                val.1 -= rec_diff * diffusion_rate * 0.5;
            }
            if let Some(val) = regions.get_mut(b) {
                val.0 += heat_diff * diffusion_rate;
                val.1 += rec_diff * diffusion_rate * 0.5;
            }
        }

        // Clamp
        for val in regions.values_mut() {
            val.0 = val.0.clamp(0.0, 1.0);
            val.1 = val.1.clamp(0.0, 1.0);
        }
    }
}

// ---- Region labels ----

fn region_label(id: &str) -> &'static str {
    match id {
        "heart" => "Heart",
        "lungs" => "Lungs",
        "liver" => "Liver",
        "kidneys" => "Kidneys",
        "gut" => "Gut",
        "thyroid" => "Thyroid",
        "adrenals" => "Adrenals",
        "brain" => "Brain",
        "spine" => "Spine",
        "upper_body" => "Upper Body",
        "lower_body" => "Lower Body",
        "joints" => "Joints",
        "skin" => "Skin",
        "blood" => "Blood",
        "immune" => "Immune",
        "reproductive" => "Reproductive",
        _ => "Unknown",
    }
}

// ---- Core compute functions ----

#[wasm_bindgen]
pub fn compute_twin_frame(signals_json: &str, time: f64) -> String {
    let signals: Vec<SignalInput> = serde_json::from_str(signals_json).unwrap_or_default();

    // Build region heat/recovery map from signals
    let mut region_map: HashMap<String, (f64, f64)> = HashMap::new();
    let mut region_trends: HashMap<String, f64> = HashMap::new();
    let mut region_confidence: HashMap<String, f64> = HashMap::new();

    // Initialize all regions at baseline
    for &r in REGIONS {
        region_map.insert(r.to_string(), (0.15, 0.7));
        region_trends.insert(r.to_string(), 0.0);
        region_confidence.insert(r.to_string(), 0.2);
    }

    // Apply signal inputs
    for sig in &signals {
        if let Some(val) = region_map.get_mut(&sig.region) {
            val.0 = sig.intensity.clamp(0.0, 1.0);
            val.1 = sig.recovery.clamp(0.0, 1.0);
        }
        region_trends.insert(sig.region.clone(), sig.trend);
        region_confidence.insert(sig.region.clone(), sig.data_quality);
    }

    // Heat diffusion — stress/recovery bleeds between adjacent systems
    diffuse_heat(&mut region_map, 3);

    // Build output frame
    let mut total_heat = 0.0;
    let mut total_recovery = 0.0;
    let mut max_heat: f64 = 0.0;
    let mut dominant = "heart".to_string();

    let regions: Vec<RegionState> = REGIONS.iter().map(|&id| {
        let (heat, recovery) = region_map.get(id).copied().unwrap_or((0.15, 0.7));
        let trend = region_trends.get(id).copied().unwrap_or(0.0);
        let confidence = region_confidence.get(id).copied().unwrap_or(0.2);

        let color = recovery_color(heat, recovery);

        // Pulse rate: stressed regions pulse faster
        let base_pulse = 0.5 + heat * 2.0;
        // Subtle time-based variation so regions don't pulse in sync
        let phase = (id.len() as f64) * 0.7;
        let pulse_rate = base_pulse + (time * 0.001 + phase).sin() * 0.15;

        // Glow: high heat + high confidence = strong glow
        let glow_intensity = (heat * confidence).clamp(0.0, 1.0);

        total_heat += heat;
        total_recovery += recovery;

        if heat > max_heat {
            max_heat = heat;
            dominant = id.to_string();
        }

        RegionState {
            id: id.to_string(),
            heat,
            recovery,
            pulse_rate,
            glow_intensity,
            color,
            trend_arrow: trend,
            confidence,
            label: region_label(id).to_string(),
        }
    }).collect();

    let n = regions.len() as f64;

    let frame = TwinFrame {
        timestamp: time,
        regions,
        global_recovery: total_recovery / n,
        global_stress: total_heat / n,
        dominant_system: dominant,
    };

    serde_json::to_string(&frame).unwrap_or_default()
}

#[wasm_bindgen]
pub fn interpolate_frames(frame_a_json: &str, frame_b_json: &str, t: f64) -> String {
    let frame_a: TwinFrame = match serde_json::from_str(frame_a_json) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };
    let frame_b: TwinFrame = match serde_json::from_str(frame_b_json) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };

    let t = t.clamp(0.0, 1.0);

    let regions: Vec<RegionState> = frame_a.regions.iter().zip(frame_b.regions.iter()).map(|(a, b)| {
        RegionState {
            id: a.id.clone(),
            heat: lerp(a.heat, b.heat, t),
            recovery: lerp(a.recovery, b.recovery, t),
            pulse_rate: lerp(a.pulse_rate, b.pulse_rate, t),
            glow_intensity: lerp(a.glow_intensity, b.glow_intensity, t),
            color: [
                lerp(a.color[0], b.color[0], t),
                lerp(a.color[1], b.color[1], t),
                lerp(a.color[2], b.color[2], t),
                lerp(a.color[3], b.color[3], t),
            ],
            trend_arrow: lerp(a.trend_arrow, b.trend_arrow, t),
            confidence: lerp(a.confidence, b.confidence, t),
            label: a.label.clone(),
        }
    }).collect();

    let n = regions.len() as f64;
    let frame = TwinFrame {
        timestamp: lerp(frame_a.timestamp, frame_b.timestamp, t),
        regions,
        global_recovery: lerp(frame_a.global_recovery, frame_b.global_recovery, t),
        global_stress: lerp(frame_a.global_stress, frame_b.global_stress, t),
        dominant_system: if t < 0.5 { frame_a.dominant_system.clone() } else { frame_b.dominant_system.clone() },
    };

    serde_json::to_string(&frame).unwrap_or_default()
}

/// Protocol response curve: 0 before onset, ramp to 1 at peak, plateau after
fn response_curve(weeks_on: f64, onset: f64, peak: f64) -> f64 {
    if weeks_on < onset { return 0.0; }
    if weeks_on >= peak { return 1.0; }
    let progress = (weeks_on - onset) / (peak - onset);
    // Smooth ease-in-out
    progress * progress * (3.0 - 2.0 * progress)
}

/// Compute protocol-projected twin frame showing expected therapeutic trajectory
#[wasm_bindgen]
pub fn compute_protocol_projection(
    current_snapshot_json: &str,
    protocols_json: &str,
    cohort_curve_json: &str,
    projection_weeks: f64,
    time: f64,
) -> String {
    #[derive(Deserialize)]
    struct CurrentSnap {
        p_score: Option<f64>,
        p_var: Option<f64>,
        c_score: Option<f64>,
        s_score: Option<f64>,
        domain: Option<String>,
        signal_vector: Option<HashMap<String, String>>,
    }

    #[derive(Deserialize)]
    struct ProtocolInput {
        id: String,
        started_weeks_ago: f64,
        onset_weeks: f64,
        peak_weeks: f64,
        target_domains: Vec<String>,
        max_effect: Option<f64>,
    }

    #[derive(Deserialize)]
    struct CohortCurve {
        median_response: Option<f64>,
    }

    let snap: CurrentSnap = match serde_json::from_str(current_snapshot_json) {
        Ok(s) => s,
        Err(_) => return "{}".to_string(),
    };

    let protocols: Vec<ProtocolInput> = serde_json::from_str(protocols_json).unwrap_or_default();
    let cohort: CohortCurve = serde_json::from_str(cohort_curve_json).unwrap_or(CohortCurve { median_response: None });

    let p = snap.p_score.unwrap_or(0.3);
    let c = snap.c_score.unwrap_or(0.5);
    let p_var = snap.p_var.unwrap_or(0.15);
    let domain = snap.domain.unwrap_or_default();
    let cohort_factor = cohort.median_response.unwrap_or(0.6);

    // Map domain → primary body regions
    let domain_regions: Vec<&str> = match domain.as_str() {
        "cardiovascular" => vec!["heart", "lungs", "blood"],
        "metabolic" => vec!["liver", "gut", "kidneys"],
        "hormonal" => vec!["thyroid", "adrenals", "reproductive"],
        "musculoskeletal" => vec!["spine", "upper_body", "lower_body", "joints"],
        "sleep_recovery" => vec!["brain", "adrenals", "immune"],
        "cognitive" => vec!["brain", "thyroid"],
        _ => vec!["heart"],
    };

    // Compute aggregate protocol effect on this domain
    let mut total_effect: f64 = 0.0;
    let mut protocol_count: f64 = 0.0;

    for proto in &protocols {
        let targets_this_domain = proto.target_domains.iter().any(|d| d == &domain);
        if !targets_this_domain { continue; }

        let current_weeks = proto.started_weeks_ago;
        let projected_weeks = current_weeks + projection_weeks;
        let current_response = response_curve(current_weeks, proto.onset_weeks, proto.peak_weeks);
        let projected_response = response_curve(projected_weeks, proto.onset_weeks, proto.peak_weeks);

        let max_eff = proto.max_effect.unwrap_or(0.6);
        total_effect += (projected_response - current_response) * max_eff * cohort_factor;
        protocol_count += 1.0;
    }

    if protocol_count > 0.0 {
        total_effect = (total_effect / protocol_count).clamp(0.0, 0.8);
    }

    // Build projected region states
    let mut region_map: HashMap<String, (f64, f64)> = HashMap::new();

    for &r in REGIONS {
        let is_primary = domain_regions.contains(&r);
        let base_heat = if is_primary { p } else { p * 0.25 };
        let base_recovery = (1.0 - p) * if is_primary { 0.8 } else { 1.1 };

        // Apply protocol projection to primary regions
        let projected_heat = if is_primary {
            (base_heat * (1.0 - total_effect)).clamp(0.05, 1.0)
        } else {
            base_heat
        };
        let projected_recovery = if is_primary {
            (base_recovery + total_effect * 0.5).clamp(0.0, 1.0)
        } else {
            base_recovery.clamp(0.0, 1.0)
        };

        region_map.insert(r.to_string(), (projected_heat, projected_recovery));
    }

    // Heat diffusion on projected state
    diffuse_heat(&mut region_map, 3);

    // Data quality from signal vector
    let data_quality = snap.signal_vector.as_ref().map(|sv| {
        let present = sv.values().filter(|v| *v == "present").count();
        if sv.is_empty() { 0.3 } else { present as f64 / sv.len() as f64 }
    }).unwrap_or(0.3);

    let confidence = (1.0 - p_var * 4.0).clamp(0.1, 1.0) * data_quality.max(0.3);

    let mut max_heat: f64 = 0.0;
    let mut dominant = "heart".to_string();

    let regions: Vec<RegionState> = REGIONS.iter().map(|&id| {
        let (heat, recovery) = region_map.get(id).copied().unwrap_or((0.15, 0.7));
        let is_primary = domain_regions.contains(&id);
        let color = recovery_color(heat, recovery);

        let phase = (id.len() as f64) * 0.7;
        let pulse_rate = 0.3 + heat * 1.5 + (time * 0.001 + phase).sin() * 0.1;
        let glow_intensity = if is_primary {
            (heat * confidence + total_effect * 0.3).clamp(0.0, 1.0)
        } else {
            (heat * confidence * 0.5).clamp(0.0, 1.0)
        };

        // Trend: if protocol is reducing heat, trend is positive (improving)
        let trend = if is_primary && total_effect > 0.05 {
            0.3 + total_effect * 0.7
        } else if heat > 0.6 {
            -0.3 - (heat - 0.6)
        } else {
            0.1
        };

        if heat > max_heat {
            max_heat = heat;
            dominant = id.to_string();
        }

        RegionState {
            id: id.to_string(),
            heat,
            recovery,
            pulse_rate,
            glow_intensity,
            color,
            trend_arrow: trend,
            confidence: if is_primary { confidence } else { confidence * 0.5 },
            label: region_label(id).to_string(),
        }
    }).collect();

    let n = regions.len() as f64;
    let frame = TwinFrame {
        timestamp: time,
        regions,
        global_recovery: region_map.values().map(|(_, r)| r).sum::<f64>() / n,
        global_stress: region_map.values().map(|(h, _)| h).sum::<f64>() / n,
        dominant_system: dominant,
    };

    serde_json::to_string(&frame).unwrap_or_default()
}

/// Map health domain signals to body regions for the twin
#[wasm_bindgen]
pub fn map_signals_to_regions(snapshot_json: &str) -> String {
    #[derive(Deserialize)]
    struct Snapshot {
        p_score: Option<f64>,
        p_var: Option<f64>,
        c_score: Option<f64>,
        s_score: Option<f64>,
        domain: Option<String>,
        signal_vector: Option<HashMap<String, String>>,
    }

    let snap: Snapshot = match serde_json::from_str(snapshot_json) {
        Ok(s) => s,
        Err(_) => return "[]".to_string(),
    };

    let p = snap.p_score.unwrap_or(0.3);
    let c = snap.c_score.unwrap_or(0.5);
    let s = snap.s_score.unwrap_or(0.3);
    let p_var = snap.p_var.unwrap_or(0.15);
    let domain = snap.domain.unwrap_or_default();

    // Count present/absent signals for data quality
    let (present, total) = snap.signal_vector.as_ref().map(|sv| {
        let p = sv.values().filter(|v| *v == "present").count();
        (p, sv.len())
    }).unwrap_or((0, 1));

    let data_quality = if total > 0 { present as f64 / total as f64 } else { 0.3 };
    let confidence = (1.0 - p_var * 4.0).clamp(0.1, 1.0) * data_quality.max(0.3);

    // Map domain → primary regions
    let primary_regions: Vec<&str> = match domain.as_str() {
        "cardiovascular" => vec!["heart", "lungs", "blood"],
        "metabolic" => vec!["liver", "gut", "kidneys"],
        "hormonal" => vec!["thyroid", "adrenals", "reproductive"],
        "musculoskeletal" => vec!["spine", "upper_body", "lower_body", "joints"],
        "sleep_recovery" => vec!["brain", "adrenals", "immune"],
        "cognitive" => vec!["brain", "thyroid"],
        _ => vec!["heart"],
    };

    // Staleness inverts recovery perception
    let staleness_penalty = s.clamp(0.0, 1.0);
    let effective_recovery = (1.0 - p) * (1.0 - staleness_penalty * 0.4);

    let mut signals: Vec<SignalInput> = Vec::new();

    for &region in &primary_regions {
        signals.push(SignalInput {
            region: region.to_string(),
            intensity: p * (1.0 + (1.0 - c) * 0.2),
            recovery: effective_recovery,
            trend: if p > 0.6 { -0.3 - (p - 0.6) } else { 0.2 + effective_recovery * 0.3 },
            data_quality: confidence,
        });
    }

    // Secondary regions get attenuated signal
    let secondary: Vec<&str> = REGIONS.iter()
        .filter(|r| !primary_regions.contains(r))
        .copied()
        .collect();

    for &region in secondary.iter().take(6) {
        signals.push(SignalInput {
            region: region.to_string(),
            intensity: p * 0.25,
            recovery: effective_recovery * 1.2,
            trend: 0.0,
            data_quality: confidence * 0.5,
        });
    }

    serde_json::to_string(&signals).unwrap_or_default()
}
