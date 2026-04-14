import { v4 as uuidv4 } from 'uuid';
import { HEALTH_STORYLINES, type HealthStoryline } from './health-storylines.js';
import {
  WEARABLE_PROFILES, BIOMARKER_PROFILES,
  PROTOCOL_STACKS, PROTOCOL_LIST, type ProtocolId,
  type HealthDomainId,
} from '@gravity/shared';

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

const SEED = 'longevity-plan-demo-v1';
const random = mulberry32(strToSeed(SEED));

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

const FIRST_NAMES_M = ['Marcus', 'James', 'Kai', 'Diego', 'Ethan', 'Noah', 'Liam', 'Mason', 'Aiden', 'Lucas', 'Ben', 'Tyler', 'Ryan', 'Derek', 'Jordan'];
const FIRST_NAMES_F = ['Sofia', 'Maya', 'Ava', 'Luna', 'Zoe', 'Elena', 'Riley', 'Nora', 'Aria', 'Mia', 'Camille', 'Harper', 'Jade', 'Leila', 'Sam'];
const LAST_NAMES = ['Chen', 'Rivera', 'Okafor', 'Kim', 'Patel', 'Nguyen', 'Larsson', 'Diaz', 'Foster', 'Thompson', 'Moreau', 'Wright', 'Santos', 'Berg', 'Nakamura'];

const ATHLETE_TYPES = [
  'marathon runner', 'triathlete', 'CrossFit athlete', 'cyclist', 'swimmer',
  'executive / weekend warrior', 'military operator', 'MMA fighter',
  'tennis player', 'soccer player', 'trail runner', 'powerlifter',
  'yoga practitioner', 'rower', 'general fitness',
];

const METRO_AREAS = [
  { name: 'Austin', lat: 30.27, lng: -97.74 },
  { name: 'Miami', lat: 25.76, lng: -80.19 },
  { name: 'Los Angeles', lat: 34.05, lng: -118.24 },
  { name: 'New York', lat: 40.71, lng: -74.01 },
  { name: 'Denver', lat: 39.74, lng: -104.99 },
  { name: 'San Francisco', lat: 37.77, lng: -122.42 },
  { name: 'Chicago', lat: 41.88, lng: -87.63 },
  { name: 'Seattle', lat: 47.61, lng: -122.33 },
];

const WEARABLE_PROFILE_KEYS = Object.keys(WEARABLE_PROFILES);
const BIOMARKER_PROFILE_KEYS = Object.keys(BIOMARKER_PROFILES);
const PROTOCOL_STACK_KEYS = Object.keys(PROTOCOL_STACKS);

const SPORT_MAP: Record<string, string> = {
  'marathon runner': 'Marathon', 'triathlete': 'Triathlon', 'CrossFit athlete': 'CrossFit',
  'cyclist': 'Cycling', 'swimmer': 'Swimming', 'executive / weekend warrior': 'General Fitness',
  'military operator': 'Tactical', 'MMA fighter': 'MMA', 'tennis player': 'Tennis',
  'soccer player': 'Soccer', 'trail runner': 'Trail Running', 'powerlifter': 'Powerlifting',
  'yoga practitioner': 'Yoga', 'rower': 'Rowing', 'general fitness': 'General Fitness',
};

const TRAINING_PHASES: TrainingPhase[] = ['recovery', 'base', 'build', 'peak', 'taper', 'race', 'off_season'];

const RACE_TEMPLATES: Record<string, Array<{ name: string; type: string; location: string }>> = {
  Marathon: [
    { name: 'Boston Marathon', type: 'Marathon', location: 'Boston, MA' },
    { name: 'NYC Marathon', type: 'Marathon', location: 'New York, NY' },
    { name: 'Chicago Marathon', type: 'Marathon', location: 'Chicago, IL' },
    { name: 'LA Marathon', type: 'Marathon', location: 'Los Angeles, CA' },
  ],
  Triathlon: [
    { name: 'Ironman 70.3 Oceanside', type: 'Triathlon', location: 'Oceanside, CA' },
    { name: 'Olympic Triathlon Nationals', type: 'Triathlon', location: 'Milwaukee, WI' },
    { name: 'Ironman 70.3 Santa Cruz', type: 'Triathlon', location: 'Santa Cruz, CA' },
  ],
  Cycling: [
    { name: 'Gran Fondo New York', type: 'Cycling', location: 'New York, NY' },
    { name: 'Leadville Trail 100 MTB', type: 'Cycling', location: 'Leadville, CO' },
  ],
  'Trail Running': [
    { name: 'Western States 100', type: 'Ultramarathon', location: 'Olympic Valley, CA' },
    { name: 'UTMB 50K', type: 'Ultramarathon', location: 'Chamonix, France' },
  ],
  CrossFit: [
    { name: 'CrossFit Games Qualifier', type: 'CrossFit', location: 'Madison, WI' },
  ],
  Swimming: [
    { name: 'Open Water Nationals 10K', type: 'Swimming', location: 'Fort Myers, FL' },
  ],
};

function generateProfile(sex: 'M' | 'F' | 'other', athleteType: string, rng: () => number) {
  const sport = SPORT_MAP[athleteType] ?? 'General Fitness';
  const isMale = sex === 'M';
  const heightCm = isMale
    ? Math.round(170 + rng() * 20)
    : Math.round(158 + rng() * 18);
  const bmi = 19 + rng() * 6;
  const weightKg = Math.round(bmi * (heightCm / 100) ** 2);
  const calorieTarget = Math.round((isMale ? 1800 : 1500) + rng() * 800);
  const trainingPhase = pick(TRAINING_PHASES);

  const templates = RACE_TEMPLATES[sport] ?? RACE_TEMPLATES['Marathon'] ?? [];
  const raceCount = Math.floor(rng() * 3);
  const races: RaceEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < raceCount && i < templates.length; i++) {
    const tmpl = templates[i];
    const dayOffset = Math.floor(-180 + rng() * 360);
    const date = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
    const isPast = dayOffset < 0;
    races.push({
      name: tmpl.name,
      type: tmpl.type,
      location: tmpl.location,
      date: date.toISOString().split('T')[0],
      finish_time: isPast ? formatFinishTime(sport, rng) : undefined,
      is_pr: isPast && rng() < 0.3,
    });
  }

  return { sport, heightCm, weightKg, trainingPhase, calorieTarget, races };
}

function formatFinishTime(sport: string, rng: () => number): string {
  if (sport === 'Marathon') {
    const hrs = 3 + Math.floor(rng() * 2);
    const mins = Math.floor(rng() * 60);
    const secs = Math.floor(rng() * 60);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  if (sport === 'Triathlon') {
    const hrs = 4 + Math.floor(rng() * 3);
    const mins = Math.floor(rng() * 60);
    const secs = Math.floor(rng() * 60);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  const mins = 30 + Math.floor(rng() * 90);
  const secs = Math.floor(rng() * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export type TrainingPhase = 'recovery' | 'base' | 'build' | 'peak' | 'taper' | 'race' | 'off_season';

export interface RaceEntry {
  name: string;
  type: string;
  location: string;
  date: string;
  finish_time?: string;
  is_pr?: boolean;
}

export interface GeneratedSubject {
  id: string;
  orgId: string;
  externalId: string;
  displayName: string;
  dateOfBirth: string;
  sex: 'M' | 'F' | 'other';
  fitnessLevel: 'low' | 'medium' | 'high';
  activeDomains: HealthDomainId[];
  primaryDomain: HealthDomainId;
  enrolledAt: Date;
  athleteType: string;
  metro: typeof METRO_AREAS[number];

  // Athlete profile
  sport: string;
  heightCm: number;
  weightKg: number;
  trainingPhase: TrainingPhase;
  calorieTarget: number;
  coachNotes: string;
  races: RaceEntry[];

  // Data source profile
  wearableProfile: string;
  biomarkerProfile: string;

  // Protocols
  protocols: ProtocolId[];
  protocolStackLabel: string;

  // Storyline for synthetic trajectory
  storyline: HealthStoryline;

  // Initial posterior (overwritten by signal generator)
  posteriorP: number;
  posteriorPVar: number;
  posteriorC: number;
  posteriorS: number;
  riskBand: 'critical' | 'high' | 'medium' | 'low';
  lastSignalAt: Date;
}

function getRiskBand(p: number): 'critical' | 'high' | 'medium' | 'low' {
  if (p >= 0.8) return 'critical';
  if (p >= 0.6) return 'high';
  if (p >= 0.3) return 'medium';
  return 'low';
}

function assignStoryline(): HealthStoryline {
  const r = random();
  if (r < 0.10) return HEALTH_STORYLINES[0];  // overtraining
  if (r < 0.20) return HEALTH_STORYLINES[1];  // metabolic improvement
  if (r < 0.28) return HEALTH_STORYLINES[2];  // hormonal response
  if (r < 0.36) return HEALTH_STORYLINES[3];  // sleep disruption
  if (r < 0.43) return HEALTH_STORYLINES[4];  // post-injury
  if (r < 0.50) return HEALTH_STORYLINES[5];  // stress-driven
  if (r < 0.60) return HEALTH_STORYLINES[6];  // new client baseline
  if (r < 0.68) return HEALTH_STORYLINES[7];  // plateau
  if (r < 0.76) return HEALTH_STORYLINES[8];  // strong responder
  if (r < 0.82) return HEALTH_STORYLINES[9];  // data gap
  if (r < 0.88) return HEALTH_STORYLINES[10]; // acute cardio crisis → ESCALATED
  if (r < 0.94) return HEALTH_STORYLINES[11]; // metabolic emergency → ESCALATED
  return HEALTH_STORYLINES[12];               // MSK breakdown → ESCALATED
}

function pickDomains(storyline: HealthStoryline): HealthDomainId[] {
  const domains = new Set<HealthDomainId>([storyline.primaryDomain]);
  const all: HealthDomainId[] = ['cardiovascular', 'metabolic', 'hormonal', 'musculoskeletal', 'sleep_recovery', 'cognitive'];
  while (domains.size < 2 + Math.floor(random() * 2)) {
    domains.add(pick(all));
  }
  return [...domains];
}

function pickProtocols(): { protocols: ProtocolId[]; stackLabel: string } {
  if (random() < 0.7) {
    const stackKey = pick(PROTOCOL_STACK_KEYS);
    const stack = PROTOCOL_STACKS[stackKey];
    return { protocols: [...stack.protocols], stackLabel: stack.label };
  }
  const count = 1 + Math.floor(random() * 2);
  const protocols: ProtocolId[] = [];
  for (let i = 0; i < count; i++) {
    const p = pick(PROTOCOL_LIST);
    if (!protocols.includes(p)) protocols.push(p);
  }
  return { protocols, stackLabel: 'Custom' };
}

/** Hero subjects with hand-crafted scenarios for demo walkthrough. */
const HERO_SUBJECTS = [
  {
    index: 0,
    name: 'Marcus Rivera',
    sex: 'M' as const,
    age: 34,
    type: 'triathlete',
    storylineId: 1,
    stack: 'performance_longevity',
    wearable: 'whoop_strava',
    biomarker: 'function_quarterly',
    heightCm: 178, weightKg: 74, phase: 'build' as TrainingPhase, calorieTarget: 2800,
    coachNotes: 'Needs to pull back on volume. Watch for fatigue signs heading into race block.',
    races: [
      { name: 'Ironman 70.3 Oceanside', type: 'Triathlon', location: 'Oceanside, CA', date: '2026-06-14' },
      { name: 'Olympic Triathlon Nationals', type: 'Triathlon', location: 'Milwaukee, WI', date: '2025-09-20', finish_time: '2:18:45', is_pr: false },
    ] as RaceEntry[],
  },
  {
    index: 1,
    name: 'Sofia Chen',
    sex: 'F' as const,
    age: 42,
    type: 'executive / weekend warrior',
    storylineId: 2,
    stack: 'metabolic_reset',
    wearable: 'oura_strava',
    biomarker: 'insidetracker_biannual',
    heightCm: 165, weightKg: 68, phase: 'base' as TrainingPhase, calorieTarget: 1900,
    coachNotes: 'Responding well to metabolic protocol. Energy improving. Keep calorie target steady.',
    races: [] as RaceEntry[],
  },
  {
    index: 2,
    name: 'Kai Nakamura',
    sex: 'M' as const,
    age: 28,
    type: 'CrossFit athlete',
    storylineId: 5,
    stack: 'injury_recovery',
    wearable: 'garmin_trainingpeaks',
    biomarker: 'wild_health_quarterly',
    heightCm: 175, weightKg: 82, phase: 'recovery' as TrainingPhase, calorieTarget: 2600,
    coachNotes: 'Post-shoulder injury. Cleared for upper body at 60% load. Reassess in 2 weeks.',
    races: [
      { name: 'CrossFit Games Qualifier', type: 'CrossFit', location: 'Madison, WI', date: '2026-08-01' },
    ] as RaceEntry[],
  },
  {
    index: 3,
    name: 'Elena Moreau',
    sex: 'F' as const,
    age: 38,
    type: 'marathon runner',
    storylineId: 3,
    stack: 'hormonal_optimization',
    wearable: 'garmin_strava',
    biomarker: 'marek_monthly',
    heightCm: 168, weightKg: 57, phase: 'taper' as TrainingPhase, calorieTarget: 2200,
    coachNotes: 'Boston Marathon in 9 days. Taper going well. Watch cortisol — tends to spike pre-race.',
    races: [
      { name: 'Boston Marathon', type: 'Marathon', location: 'Boston, MA', date: '2026-04-20' },
      { name: 'NYC Marathon', type: 'Marathon', location: 'New York, NY', date: '2025-11-02', finish_time: '3:12:44', is_pr: true },
    ] as RaceEntry[],
  },
  {
    index: 4,
    name: 'Derek Foster',
    sex: 'M' as const,
    age: 45,
    type: 'military operator',
    storylineId: 6,
    stack: 'cognitive_edge',
    wearable: 'whoop_trainingpeaks',
    biomarker: 'function_quarterly',
    heightCm: 183, weightKg: 91, phase: 'base' as TrainingPhase, calorieTarget: 2400,
    coachNotes: 'Stress load from deployment cycle. HRV tanking. Prioritize sleep protocol.',
    races: [] as RaceEntry[],
  },
  {
    index: 5,
    name: 'Maya Patel',
    sex: 'F' as const,
    age: 31,
    type: 'cyclist',
    storylineId: 9,
    stack: 'performance_longevity',
    wearable: 'oura_strava',
    biomarker: 'insidetracker_biannual',
    heightCm: 170, weightKg: 62, phase: 'build' as TrainingPhase, calorieTarget: 2300,
    coachNotes: 'Strong responder. All markers trending well. Consider bumping training volume next block.',
    races: [
      { name: 'Gran Fondo New York', type: 'Cycling', location: 'New York, NY', date: '2026-05-17' },
      { name: 'Leadville Trail 100 MTB', type: 'Cycling', location: 'Leadville, CO', date: '2025-08-09', finish_time: '9:45:12', is_pr: false },
    ] as RaceEntry[],
  },
];

export function generateSubjects(count: number = 200, orgId?: string): GeneratedSubject[] {
  const subjects: GeneratedSubject[] = [];
  if (!orgId) orgId = uuidv4();
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const hero = HERO_SUBJECTS.find(h => h.index === i);
    const storyline = hero
      ? HEALTH_STORYLINES[hero.storylineId - 1]
      : assignStoryline();

    const sex = hero?.sex ?? (random() < 0.55 ? 'M' as const : 'F' as const);
    const firstNames = sex === 'M' ? FIRST_NAMES_M : FIRST_NAMES_F;
    const displayName = hero?.name ?? `${pick(firstNames)} ${pick(LAST_NAMES)}`;

    const age = hero?.age ?? (25 + Math.floor(random() * 30));
    const dob = new Date(now.getFullYear() - age, Math.floor(random() * 12), 1 + Math.floor(random() * 28));

    const enrolledDaysAgo = hero ? 90 : 14 + Math.floor(random() * 180);
    const enrolledAt = new Date(now.getTime() - enrolledDaysAgo * 24 * 60 * 60 * 1000);

    const activeDomains = pickDomains(storyline);
    const { protocols, stackLabel } = hero
      ? { protocols: [...PROTOCOL_STACKS[hero.stack].protocols], stackLabel: PROTOCOL_STACKS[hero.stack].label }
      : pickProtocols();

    const fitnessLevel = hero
      ? 'high' as const
      : random() < 0.3 ? 'low' as const : random() < 0.6 ? 'medium' as const : 'high' as const;

    const athleteType = hero?.type ?? pick(ATHLETE_TYPES);
    const profile = hero
      ? { sport: SPORT_MAP[hero.type] ?? hero.type, heightCm: hero.heightCm, weightKg: hero.weightKg, trainingPhase: hero.phase, calorieTarget: hero.calorieTarget, races: hero.races }
      : generateProfile(sex, athleteType, random);

    const finalP = storyline.pCurve(1);
    const finalC = storyline.cCurve(1);

    subjects.push({
      id: uuidv4(),
      orgId,
      externalId: `LP-${(1000 + i).toString()}`,
      displayName,
      dateOfBirth: dob.toISOString().split('T')[0],
      sex,
      fitnessLevel,
      activeDomains,
      primaryDomain: storyline.primaryDomain,
      enrolledAt,
      athleteType,
      metro: pick(METRO_AREAS),
      sport: profile.sport,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      trainingPhase: profile.trainingPhase,
      calorieTarget: profile.calorieTarget,
      coachNotes: hero?.coachNotes ?? '',
      races: profile.races,
      wearableProfile: hero?.wearable ?? pick(WEARABLE_PROFILE_KEYS),
      biomarkerProfile: hero?.biomarker ?? pick(BIOMARKER_PROFILE_KEYS),
      protocols,
      protocolStackLabel: stackLabel,
      storyline,
      posteriorP: Math.round(finalP * 1000) / 1000,
      posteriorPVar: 0.15,
      posteriorC: Math.round(finalC * 1000) / 1000,
      posteriorS: Math.round(storyline.sCurve(1) * 1000) / 1000,
      riskBand: getRiskBand(finalP),
      lastSignalAt: new Date(now.getTime() - random() * 3 * 24 * 60 * 60 * 1000),
    });
  }

  return subjects;
}
