/**
 * Schema types for NL2KQL
 */

export interface TableSchema {
  name: string;
  description?: string;
  columns: ColumnSchema[];
  domain?: string[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
}

export interface DatabaseSchema {
  database: string;
  tables: TableSchema[];
}

export interface RefinedSchema {
  tables: TableSchema[];
  columns: ColumnSchema[];
  relevance: number;
}

export interface Example {
  nlq: string;
  kql: string;
  database: string;
  tags?: string[];
}

