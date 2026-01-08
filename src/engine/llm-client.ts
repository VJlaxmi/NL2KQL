/**
 * LLM Client - Azure OpenAI integration for KQL generation
 * Uses standard OpenAI SDK (compatible with Azure OpenAI)
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

export interface LLMConfig {
  endpoint: string;
  apiKey?: string;
  deploymentName: string;
  apiVersion: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
  finishReason?: string;
}

export class LLMClient {
  private client: OpenAI | null = null;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeClient();
  }

  /**
   * Initialize Azure OpenAI client using standard OpenAI SDK
   */
  private initializeClient(): void {
    try {
      if (!this.config.apiKey) {
        throw new Error('API key is required');
      }

      // Use standard OpenAI SDK with Azure OpenAI endpoint
      // Handle both standard Azure OpenAI and Azure AI Services (projects) endpoints
      let baseURL: string;
      
      // Ensure endpoint ends with /
      const endpoint = this.config.endpoint.endsWith('/') 
        ? this.config.endpoint 
        : `${this.config.endpoint}/`;
      
      if (endpoint.includes('/api/projects/')) {
        // Azure AI Services format: https://resource.services.ai.azure.com/api/projects/project-name
        // Full path: /api/projects/{project}/openai/deployments/{deployment}
        baseURL = `${endpoint}openai/deployments/${this.config.deploymentName}`;
      } else {
        // Standard Azure OpenAI format: https://resource.openai.azure.com/
        // Full path: https://resource.openai.azure.com/openai/deployments/{deployment}
        baseURL = `${endpoint}openai/deployments/${this.config.deploymentName}`;
      }

      // For Azure AI Services, use api-key header
      // For standard Azure OpenAI, also use api-key
      const headers: Record<string, string> = {
        'api-key': this.config.apiKey,
      };

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: baseURL,
        defaultQuery: { 'api-version': this.config.apiVersion },
        defaultHeaders: headers,
      });
    } catch (error) {
      console.error('Failed to initialize Azure OpenAI client:', error);
      throw error;
    }
  }

  /**
   * Generate KQL query from natural language
   */
  async generateKQL(
    nlq: string,
    refinedSchema: { tables: string[], columns: string[] },
    examples: Array<{ nlq: string, kql: string }>
  ): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Azure OpenAI client not initialized');
    }

    // Build prompt
    const prompt = this.buildPrompt(nlq, refinedSchema, examples);

    try {
      // For Azure OpenAI, the model parameter should match the deployment name
      // The actual deployment is specified in the baseURL
      const modelParam = this.config.deploymentName;

      const response = await this.client.chat.completions.create({
        model: modelParam,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in Kusto Query Language (KQL). Generate valid KQL queries based on natural language requests. Always return only the KQL query without any explanation or markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for more deterministic output
        max_tokens: 1000,
        top_p: 0.95,
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const finishReason = response.choices[0]?.finish_reason || '';

      return {
        content: content.trim(),
        tokensUsed,
        finishReason
      };
    } catch (error) {
      console.error('Error generating KQL:', error);
      throw new Error(`Failed to generate KQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build prompt with schema and examples
   */
  private buildPrompt(
    nlq: string,
    refinedSchema: { tables: string[], columns: string[] },
    examples: Array<{ nlq: string, kql: string }>
  ): string {
    let prompt = `Generate a KQL query for the following natural language request:\n\n"${nlq}"\n\n`;

    // Add schema information
    if (refinedSchema.tables.length > 0) {
      prompt += `Available tables: ${refinedSchema.tables.join(', ')}\n`;
    }
    if (refinedSchema.columns.length > 0) {
      prompt += `Available columns: ${refinedSchema.columns.slice(0, 30).join(', ')}${refinedSchema.columns.length > 30 ? '...' : ''}\n`;
    }

    // Add few-shot examples
    if (examples.length > 0) {
      prompt += `\nExamples:\n`;
      examples.forEach((ex, index) => {
        prompt += `\nExample ${index + 1}:\n`;
        prompt += `Natural Language: "${ex.nlq}"\n`;
        prompt += `KQL: ${ex.kql}\n`;
      });
    }

    prompt += `\nGenerate the KQL query for: "${nlq}"\n`;
    prompt += `Return only the KQL query, no explanations or markdown.`;

    return prompt;
  }

  /**
   * Create client from environment variables
   */
  static fromEnvironment(): LLMClient {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

    if (!endpoint) {
      throw new Error('AZURE_OPENAI_ENDPOINT environment variable is required');
    }

    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY environment variable is required');
    }

    return new LLMClient({
      endpoint,
      apiKey,
      deploymentName,
      apiVersion
    });
  }
}
