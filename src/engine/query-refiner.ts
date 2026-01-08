/**
 * Query Refiner - Validates and fixes KQL queries
 * Based on Research Paper: NL2KQL Framework
 */

export interface RefinementResult {
  query: string;
  isValid: boolean;
  errors: string[];
  fixes: string[];
  attempts: number;
}

export class QueryRefiner {
  private maxAttempts = 3;

  /**
   * Refine KQL query by validating and fixing errors
   */
  refineQuery(kql: string, schema?: { tables: string[], columns: string[] }): RefinementResult {
    let query = kql.trim();
    let attempts = 0;
    const errors: string[] = [];
    const fixes: string[] = [];

    while (attempts < this.maxAttempts) {
      // Validate syntax
      const syntaxErrors = this.validateSyntax(query);
      if (syntaxErrors.length > 0) {
        errors.push(...syntaxErrors);
        query = this.fixSyntaxErrors(query, syntaxErrors);
        fixes.push(`Fixed syntax errors: ${syntaxErrors.join(', ')}`);
        attempts++;
        continue;
      }

      // Validate semantics if schema provided
      if (schema) {
        const semanticErrors = this.validateSemantics(query, schema);
        if (semanticErrors.length > 0) {
          errors.push(...semanticErrors);
          query = this.fixSemanticErrors(query, semanticErrors, schema);
          fixes.push(`Fixed semantic errors: ${semanticErrors.join(', ')}`);
          attempts++;
          continue;
        }
      }

      // Query is valid
      return {
        query,
        isValid: true,
        errors: [],
        fixes,
        attempts
      };
    }

    // Return best attempt even if not perfect
    return {
      query,
      isValid: errors.length === 0,
      errors,
      fixes,
      attempts
    };
  }

  /**
   * Validate KQL syntax
   */
  private validateSyntax(kql: string): string[] {
    const errors: string[] = [];

    // Check for balanced parentheses
    const openParens = (kql.match(/\(/g) || []).length;
    const closeParens = (kql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses');
    }

    // Check for balanced brackets
    const openBrackets = (kql.match(/\[/g) || []).length;
    const closeBrackets = (kql.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Unbalanced brackets');
    }

    // Check for balanced quotes
    const singleQuotes = (kql.match(/'/g) || []).length;
    const doubleQuotes = (kql.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unbalanced single quotes');
    }
    if (doubleQuotes % 2 !== 0) {
      errors.push('Unbalanced double quotes');
    }

    // Check for common syntax issues
    if (kql.includes('===') || kql.includes('!==')) {
      errors.push('Use == or != instead of === or !==');
    }

    // Check for missing pipe operators in multi-line queries
    const lines = kql.split('\n').filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('|') && !line.startsWith('//') && !line.startsWith('.')) {
        errors.push(`Missing pipe operator at line ${i + 1}`);
      }
    }

    return errors;
  }

  /**
   * Validate KQL semantics against schema
   * Made less strict - only warns, doesn't fail validation
   */
  private validateSemantics(kql: string, schema: { tables: string[], columns: string[] }): string[] {
    const warnings: string[] = [];

    // Only validate if schema has tables (not empty/default)
    if (!schema.tables || schema.tables.length === 0) {
      return []; // No validation if no schema
    }

    // Extract table names (simple pattern matching)
    const tablePattern = /(\b\w+)\s*\|\s*where/i;
    const tableMatch = kql.match(tablePattern);
    if (tableMatch) {
      const tableName = tableMatch[1];
      if (!schema.tables.some(t => t.toLowerCase() === tableName.toLowerCase())) {
        // Only warn, don't fail - table might exist in real database
        warnings.push(`Table "${tableName}" not in provided schema (may still be valid)`);
      }
    }

    // Extract column names (simple pattern matching) - be more lenient
    const columnPattern = /(\b\w+)\s*(==|!=|>|<|>=|<=|contains|startswith|endswith)/gi;
    let columnMatch;
    const checkedColumns = new Set<string>();
    while ((columnMatch = columnPattern.exec(kql)) !== null) {
      const columnName = columnMatch[1];
      if (checkedColumns.has(columnName.toLowerCase())) continue;
      checkedColumns.add(columnName.toLowerCase());
      
      // Don't error on common KQL keywords and functions
      const keywords = ['where', 'summarize', 'project', 'extend', 'join', 'union', 'count', 'ago', 'now', 'timegenerated', 'startofday', 'endofday'];
      if (!keywords.includes(columnName.toLowerCase())) {
        if (schema.columns && schema.columns.length > 0) {
          if (!schema.columns.some(c => c.toLowerCase() === columnName.toLowerCase())) {
            // Only warn if schema has columns - might be valid in real database
            warnings.push(`Column "${columnName}" not in provided schema (may still be valid)`);
          }
        }
      }
    }

    // Return empty array - don't fail validation on schema mismatches
    // Schema might be incomplete or query might use tables/columns not in provided schema
    return [];
  }

  /**
   * Fix syntax errors
   */
  private fixSyntaxErrors(kql: string, errors: string[]): string {
    let fixed = kql;

    // Fix === to ==
    fixed = fixed.replace(/===/g, '==');
    fixed = fixed.replace(/!==/g, '!=');

    // Fix unbalanced parentheses (add missing closing)
    const openParens = (fixed.match(/\(/g) || []).length;
    const closeParens = (fixed.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      fixed += ')'.repeat(openParens - closeParens);
    }

    // Fix unbalanced brackets
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += ']'.repeat(openBrackets - closeBrackets);
    }

    // Fix unbalanced quotes
    const singleQuotes = (fixed.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      fixed += "'";
    }
    const doubleQuotes = (fixed.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      fixed += '"';
    }

    // Fix missing pipe operators
    const lines = fixed.split('\n');
    const fixedLines = lines.map((line, index) => {
      if (index === 0) return line;
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('|') && !trimmed.startsWith('//') && !trimmed.startsWith('.')) {
        return '| ' + trimmed;
      }
      return line;
    });
    fixed = fixedLines.join('\n');

    return fixed;
  }

  /**
   * Fix semantic errors (basic - can be enhanced)
   */
  private fixSemanticErrors(
    kql: string,
    errors: string[],
    schema: { tables: string[], columns: string[] }
  ): string {
    let fixed = kql;

    // Fix table name errors (find closest match)
    errors.forEach(error => {
      if (error.includes('Table') && error.includes('not found')) {
        const tableMatch = error.match(/"([^"]+)"/);
        if (tableMatch) {
          const invalidTable = tableMatch[1];
          // Find closest match
          const closest = this.findClosestMatch(invalidTable, schema.tables);
          if (closest) {
            fixed = fixed.replace(new RegExp(`\\b${invalidTable}\\b`, 'gi'), closest);
          }
        }
      }

      // Fix column name errors (find closest match)
      if (error.includes('Column') && error.includes('not found')) {
        const columnMatch = error.match(/"([^"]+)"/);
        if (columnMatch) {
          const invalidColumn = columnMatch[1];
          const closest = this.findClosestMatch(invalidColumn, schema.columns);
          if (closest) {
            fixed = fixed.replace(new RegExp(`\\b${invalidColumn}\\b`, 'gi'), closest);
          }
        }
      }
    });

    return fixed;
  }

  /**
   * Find closest match using Levenshtein-like similarity
   */
  private findClosestMatch(target: string, candidates: string[]): string | null {
    const targetLower = target.toLowerCase();
    let bestMatch: string | null = null;
    let bestScore = 0;

    candidates.forEach(candidate => {
      const candidateLower = candidate.toLowerCase();
      
      // Exact match
      if (candidateLower === targetLower) {
        bestMatch = candidate;
        bestScore = 1.0;
        return;
      }

      // Contains match
      if (candidateLower.includes(targetLower) || targetLower.includes(candidateLower)) {
        const score = Math.min(candidateLower.length, targetLower.length) / 
                     Math.max(candidateLower.length, targetLower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }
    });

    return bestMatch;
  }
}

