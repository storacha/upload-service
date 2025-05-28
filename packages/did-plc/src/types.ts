export type DidPlc = `did:plc:${string}`

export interface PlcOperation {
  type: 'plc_operation';
  verificationMethods: Record<string, string>;
  rotationKeys: string[];
  alsoKnownAs?: string[];
  services?: Record<string, unknown>;
  prev?: string | null;
  sig: string;
}

export interface PlcDocument {
  '@context': string[];
  id: DidPlc;
  alsoKnownAs?: string[];
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
  }>;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
} 