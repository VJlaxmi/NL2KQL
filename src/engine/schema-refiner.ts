/**
 * Schema Refiner - Filters database schema to relevant elements
 * Based on Research Paper: NL2KQL Framework
 */

import { DatabaseSchema, RefinedSchema, TableSchema, ColumnSchema } from '../types/schema.js';

export class SchemaRefiner {
  /**
   * Refine schema by extracting entities from NLQ and matching against schema
   */
  refineSchema(nlq: string, fullSchema: DatabaseSchema): RefinedSchema {
    // Extract entities from natural language query
    const entities = this.extractEntities(nlq);
    
    // Match entities against schema
    const tableMatches = this.matchTables(entities, fullSchema.tables);
    const columnMatches = this.matchColumns(entities, fullSchema.tables);
    
    // Rank by relevance
    const rankedTables = this.rankByRelevance(tableMatches);
    const rankedColumns = this.rankByRelevance(columnMatches);
    
    // Select top-k most relevant
    const topTables = this.selectTopK(rankedTables, 5); // Top 5 tables
    const topColumns = this.selectTopK(rankedColumns, 20); // Top 20 columns
    
    return {
      tables: topTables.map(t => t.item),
      columns: topColumns.map(c => c.item),
      relevance: this.computeOverallRelevance(rankedTables, rankedColumns)
    };
  }

  /**
   * Extract entities (keywords, concepts) from natural language query
   */
  private extractEntities(nlq: string): string[] {
    const lowerQuery = nlq.toLowerCase();
    const entities: string[] = [];
    
    // Common security/IT terms
    const domainTerms = [
      'security', 'event', 'log', 'authentication', 'authorization',
      'user', 'account', 'login', 'failed', 'success', 'error',
      'process', 'file', 'network', 'connection', 'threat', 'malware',
      'device', 'computer', 'server', 'client', 'ip', 'port',
      'time', 'date', 'hour', 'day', 'week', 'month', 'last', 'ago'
    ];
    
    // Extract domain terms
    domainTerms.forEach(term => {
      if (lowerQuery.includes(term)) {
        entities.push(term);
      }
    });
    
    // Extract quoted strings (likely table/column names)
    const quotedMatches = nlq.match(/"([^"]+)"/g);
    if (quotedMatches) {
      quotedMatches.forEach(match => {
        entities.push(match.replace(/"/g, ''));
      });
    }
    
    // Extract capitalized words (likely proper nouns/table names)
    const capitalizedWords = nlq.match(/\b[A-Z][a-z]+\b/g);
    if (capitalizedWords) {
      capitalizedWords.forEach(word => {
        if (word.length > 3) { // Filter out short words
          entities.push(word.toLowerCase());
        }
      });
    }
    
    // Remove duplicates and return
    return [...new Set(entities)];
  }

  /**
   * Match entities against tables
   */
  private matchTables(entities: string[], tables: TableSchema[]): Array<{item: TableSchema, score: number}> {
    return tables.map(table => {
      let score = 0;
      
      // Check table name
      const tableNameLower = table.name.toLowerCase();
      entities.forEach(entity => {
        if (tableNameLower.includes(entity) || entity.includes(tableNameLower)) {
          score += 10;
        }
      });
      
      // Check description
      if (table.description) {
        const descLower = table.description.toLowerCase();
        entities.forEach(entity => {
          if (descLower.includes(entity)) {
            score += 5;
          }
        });
      }
      
      // Check domain tags
      if (table.domain) {
        table.domain.forEach(domain => {
          if (entities.includes(domain.toLowerCase())) {
            score += 3;
          }
        });
      }
      
      // Check column names in table
      table.columns.forEach(column => {
        const colNameLower = column.name.toLowerCase();
        entities.forEach(entity => {
          if (colNameLower.includes(entity)) {
            score += 2;
          }
        });
      });
      
      return { item: table, score };
    });
  }

  /**
   * Match entities against columns
   */
  private matchColumns(entities: string[], tables: TableSchema[]): Array<{item: ColumnSchema, score: number}> {
    const allColumns: Array<{item: ColumnSchema, score: number}> = [];
    
    tables.forEach(table => {
      table.columns.forEach(column => {
        let score = 0;
        const colNameLower = column.name.toLowerCase();
        
        entities.forEach(entity => {
          if (colNameLower.includes(entity) || entity.includes(colNameLower)) {
            score += 5;
          }
        });
        
        if (column.description) {
          const descLower = column.description.toLowerCase();
          entities.forEach(entity => {
            if (descLower.includes(entity)) {
              score += 3;
            }
          });
        }
        
        allColumns.push({ item: column, score });
      });
    });
    
    return allColumns;
  }

  /**
   * Rank items by relevance score
   */
  private rankByRelevance<T>(matches: Array<{item: T, score: number}>): Array<{item: T, score: number}> {
    return matches
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Select top-k items
   */
  private selectTopK<T>(ranked: Array<{item: T, score: number}>, k: number): Array<{item: T, score: number}> {
    return ranked.slice(0, k);
  }

  /**
   * Compute overall relevance score
   */
  private computeOverallRelevance(
    tableMatches: Array<{item: TableSchema, score: number}>,
    columnMatches: Array<{item: ColumnSchema, score: number}>
  ): number {
    const topTableScore = tableMatches[0]?.score || 0;
    const topColumnScore = columnMatches[0]?.score || 0;
    return (topTableScore + topColumnScore) / 2;
  }
}

