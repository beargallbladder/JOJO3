import { v4 as uuidv4 } from 'uuid';

const METRO_AREAS = [
  { name: 'Detroit', prefix: '481', lat: 42.33, lng: -83.05 },
  { name: 'Chicago', prefix: '606', lat: 41.88, lng: -87.63 },
  { name: 'Houston', prefix: '770', lat: 29.76, lng: -95.37 },
  { name: 'Los Angeles', prefix: '900', lat: 34.05, lng: -118.24 },
  { name: 'Miami', prefix: '331', lat: 25.76, lng: -80.19 },
  { name: 'Dallas', prefix: '752', lat: 32.78, lng: -96.80 },
  { name: 'Phoenix', prefix: '850', lat: 33.45, lng: -112.07 },
  { name: 'Seattle', prefix: '981', lat: 47.61, lng: -122.33 },
];

const DEALER_NAMES = [
  'AutoNation', 'Greenway', 'Heritage', 'Metro', 'Premier', 'Summit', 'Valley',
  'Lakeside', 'Capital', 'Frontier', 'Gateway', 'Horizon', 'Landmark', 'Pinnacle',
];

const CAPABILITIES = ['ev_certified', 'commercial_fleet', 'diesel_specialist', 'performance', 'body_shop', 'quick_lane'];

export interface GeneratedDealer {
  id: string;
  name: string;
  code: string;
  metro_area: string;
  postal_prefix: string;
  address: string;
  phone: string;
  capabilities: string[];
  latitude: number;
  longitude: number;
}

export interface GeneratedFSRSlot {
  id: string;
  dealer_id: string;
  date: string;
  time_block: 'morning' | 'afternoon';
  capacity: number;
  booked: number;
}

export function generateDealers(): { dealers: GeneratedDealer[]; slots: GeneratedFSRSlot[] } {
  const dealers: GeneratedDealer[] = [];
  const slots: GeneratedFSRSlot[] = [];
  let dealerIndex = 0;

  for (const metro of METRO_AREAS) {
    const count = 6 + Math.floor(Math.random() * 2); // 6-7 per metro
    for (let i = 0; i < count && dealerIndex < 50; i++) {
      const dealerId = uuidv4();
      const namePrefix = DEALER_NAMES[dealerIndex % DEALER_NAMES.length];
      const capCount = 1 + Math.floor(Math.random() * 3);
      const caps: string[] = [];
      for (let c = 0; c < capCount; c++) {
        const cap = CAPABILITIES[Math.floor(Math.random() * CAPABILITIES.length)];
        if (!caps.includes(cap)) caps.push(cap);
      }

      dealers.push({
        id: dealerId,
        name: `${namePrefix} Motors ${metro.name}${i > 0 ? ` ${['East', 'West', 'North', 'South', 'Central'][i - 1] || ''}`.trim() : ''}`,
        code: `DM${metro.prefix}${(dealerIndex + 1).toString().padStart(3, '0')}`,
        metro_area: metro.name,
        postal_prefix: metro.prefix,
        address: `${1000 + dealerIndex * 100} Auto Mall Dr, ${metro.name}`,
        phone: `(${metro.prefix}) 555-${(1000 + dealerIndex).toString()}`,
        capabilities: caps,
        latitude: metro.lat + (Math.random() - 0.5) * 0.3,
        longitude: metro.lng + (Math.random() - 0.5) * 0.3,
      });

      // 2 slots per day for 14 days
      const today = new Date();
      for (let d = 0; d < 14; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split('T')[0];

        for (const block of ['morning', 'afternoon'] as const) {
          slots.push({
            id: uuidv4(),
            dealer_id: dealerId,
            date: dateStr,
            time_block: block,
            capacity: 2,
            booked: Math.random() < 0.3 ? 1 : 0,
          });
        }
      }

      dealerIndex++;
    }
  }

  return { dealers, slots };
}
