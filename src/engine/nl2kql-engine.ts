/**
 * NL2KQL Engine - Main orchestration component
 * Combines Schema Refiner, Few-shot Selector, Query Refiner, and LLM
 */

import { SchemaRefiner } from './schema-refiner.js';
import { FewShotSelector } from './few-shot-selector.js';
import { QueryRefiner } from './query-refiner.js';
import { LLMClient } from './llm-client.js';
import { DatabaseSchema, RefinedSchema } from '../types/schema.js';
import { NL2KQLRequest, NL2KQLResponse } from '../types/nl2kql.js';

export class NL2KQLEngine {
  private schemaRefiner: SchemaRefiner;
  public fewShotSelector: FewShotSelector; // Public for API access
  private queryRefiner: QueryRefiner;
  private llmClient: LLMClient;
  private defaultSchema: DatabaseSchema;

  constructor(llmClient: LLMClient, defaultSchema?: DatabaseSchema) {
    this.schemaRefiner = new SchemaRefiner();
    this.fewShotSelector = new FewShotSelector();
    this.queryRefiner = new QueryRefiner();
    this.llmClient = llmClient;
    
    // Default schema with common security tables
    this.defaultSchema = defaultSchema || this.createDefaultSchema();
  }

  /**
   * Main method: Convert natural language to KQL
   */
  async convert(request: NL2KQLRequest): Promise<NL2KQLResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Refine schema
      const refinedSchema = this.schemaRefiner.refineSchema(
        request.query,
        this.defaultSchema
      );

      // Step 2: Select few-shot examples
      const examples = this.fewShotSelector.selectExamples(
        request.query,
        request.database,
        3 // Top 3 examples
      );

      // Step 3: Generate KQL using LLM
      const llmResponse = await this.llmClient.generateKQL(
        request.query,
        {
          tables: refinedSchema.tables.map(t => t.name),
          columns: refinedSchema.columns.map(c => c.name)
        },
        examples.map(ex => ({ nlq: ex.nlq, kql: ex.kql }))
      );

      // Step 4: Refine generated query
      const refinementResult = this.queryRefiner.refineQuery(
        llmResponse.content,
        {
          tables: refinedSchema.tables.map(t => t.name),
          columns: refinedSchema.columns.map(c => c.name)
        }
      );

      const responseTime = Date.now() - startTime;

      return {
        success: refinementResult.isValid,
        kql: refinementResult.query,
        refinedSchema: {
          tables: refinedSchema.tables.map(t => t.name),
          columns: refinedSchema.columns.map(c => c.name)
        },
        examplesUsed: examples.length,
        refinements: refinementResult.attempts,
        metadata: {
          tokensUsed: llmResponse.tokensUsed,
          responseTime,
          confidence: refinementResult.isValid ? 0.9 : 0.7
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          responseTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Create default schema with common security tables
   */
  private createDefaultSchema(): DatabaseSchema {
    return {
      database: 'SecurityDatabase',
      tables: [
        {
          name: 'SecurityEvent',
          description: 'Security events from Windows computers, including authentication, authorization, and audit events',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Account', type: 'string' },
            { name: 'AccountType', type: 'string' },
            { name: 'Activity', type: 'string' },
            { name: 'Computer', type: 'string' },
            { name: 'EventID', type: 'int' },
            { name: 'EventResult', type: 'string' },
            { name: 'SourceIP', type: 'string' }
          ],
          domain: ['security', 'windows', 'authentication']
        },
        {
          name: 'EventLog',
          description: 'Windows event logs including system, application, and security events',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'Level', type: 'string' },
            { name: 'Message', type: 'string' },
            { name: 'Source', type: 'string' },
            { name: 'EventID', type: 'int' },
            { name: 'Computer', type: 'string' }
          ],
          domain: ['logs', 'windows', 'events']
        },
        {
          name: 'ProcessEvent',
          description: 'Process creation and termination events',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'EventType', type: 'string' },
            { name: 'ProcessName', type: 'string' },
            { name: 'CommandLine', type: 'string' },
            { name: 'Computer', type: 'string' },
            { name: 'User', type: 'string' }
          ],
          domain: ['process', 'security', 'monitoring']
        },
        {
          name: 'NetworkConnection',
          description: 'Network connection events including inbound and outbound connections',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'SourceIP', type: 'string' },
            { name: 'RemoteIP', type: 'string' },
            { name: 'Port', type: 'int' },
            { name: 'Protocol', type: 'string' },
            { name: 'Computer', type: 'string' }
          ],
          domain: ['network', 'security', 'connections']
        },
        {
          name: 'ThreatIntelligenceIndicator',
          description: 'Threat intelligence indicators including malicious IPs, domains, and hashes',
          columns: [
            { name: 'TimeGenerated', type: 'datetime' },
            { name: 'IPAddress', type: 'string' },
            { name: 'ThreatType', type: 'string' },
            { name: 'ThreatSeverity', type: 'string' },
            { name: 'Description', type: 'string' }
          ],
          domain: ['threat', 'security', 'intelligence']
        }
      ]
    };
  }

  /**
   * Update schema
   */
  updateSchema(schema: DatabaseSchema): void {
    this.defaultSchema = schema;
  }
}

