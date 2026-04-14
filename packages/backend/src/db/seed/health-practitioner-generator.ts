import { v4 as uuidv4 } from 'uuid';

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

const PRACTITIONERS_DATA = [
  { name: 'Dr. Karim Godamunne', specialty: 'Cardiovascular / Internal Medicine', certs: ['MD', 'MBA', 'SFHM', 'FACHE'] },
  { name: 'Dr. Elena Vasquez', specialty: 'Sports Medicine / Peptide Therapy', certs: ['DO', 'Board Certified Sports Medicine'] },
  { name: 'Dr. James Chen', specialty: 'Endocrinology / Hormonal Optimization', certs: ['MD', 'Board Certified Endocrinology'] },
  { name: 'Felipe Loureiro', specialty: 'Head Coach / Endurance Performance', certs: ['CSCS', 'USAT Level III', 'Ironman Certified Coach'] },
  { name: 'Dr. Eric Rightmire', specialty: 'Orthopedic Surgery / Recovery', certs: ['MD', 'Board Certified Orthopedic Surgery'] },
  { name: 'Coach Lina Ramos', specialty: 'Triathlon Coaching / Women\'s Performance', certs: ['35x Ironman', 'Kona Qualifier', 'USAT Coach'] },
  { name: 'Dr. Sarah Kim', specialty: 'Functional Medicine / Metabolic Health', certs: ['MD', 'IFM Certified'] },
  { name: 'Dr. Michael Foster', specialty: 'Neuroscience / Cognitive Performance', certs: ['PhD Neuroscience', 'Board Certified'] },
  { name: 'Coach Derek Thompson', specialty: 'Strength & Conditioning / Military Performance', certs: ['CSCS', 'TSAC-F', 'US Army Veteran'] },
  { name: 'Dr. Priya Patel', specialty: 'Integrative Medicine / Longevity', certs: ['MD', 'Board Certified Internal Medicine', 'Anti-Aging Fellowship'] },
  { name: 'Coach Jordan Wright', specialty: 'Nutrition & Recovery Coaching', certs: ['RD', 'CSSD', 'Precision Nutrition L2'] },
  { name: 'Dr. Nathan Berg', specialty: 'Regenerative Medicine / Tissue Repair', certs: ['MD', 'Fellowship Regenerative Medicine'] },
];

export interface GeneratedPractitioner {
  id: string;
  orgId: string;
  name: string;
  specialty: string;
  metro_area: string;
  certifications: string[];
  latitude: number;
  longitude: number;
}

export interface GeneratedSessionSlot {
  id: string;
  practitioner_id: string;
  date: string;
  time_block: 'morning' | 'afternoon' | 'evening';
  capacity: number;
  booked: number;
}

export function generatePractitioners(orgId: string): {
  practitioners: GeneratedPractitioner[];
  slots: GeneratedSessionSlot[];
} {
  const practitioners: GeneratedPractitioner[] = [];
  const slots: GeneratedSessionSlot[] = [];

  for (let i = 0; i < PRACTITIONERS_DATA.length; i++) {
    const data = PRACTITIONERS_DATA[i];
    const metro = METRO_AREAS[i % METRO_AREAS.length];
    const practId = uuidv4();

    practitioners.push({
      id: practId,
      orgId,
      name: data.name,
      specialty: data.specialty,
      metro_area: metro.name,
      certifications: data.certs,
      latitude: metro.lat + (Math.random() - 0.5) * 0.1,
      longitude: metro.lng + (Math.random() - 0.5) * 0.1,
    });

    const today = new Date();
    for (let d = 0; d < 21; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];

      for (const block of ['morning', 'afternoon', 'evening'] as const) {
        slots.push({
          id: uuidv4(),
          practitioner_id: practId,
          date: dateStr,
          time_block: block,
          capacity: 3,
          booked: Math.random() < 0.25 ? 1 : 0,
        });
      }
    }
  }

  return { practitioners, slots };
}
