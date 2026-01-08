/**
 * Few-shot Selector - Dynamically selects relevant examples
 * Based on Research Paper: NL2KQL Framework
 */

import { Example } from '../types/schema.js';

export class FewShotSelector {
  private examples: Example[] = [];

  constructor() {
    // Initialize with default examples from research paper
    this.initializeDefaultExamples();
  }

  /**
   * Select relevant examples based on NLQ similarity
   */
  selectExamples(nlq: string, database?: string, k: number = 3): Example[] {
    // Filter by database if specified
    const candidateExamples = database
      ? this.examples.filter(ex => ex.database === database)
      : this.examples;

    // Compute similarity scores
    const scoredExamples = candidateExamples.map(example => ({
      example,
      score: this.computeSimilarity(nlq, example.nlq)
    }));

    // Sort by score and select top-k
    const selected = scoredExamples
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(item => item.example);

    return selected;
  }

  /**
   * Add example to the database
   */
  addExample(example: Example): void {
    this.examples.push(example);
  }

  /**
   * Get all examples
   */
  getAllExamples(): Example[] {
    return this.examples;
  }

  /**
   * Compute similarity between two NLQs
   * Simple keyword-based similarity (can be enhanced with embeddings)
   */
  private computeSimilarity(nlq1: string, nlq2: string): number {
    const words1 = this.tokenize(nlq1);
    const words2 = this.tokenize(nlq2);

    // Jaccard similarity
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];

    if (union.length === 0) return 0;

    const jaccard = intersection.length / union.length;

    // Boost score for exact phrase matches
    const exactMatch = nlq1.toLowerCase().includes(nlq2.toLowerCase()) ||
                      nlq2.toLowerCase().includes(nlq1.toLowerCase());
    const exactMatchBoost = exactMatch ? 0.3 : 0;

    return Math.min(1.0, jaccard + exactMatchBoost);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2); // Filter out short words
  }

  /**
   * Initialize with default examples from research paper
   */
  private initializeDefaultExamples(): void {
    this.examples = [
      {
        nlq: "Show me all security events from the last hour",
        kql: "SecurityEvent | where TimeGenerated > ago(1h)",
        database: "SecurityDatabase",
        tags: ["security", "time", "filter"]
      },
      {
        nlq: "Find all failed authentication attempts grouped by user",
        kql: "SecurityEvent | where Activity == \"Logon\" and EventResult == \"Failure\" | summarize count() by Account",
        database: "SecurityDatabase",
        tags: ["security", "authentication", "aggregation"]
      },
      {
        nlq: "List all tables in the database",
        kql: ".show tables",
        database: "SecurityDatabase",
        tags: ["metadata", "tables"]
      },
      {
        nlq: "Show me error logs from the last 24 hours",
        kql: "EventLog | where Level == \"Error\" and TimeGenerated > ago(24h)",
        database: "SecurityDatabase",
        tags: ["logs", "error", "time"]
      },
      {
        nlq: "Count the number of unique users who logged in today",
        kql: "SecurityEvent | where Activity == \"Logon\" and TimeGenerated > startofday(now()) | summarize dcount(Account)",
        database: "SecurityDatabase",
        tags: ["security", "aggregation", "count"]
      },
      {
        nlq: "Find all processes that were started in the last hour",
        kql: "ProcessEvent | where EventType == \"ProcessStart\" and TimeGenerated > ago(1h)",
        database: "SecurityDatabase",
        tags: ["process", "time", "filter"]
      },
      {
        nlq: "Show me network connections to suspicious IP addresses",
        kql: "NetworkConnection | where RemoteIP in (ThreatIntelligenceIndicator | where ThreatType == \"MaliciousIP\" | project IPAddress)",
        database: "SecurityDatabase",
        tags: ["network", "threat", "join"]
      },
      {
        nlq: "Get the top 10 most active users by login count",
        kql: "SecurityEvent | where Activity == \"Logon\" | summarize count() by Account | top 10 by count_",
        database: "SecurityDatabase",
        tags: ["security", "aggregation", "top"]
      }
    ];
  }
}

