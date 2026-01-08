/**
 * NL2KQL request/response types
 */

export interface NL2KQLRequest {
  query: string;
  database?: string;
  cluster?: string;
}

export interface NL2KQLResponse {
  success: boolean;
  kql?: string;
  error?: string;
  refinedSchema?: {
    tables: string[];
    columns: string[];
  };
  examplesUsed?: number;
  refinements?: number;
  metadata?: {
    tokensUsed?: number;
    responseTime?: number;
    confidence?: number;
  };
}

