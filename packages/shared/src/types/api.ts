import type { Vin, PillarEvent, PosteriorSnapshot, RiskBand, Subsystem, SortContext } from './vin.js';
import type { Dealer, FSRSlot, BookingDraft } from './dealer.js';
import type { GovernanceAction } from './governance.js';

export interface LeadsQuery {
  subsystem?: Subsystem;
  band?: RiskBand;
  governance_band?: string;
  lens?: string;
  page?: number;
  limit?: number;
}

export interface LeadsResponse {
  leads: (Vin & { sort_context?: SortContext })[];
  total: number;
  page: number;
  limit: number;
}

export interface VinDetailResponse {
  vin: Vin;
  pillars: PillarEvent[];
  timeline: PosteriorSnapshot[];
  governance: GovernanceAction[];
  service_suggestion: ServiceSuggestion | null;
  sort_context: SortContext | null;
}

export interface ServiceSuggestion {
  recommended: boolean;
  urgency: 'immediate' | 'soon' | 'routine' | 'none';
  reason: string;
}

export interface VinPreferencesRequest {
  home_area?: string;
  preferred_dealer_id?: string;
  use_preferred_first?: boolean;
}

export interface DealerSearchQuery {
  home_area?: string;
  vin_id?: string;
  max?: number;
}

export interface DealerSearchResponse {
  dealers: Dealer[];
}

export interface FSRAvailabilityRequest {
  vin_id: string;
  dealer_ids: string[];
  preferred_dealer_id?: string;
  home_area?: string;
}

export interface FSRAvailabilityResponse {
  slots: (FSRSlot & { dealer: Dealer })[];
}

export interface BookingDraftRequest {
  vin_id: string;
  dealer_id: string;
  slot_id: string;
  contact?: Record<string, string>;
}

export interface BookingDraftResponse {
  booking: BookingDraft;
}

export interface BookingHoldRequest {
  booking_id: string;
}

export interface BookingHoldResponse {
  booking: BookingDraft;
}
