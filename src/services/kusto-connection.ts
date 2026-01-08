/**
 * Kusto Connection Service
 * Connects to Azure Data Explorer to fetch schema and execute queries
 * Based on patterns from kusto-mcp repository
 */

import { Client, KustoConnectionStringBuilder } from 'azure-kusto-data';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';

dotenv.config();

export interface KustoConfig {
  clusterUrl: string;
  database: string;
  authMethod?: 'default' | 'azure-cli';
}

export interface KustoQueryResult {
  primaryResults: Array<{
    columns: Array<{ name: string; type: string }>;
    rows: Array<Record<string, any>>;
  }>;
}

export class KustoConnectionService {
  private client: Client | null = null;
  private database: string | null = null;
  private config: KustoConfig;

  constructor(config: KustoConfig) {
    this.config = config;
  }

  /**
   * Initialize connection to Kusto cluster
   */
  async initialize(): Promise<{ success: boolean; cluster: string; database: string }> {
    try {
      console.log(`Connecting to Kusto: ${this.config.clusterUrl}, database: ${this.config.database}`);

      // Create connection string based on auth method
      let connectionString;
      
      if (this.config.authMethod === 'azure-cli') {
        connectionString = KustoConnectionStringBuilder.withAzLoginIdentity(this.config.clusterUrl);
      } else {
        // Use DefaultAzureCredential (supports multiple auth methods)
        const credential = new DefaultAzureCredential();
        connectionString = KustoConnectionStringBuilder.withTokenCredential(
          this.config.clusterUrl,
          credential
        );
      }

      // Create client
      this.client = new Client(connectionString);
      this.database = this.config.database;

      // Test connection with a simple query
      await this.client.execute(this.config.database, 'print now()');

      console.log('✅ Kusto connection initialized successfully');
      
      return {
        success: true,
        cluster: this.config.clusterUrl,
        database: this.config.database
      };
    } catch (error) {
      console.error('❌ Failed to initialize Kusto connection:', error);
      throw new Error(`Failed to connect to Kusto: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if connection is initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.database !== null;
  }

  /**
   * Get current database name
   */
  getDatabase(): string {
    if (!this.database) {
      throw new Error('Connection not initialized');
    }
    return this.database;
  }

  /**
   * Execute a KQL query
   */
  async executeQuery(query: string): Promise<KustoQueryResult> {
    if (!this.client || !this.database) {
      throw new Error('Kusto connection not initialized. Call initialize() first.');
    }

    try {
      const result = await this.client.execute(this.database, query);
      
      // Transform result to our format
      const primaryResults = result.primaryResults.map(table => {
        // Convert rows generator to array and handle null values
        const rowsArray: Record<string, any>[] = [];
        
        // Handle rows - it might be a generator or array
        const rowsRaw = table.rows as unknown;
        let rows: any[] = [];
        
        if (typeof rowsRaw === 'function') {
          // It's a generator function, call it and convert to array
          const generator = (rowsRaw as () => Generator<any>)();
          rows = Array.from(generator);
        } else if (Array.isArray(rowsRaw)) {
          rows = rowsRaw;
        }
            
        for (const row of rows) {
          const rowObj: Record<string, any> = {};
          table.columns.forEach((col, idx) => {
            const value = Array.isArray(row) ? row[idx] : (row as any)[col.name || `col${idx}`];
            rowObj[col.name || `col${idx}`] = value !== null && value !== undefined ? value : null;
          });
          rowsArray.push(rowObj);
        }

        return {
          columns: table.columns.map(col => ({
            name: col.name || '',
            type: col.type || 'string'
          })),
          rows: rowsArray
        };
      });

      return { primaryResults };
    } catch (error) {
      console.error('Query execution error:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all tables in the database
   */
  async listTables(): Promise<Array<{ name: string; type: string }>> {
    const result = await this.executeQuery('.show tables');
    
    if (!result.primaryResults || result.primaryResults.length === 0) {
      return [];
    }

    const tables = result.primaryResults[0];
    return tables.rows.map((row: any) => ({
      name: row.TableName || row.name || '',
      type: row.TableType || 'Table'
    }));
  }

  /**
   * Get schema for a specific table
   */
  async getTableSchema(tableName: string): Promise<{
    name: string;
    columns: Array<{ name: string; type: string }>;
  }> {
    const query = `.show table ${tableName} schema as json`;
    const result = await this.executeQuery(query);
    
    if (!result.primaryResults || result.primaryResults.length === 0) {
      throw new Error(`Table ${tableName} not found or has no schema`);
    }

    // Parse schema from result
    const schemaData = result.primaryResults[0].rows[0];
    const schema = typeof schemaData === 'string' ? JSON.parse(schemaData) : schemaData;
    
    return {
      name: tableName,
      columns: schema.Columns?.map((col: any) => ({
        name: col.ColumnName || col.name,
        type: col.ColumnType || col.type || 'string'
      })) || []
    };
  }

  /**
   * Get full database schema (all tables with their columns)
   */
  async getDatabaseSchema(): Promise<{
    tables: Array<{
      name: string;
      columns: Array<{ name: string; type: string }>;
    }>;
  }> {
    const tables = await this.listTables();
    const schemas = await Promise.all(
      tables.map(table => this.getTableSchema(table.name).catch(() => ({
        name: table.name,
        columns: []
      })))
    );

    return { tables: schemas };
  }

  /**
   * Create connection from environment variables
   * Uses public demo cluster by default if not configured
   */
  static fromEnvironment(): KustoConnectionService {
    // Use public demo cluster if not configured
    const clusterUrl = process.env.KUSTO_CLUSTER_URL || 'https://help.kusto.windows.net';
    const database = process.env.KUSTO_DATABASE || 'Samples';
    const authMethod = (process.env.KUSTO_AUTH_METHOD as 'default' | 'azure-cli') || 'default';

    console.log(`📊 Using Kusto cluster: ${clusterUrl}`);
    console.log(`📊 Database: ${database}`);

    return new KustoConnectionService({
      clusterUrl,
      database,
      authMethod
    });
  }

  /**
   * Create connection to public demo cluster
   */
  static fromPublicDemo(): KustoConnectionService {
    return new KustoConnectionService({
      clusterUrl: 'https://help.kusto.windows.net',
      database: 'Samples',
      authMethod: 'default'
    });
  }
}

