/**
 * Express server for NL2KQL API
 */

import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { LLMClient } from './engine/llm-client.js';
import { NL2KQLEngine } from './engine/nl2kql-engine.js';
import { NL2KQLRequest } from './types/nl2kql.js';
import { KustoConnectionService } from './services/kusto-connection.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Kusto Connection
// Uses public demo cluster by default (help.kusto.windows.net/Samples)
let kustoConnection: KustoConnectionService | null = null;
let kustoInitialized = false;

try {
  // Always try to connect - uses public demo cluster if not configured
  kustoConnection = KustoConnectionService.fromEnvironment();
  kustoConnection.initialize().then(() => {
    kustoInitialized = true;
    console.log('✅ Kusto connection initialized successfully');
    console.log('   Using public demo cluster: help.kusto.windows.net/Samples');
  }).catch((error) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('⚠️  Kusto connection failed (will use default schema):', errorMsg);
    
    // Check for specific resource errors
    if (errorMsg.includes('InsufficientResourcesForSubscription') || 
        errorMsg.includes('no available resources')) {
      console.warn('');
      console.warn('💡 Cluster Resource Issue Detected:');
      console.warn('   - Your cluster may be paused or has no available resources');
      console.warn('   - Falling back to public demo cluster...');
      console.warn('');
      
      // Try public demo cluster as fallback
      try {
        const publicDemo = KustoConnectionService.fromPublicDemo();
        publicDemo.initialize().then(() => {
          kustoConnection = publicDemo;
          kustoInitialized = true;
          console.log('✅ Connected to public demo cluster successfully!');
        }).catch(() => {
          console.warn('   Using default schema - POC still fully functional!');
        });
      } catch (e) {
        console.warn('   Using default schema - POC still fully functional!');
      }
    } else {
      console.warn('   The POC will work with default schema - you can still demo NL2KQL!');
    }
  });
} catch (error) {
  console.warn('⚠️  Kusto initialization error (will use default schema):', error);
  console.log('   The POC will work with default schema - NL2KQL framework is fully functional!');
}

// Initialize NL2KQL Engine
let nl2kqlEngine: NL2KQLEngine;

try {
  const llmClient = LLMClient.fromEnvironment();
  nl2kqlEngine = new NL2KQLEngine(llmClient);
  console.log('✅ NL2KQL Engine initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize NL2KQL Engine:', error);
  console.error('Please check your Azure OpenAI configuration in .env file');
  process.exit(1);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get schema from Kusto (if connected)
app.get('/api/schema', async (req, res) => {
  try {
    if (!kustoConnection || !kustoInitialized) {
      return res.status(503).json({
        error: 'Kusto connection not available. Configure KUSTO_CLUSTER_URL and KUSTO_DATABASE in .env'
      });
    }

    const schema = await kustoConnection.getDatabaseSchema();
    res.json(schema);
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch schema'
    });
  }
});

// Execute KQL query
app.post('/api/execute', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "query" field'
      });
    }

    if (!kustoConnection || !kustoInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Kusto connection not available. Configure KUSTO_CLUSTER_URL and KUSTO_DATABASE in .env'
      });
    }

    const result = await kustoConnection.executeQuery(query);
    res.json({
      success: true,
      result: result.primaryResults[0] || { columns: [], rows: [] }
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed'
    });
  }
});

// Main NL2KQL endpoint
app.post('/api/nl2kql', async (req, res) => {
  try {
    const request: NL2KQLRequest = req.body;

    // Validate request
    if (!request.query || typeof request.query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "query" field in request body'
      });
    }

    // Fetch real schema from Kusto if available, otherwise use default
    if (kustoConnection && kustoInitialized && request.database) {
      try {
        const realSchema = await kustoConnection.getDatabaseSchema();
        // Update engine with real schema
        nl2kqlEngine.updateSchema({
          database: request.database || kustoConnection.getDatabase(),
          tables: realSchema.tables.map(t => ({
            name: t.name,
            description: '',
            columns: t.columns.map(c => ({
              name: c.name,
              type: c.type
            })),
            domain: []
          }))
        });
        console.log(`✅ Using real schema from Kusto (${realSchema.tables.length} tables)`);
      } catch (error) {
        console.warn('⚠️  Failed to fetch real schema, using default:', error);
      }
    }

    // Convert NL to KQL
    const response = await nl2kqlEngine.convert(request);

    res.json(response);
  } catch (error) {
    console.error('Error processing NL2KQL request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get examples endpoint
app.get('/api/examples', (req, res) => {
  try {
    // Access few-shot selector through public method
    const examples = (nl2kqlEngine as any).fewShotSelector?.getAllExamples() || [];
    res.json({ examples });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NL2KQL Server running on http://localhost:${PORT}`);
  console.log(`📝 Web UI available at http://localhost:${PORT}`);
  console.log(`🔌 API endpoint: http://localhost:${PORT}/api/nl2kql`);
});

