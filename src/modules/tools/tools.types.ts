export interface CreateToolDto {
  title: string;
  description?: string;
  category?: string;
  price_per_day: number; // integer cents
  security_deposit: number; // integer cents
  address: string;
  latitude: number;
  longitude: number;
}

export interface SearchToolsDto {
  lat: number;
  lng: number;
  radius: number; // meters, max 50000
  category?: string;
  page?: number;
  limit?: number;
}

export interface ToolResponse {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_per_day: number;
  security_deposit: number;
  // FR-2.3: approximate location only in search results
  approximate_lat: number;
  approximate_lng: number;
  distance_meters?: number;
  is_active: boolean;
  created_at: string;
}

export interface ToolDetailResponse extends ToolResponse {
  // Exact address revealed only for confirmed reservations
  address?: string;
  exact_lat?: number;
  exact_lng?: number;
  owner_name: string;
  owner_rating_avg: number;
}
