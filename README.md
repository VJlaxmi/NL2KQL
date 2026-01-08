# NL2KQL MVP - Proof of Concept

**Transform Natural Language to Kusto Query Language (KQL) using AI**

This is a minimal viable product (MVP) demonstrating the core NL2KQL framework based on Microsoft Research paper and production-ready patterns.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Azure OpenAI

Copy `.env.example` to `.env` and fill in your Azure OpenAI credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Azure OpenAI details:
```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 3. Build and Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or run in development mode (auto-reload)
npm run dev
```

### 4. Open Web UI

Navigate to: `http://localhost:3000`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web UI (Frontend)                      │
│  - Simple React/HTML interface                           │
│  - Natural language input                                │
│  - KQL output display                                    │
└────────────────────┬──────────────────────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (Express)                        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  NL2KQL Engine                                  │   │
│  │                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │   Schema     │  │   Few-shot   │            │   │
│  │  │   Refiner    │  │   Selector   │            │   │
│  │  └──────┬───────┘  └──────┬───────┘            │   │
│  │         │                  │                     │   │
│  │         └────────┬─────────┘                     │   │
│  │                  ▼                               │   │
│  │         ┌──────────────────┐                     │   │
│  │         │  Azure OpenAI    │                     │   │
│  │         │  (GPT-4)         │                     │   │
│  │         └────────┬─────────┘                     │   │
│  │                  ▼                               │   │
│  │         ┌──────────────────┐                     │   │
│  │         │  Query Refiner   │                     │   │
│  │         │  (Validation)     │                     │   │
│  │         └──────────────────┘                     │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

---

## 📋 Core Components

### 1. Schema Refiner
- Extracts entities from natural language queries
- Filters database schema to relevant tables/columns
- Reduces LLM context size and improves accuracy

### 2. Few-shot Selector
- Maintains database-specific example queries
- Selects relevant examples using similarity matching
- Provides context to LLM for better generation

### 3. Query Refiner
- Validates KQL syntax
- Checks semantic correctness against schema
- Applies automated fixes for common errors

### 4. LLM Integration
- Azure OpenAI GPT-4 for KQL generation
- Prompt engineering with schema and examples
- Temperature-controlled generation

---

## 🎯 Demo Examples

Try these natural language queries:

1. **"Show me all security events from the last hour"**
   - Expected: `SecurityEvent | where TimeGenerated > ago(1h)`

2. **"Find failed authentication attempts grouped by user"**
   - Expected: `SecurityEvent | where Activity == "Logon" and EventResult == "Failure" | summarize count() by Account`

3. **"List all tables in the database"**
   - Expected: `.show tables`

---

## 📊 Features

✅ **Schema Refinement** - Intelligent schema filtering  
✅ **Few-shot Learning** - Dynamic example selection  
✅ **Query Refinement** - Automated error correction  
✅ **Azure OpenAI** - Production-ready LLM integration  
✅ **Simple Web UI** - Easy-to-use interface  
✅ **REST API** - Programmatic access  

---

## 🔧 API Endpoints

### POST `/api/nl2kql`

Convert natural language to KQL.

**Request:**
```json
{
  "query": "Show me security events from the last hour",
  "database": "SecurityDatabase"
}
```

**Response:**
```json
{
  "success": true,
  "kql": "SecurityEvent | where TimeGenerated > ago(1h)",
  "refinedSchema": {
    "tables": ["SecurityEvent"],
    "columns": ["TimeGenerated", "EventID", "Account"]
  },
  "examplesUsed": 2,
  "refinements": 0
}
```

---

## 📈 Success Metrics

- **Syntax Correctness:** >90% valid KQL syntax
- **Schema Alignment:** >85% correct table/column names
- **Execution Ready:** >80% queries execute successfully
- **Response Time:** <5 seconds per query




