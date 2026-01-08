# NL2KQL Project - Complete Summary

## 🎯 What We Built

We built a **working Proof-of-Concept (MVP)** for an AI-powered system that converts **Natural Language queries into Kusto Query Language (KQL)**. This is designed for Microsoft CDO Security Operations teams who need to investigate security incidents, hunt threats, and analyze data across multiple Kusto clusters.

---

## 📋 Project Overview

### The Problem We're Solving

Security operations teams at Microsoft CDO face these challenges:
- **Steep learning curve**: New engineers must learn KQL syntax and complex schemas
- **Fragmented knowledge**: Effective queries exist only in personal notebooks and memory
- **Manual debugging**: Query failures require trial-and-error, slowing incident response
- **No unified intelligence**: No system learns from past investigations across clusters

### Our Solution

An **AI-assisted platform** that:
- ✅ Converts natural language to valid KQL automatically
- ✅ Understands database schemas and selects relevant tables/columns
- ✅ Learns from example queries to improve accuracy
- ✅ Validates and fixes generated queries
- ✅ Provides a simple web interface for non-technical users

---

## 🏗️ Architecture & Components

We implemented a **three-component framework** based on Microsoft Research paper "NL2KQL: From Natural Language to Kusto Query":

### 1. **Schema Refiner** (`src/engine/schema-refiner.ts`)
**Purpose**: Reduces the database schema to only relevant tables and columns for the query.

**How it works**:
- Extracts entities (keywords, table names, column names) from the natural language query
- Matches these entities against the full database schema
- Returns a filtered "refined schema" containing only relevant tables and columns
- **Benefit**: Reduces LLM context size, improves accuracy, and speeds up generation

**Example**:
```
Input Query: "Show me security events from the last hour"
Extracted Entities: ["security", "events", "time"]
Refined Schema: { tables: ["SecurityEvent"], columns: ["TimeGenerated", "Activity", "EventResult"] }
```

### 2. **Few-shot Selector** (`src/engine/few-shot-selector.ts`)
**Purpose**: Selects relevant example queries to guide the LLM in generating correct KQL.

**How it works**:
- Maintains a database of example NLQ-KQL pairs (natural language → KQL mappings)
- Uses similarity matching (keyword overlap, semantic similarity) to find relevant examples
- Selects top 3-5 examples most similar to the user's query
- **Benefit**: Provides context to the LLM, improving accuracy for domain-specific queries

**Example**:
```
User Query: "Find failed logon attempts"
Selected Examples:
  - "Show authentication failures" → SecurityEvent | where Activity == "Logon" and EventResult == "Failure"
  - "List all failed logins" → SecurityEvent | where EventResult == "Failure" | summarize count() by Account
```

### 3. **Query Refiner** (`src/engine/query-refiner.ts`)
**Purpose**: Validates and fixes generated KQL queries before returning them.

**How it works**:
- **Syntax Validation**: Checks for balanced parentheses, valid operators, proper pipe usage
- **Semantic Validation**: Verifies table/column names exist in schema (non-blocking warnings)
- **Auto-fixing**: Attempts to fix common errors (e.g., `===` → `==`, missing pipes)
- **Benefit**: Ensures generated queries are syntactically correct and more likely to execute

**Example**:
```
Generated: "SecurityEvent | where TimeGenerated > ago(1h"
Fixed: "SecurityEvent | where TimeGenerated > ago(1h)"  // Added closing parenthesis
```

### 4. **LLM Integration** (`src/engine/llm-client.ts`)
**Purpose**: Uses Azure OpenAI (GPT-4) to generate KQL from natural language.

**How it works**:
- Constructs a prompt with:
  - System message: "You are a KQL expert"
  - User prompt: Natural language query + refined schema + few-shot examples
- Calls Azure OpenAI API with temperature=0.1 (deterministic)
- Returns generated KQL query
- **Benefit**: Leverages GPT-4's understanding of natural language and KQL syntax

### 5. **NL2KQL Engine** (`src/engine/nl2kql-engine.ts`)
**Purpose**: Orchestrates all components in the correct sequence.

**Flow**:
```
1. User Query (Natural Language)
   ↓
2. Schema Refiner → Filter schema to relevant tables/columns
   ↓
3. Few-shot Selector → Find similar example queries
   ↓
4. LLM Client → Generate KQL using refined schema + examples
   ↓
5. Query Refiner → Validate and fix the generated KQL
   ↓
6. Return: { success, kql, metadata }
```

---

## 🔌 Integration Components

### **Kusto Connection Service** (`src/services/kusto-connection.ts`)
**Purpose**: Connects to Azure Data Explorer (Kusto) to fetch real schemas and execute queries.

**Features**:
- Connects to Kusto clusters using Azure authentication
- Fetches database schema using `.show schema as json`
- Executes KQL queries and returns results
- Falls back to default schema if connection fails (POC still works!)

**Authentication Methods**:
- Azure CLI (`az login`)
- Managed Identity
- Default Azure Credential (tries multiple methods)

### **Express Backend** (`src/server.ts`)
**Purpose**: REST API server that handles HTTP requests.

**Endpoints**:
- `POST /api/nl2kql` - Convert natural language to KQL
- `GET /api/health` - Health check
- `GET /api/examples` - Get example queries
- `GET /api/schema` - Get database schema (if Kusto connected)
- `POST /api/execute` - Execute KQL query (if Kusto connected)

### **Web UI** (`public/index.html`)
**Purpose**: Simple, user-friendly interface for non-technical users.

**Features**:
- Natural language input field
- Generated KQL display
- Metadata display (tables used, tokens, response time)
- Example queries showcase
- Error handling with helpful messages

---

## 📁 Project Structure

```
Nl2Kql/
├── src/
│   ├── engine/              # Core NL2KQL framework
│   │   ├── schema-refiner.ts      # Filters schema
│   │   ├── few-shot-selector.ts   # Selects examples
│   │   ├── query-refiner.ts       # Validates/fixes queries
│   │   ├── llm-client.ts          # Azure OpenAI integration
│   │   └── nl2kql-engine.ts       # Main orchestrator
│   ├── services/
│   │   └── kusto-connection.ts     # Azure Data Explorer integration
│   ├── types/
│   │   ├── schema.ts              # Schema type definitions
│   │   └── nl2kql.ts              # Request/response types
│   └── server.ts                  # Express API server
├── public/
│   └── index.html                 # Web UI
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── .env                           # Environment variables
```

---

## 🚀 How It Works (End-to-End)

### Example: "Show me all security events from the last hour"

1. **User Input**: User types natural language query in web UI
2. **API Request**: Frontend sends POST to `/api/nl2kql`
3. **Schema Refinement**:
   - Extracts keywords: ["security", "events", "time", "hour"]
   - Matches against schema → Finds `SecurityEvent` table
   - Returns refined schema: `{ tables: ["SecurityEvent"], columns: ["TimeGenerated", ...] }`
4. **Few-shot Selection**:
   - Finds similar examples like "Show events from last 24 hours"
   - Selects top 3 examples
5. **LLM Generation**:
   - Constructs prompt with query + schema + examples
   - Calls Azure OpenAI GPT-4
   - Returns: `SecurityEvent | where TimeGenerated > ago(1h)`
6. **Query Refinement**:
   - Validates syntax ✅
   - Checks semantics ✅
   - No fixes needed
7. **Response**:
   ```json
   {
     "success": true,
     "kql": "SecurityEvent | where TimeGenerated > ago(1h)",
     "refinedSchema": { "tables": ["SecurityEvent"], "columns": [...] },
     "examplesUsed": 3,
     "metadata": { "tokensUsed": 267, "responseTime": 1454 }
   }
   ```
8. **Display**: Frontend shows generated KQL and metadata

---

## 🛠️ Technologies Used

### Backend
- **TypeScript** - Type-safe development
- **Express.js** - REST API framework
- **Azure OpenAI** - GPT-4 for KQL generation
- **Azure Data Explorer SDK** - Kusto connection (`azure-kusto-data`)
- **Azure Identity** - Authentication (`@azure/identity`)

### Frontend
- **HTML/CSS/JavaScript** - Simple, no-framework UI
- **Fetch API** - HTTP requests to backend

### Development
- **TypeScript Compiler** - Build tool
- **tsx** - Development server with hot reload
- **dotenv** - Environment variable management

---

## ✅ What's Working

1. **✅ Natural Language to KQL Conversion**
   - Successfully converts queries like "Show me security events from the last hour"
   - Generates syntactically correct KQL

2. **✅ Schema Refinement**
   - Filters database schema to relevant tables/columns
   - Reduces LLM context and improves accuracy

3. **✅ Few-shot Learning**
   - Selects relevant examples based on query similarity
   - Improves generation quality for domain-specific queries

4. **✅ Query Validation**
   - Validates KQL syntax
   - Provides helpful error messages

5. **✅ Azure OpenAI Integration**
   - Successfully connects to Azure OpenAI
   - Uses GPT-4 for KQL generation
   - Handles both standard and Azure AI Services endpoints

6. **✅ Web UI**
   - Simple, intuitive interface
   - Displays generated KQL and metadata
   - Shows warnings for minor validation issues

7. **✅ Kusto Connection (Optional)**
   - Can connect to Azure Data Explorer
   - Fetches real database schemas
   - Falls back gracefully if connection fails

---

## ⚠️ Current Limitations (MVP Scope)

1. **Kusto Authentication**: Requires `az login` for real cluster access (public demo cluster available)
2. **Query Execution**: Can generate KQL but execution requires authenticated Kusto connection
3. **Error Recovery**: Basic error fixing (can be enhanced)
4. **Multi-cluster**: Single cluster support (can be extended)
5. **Conversation History**: No memory of previous queries (can be added)

---

## 🎯 Key Achievements

1. **✅ Working POC**: Fully functional MVP that demonstrates core NL2KQL concept
2. **✅ Research-Based**: Implements framework from Microsoft Research paper
3. **✅ Production Patterns**: Uses patterns from `kusto-mcp` and `mcp_kusto` repositories
4. **✅ Azure Integration**: Real Azure OpenAI and Azure Data Explorer integration
5. **✅ User-Friendly**: Simple web UI that non-technical users can use
6. **✅ Extensible**: Clean architecture allows easy addition of features

---

## 📊 Example Usage

### Input:
```
"Find failed authentication attempts grouped by user"
```

### Output:
```kql
SecurityEvent 
| where Activity == "Logon" and EventResult == "Failure" 
| summarize count() by Account
```

### Metadata:
- Tables used: SecurityEvent
- Columns considered: 15
- Examples used: 3
- Tokens used: 312
- Response time: 1.2s
- Confidence: 90%

---

## 🔮 Future Enhancements (Beyond MVP)

1. **Query Execution**: Execute generated KQL and display results
2. **Multi-cluster Support**: Query across multiple Kusto clusters
3. **Conversation Context**: Remember previous queries in a session
4. **Advanced Error Recovery**: Use LLM to fix complex query errors
5. **Cross-cluster Learning**: Learn from queries across all CDO clusters
6. **Actionable Insights**: Suggest next steps based on query results
7. **Query Optimization**: Suggest performance improvements
8. **User Feedback Loop**: Learn from user corrections

---

## 📚 References & Inspiration

1. **Research Paper**: "NL2KQL: From Natural Language to Kusto Query" (Microsoft Research)
2. **kusto-mcp Repository**: TypeScript MCP server for Kusto (used for patterns)
3. **mcp_kusto Repository**: Go MCP server for Kusto (reference implementation)
4. **Project Requirements**: `project.txt` - Original PRD for the platform

---

## 🎓 What Makes This Special

1. **Not Just a Simple LLM Call**: Uses sophisticated three-component framework
2. **Schema-Aware**: Understands database structure, not just text-to-text conversion
3. **Learning from Examples**: Few-shot selection improves accuracy
4. **Production-Ready Patterns**: Based on real-world implementations
5. **Azure-Native**: Built specifically for Azure Data Explorer ecosystem
6. **Extensible Architecture**: Easy to add features like multi-cluster, conversation history, etc.

---

## 🚀 Getting Started

1. **Install**: `npm install`
2. **Configure**: Set Azure OpenAI credentials in `.env`
3. **Build**: `npm run build`
4. **Run**: `npm start`
5. **Open**: `http://localhost:3000`

---

**This MVP successfully demonstrates the core NL2KQL concept and provides a solid foundation for building the full AI-assisted Kusto IDE platform!** 🎉

