export interface RegisterDto {
  name: string;
  email: string;
  phone_number?: string;
  password: string;
  role?: "BORROWER" | "OWNER" | "ADMIN";
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
