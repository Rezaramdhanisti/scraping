export interface ObjectAny {
  [key: string]: any;
}
export interface ProxyConfig {
  id: number;
  server: string;
  username: string;
  password: string;
}

export interface ProxyDetails {
  input: string;
  data: Data;
}

export interface Data {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  timezone: string;
  is_anycast: boolean;
  is_mobile: boolean;
  is_anonymous: boolean;
  is_satellite: boolean;
  is_hosting: boolean;
  asn: Asn;
  company: Company;
  privacy: Privacy;
  abuse: Abuse;
}

export interface Asn {
  asn: string;
  name: string;
  domain: string;
  route: string;
  type: string;
}

export interface Company {
  name: string;
  domain: string;
  type: string;
}

export interface Privacy {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  relay: boolean;
  hosting: boolean;
  service: string;
}

export interface Abuse {
  address: string;
  country: string;
  email: string;
  name: string;
  network: string;
  phone: string;
}
