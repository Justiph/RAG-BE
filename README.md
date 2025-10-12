# RAG System Backend

A RAG (Retrieval-Augmented Generation) system capable of extracting and searching information from PDF documents, using ChromaDB as vector store and OpenAI to generate answers.

## System Architecture

The project consists of 3 microservices:

- **ChromaDB**: Vector database for storing embeddings
- **Python Extractor**: Service for extracting content from PDFs and generating embeddings
- **TypeScript Backend**: Main API server handling upload, query, and question answering

## Directory Structure

```
├── docker-compose.yml          # Docker services configuration
├── chroma_data/               # ChromaDB data (auto-generated)
├── python-extractor/          # Python service for PDF extraction and embedding
│   ├── app.py                 # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── Dockerfile            # Docker image for Python service
└── ts-backend/               # TypeScript API server
    ├── src/
    │   ├── server.ts         # Fastify server
    │   ├── routes.ts         # API routes
    │   ├── preprocess.ts     # Semantic chunking logic
    │   ├── vectorstore.ts    # ChromaDB operations
    │   ├── llm.ts           # OpenAI integration
    │   └── types.ts         # TypeScript types
    ├── package.json          # Node.js dependencies
    └── Dockerfile           # Docker image for TS service
```

## Running the Project

### System Requirements

- Docker and Docker Compose
- Node.js 20+ (if running locally)
- Python 3.8+ (if running locally)

### Running with Docker Compose (Recommended)

1. **Clone repository and navigate to project directory:**
   ```bash
   cd BE
   ```

2. **Create `.env` file in root directory:**
   ```env
   # OpenAI API Key (required)
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Optional configurations
   TOP_K=6
   EXTRACTOR_URL=http://python-extractor:7001
   PORT=3000
   ```

3. **Run all services:**
   ```bash
   docker-compose up --build
   ```

4. **Verify services are running:**
   - ChromaDB: http://localhost:8000
   - Python Extractor: http://localhost:7001
   - TypeScript Backend: http://localhost:3000

### Running Individual Services

#### 1. ChromaDB
```bash
docker run -p 8000:8000 -v ./chroma_data:/chroma/.chroma ghcr.io/chroma-core/chroma:latest
```

#### 2. Python Extractor
```bash
cd python-extractor
pip install -r requirements.txt
EMBED_MODEL_NAME=intfloat/e5-base-v2 uvicorn app:app --host 0.0.0.0 --port 7001
```

#### 3. TypeScript Backend
```bash
cd ts-backend
npm install
npm run dev
```

## API Documentation

### Base URL
- **Production**: `http://localhost:3000`
- **Development**: `http://localhost:3000`

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "ok": true
}
```

#### 2. Upload PDF Document
```http
POST /api/upload
Content-Type: multipart/form-data
```

**Request:**
- `file`: PDF file (multipart form data)

**Response:**
```json
{
  "indexed": 15,
  "source": "document_name"
}
```

**Error Responses:**
- `400`: File is not PDF or has no content
- `500`: Error from extractor service

#### 3. Query Document
```http
POST /api/query
Content-Type: application/json
```

**Request:**
```json
{
  "question": "Your question about the document"
}
```

**Response:**
```json
{
  "answer": "Answer generated from the document",
  "citations": [
    {
      "doc": 1,
      "metadata": {
        "type": "paragraph",
        "page_number": 2,
        "section": "Introduction"
      },
      "distance": 0.1234
    }
  ]
}
```

**Error Responses:**
- `400`: Invalid body or missing question

### Python Extractor API

#### 1. Extract PDF Content
```http
POST /extract
Content-Type: multipart/form-data
```

**Request:**
- `file`: PDF file

**Response:**
```json
{
  "blocks": [
    {
      "type": "heading",
      "page_number": 1,
      "section": "Introduction",
      "text": "Chapter 1: Introduction"
    },
    {
      "type": "paragraph", 
      "page_number": 1,
      "section": "Introduction",
      "text": "This is the content..."
    }
  ]
}
```

#### 2. Generate Embeddings
```http
POST /embed
Content-Type: application/json
```

**Request:**
```json
{
  "texts": ["Text 1", "Text 2", "Text 3"]
}
```

**Response:**
```json
{
  "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  "model": "intfloat/e5-base-v2"
}
```

#### 3. Health Check
```http
GET /ping
```

**Response:**
```json
{
  "ok": true,
  "model": "intfloat/e5-base-v2"
}
```

## Configuration

### Environment Variables

#### TypeScript Backend
- `OPENAI_API_KEY`: OpenAI API key (required)
- `TOP_K`: Maximum number of chunks to retrieve (default: 6)
- `EXTRACTOR_URL`: Python extractor service URL (default: http://localhost:7001)
- `PORT`: Server port (default: 3000)

#### Python Extractor
- `EMBED_MODEL_NAME`: Embedding model name (default: intfloat/e5-base-v2)

### ChromaDB
- Port: 8000
- Data persistence: `./chroma_data`

## Workflow

1. **Upload PDF**: 
   - Client uploads PDF via `/api/upload`
   - TS backend sends file to Python extractor
   - Python extractor extracts content into blocks
   - TS backend performs semantic chunking
   - Chunks are embedded and stored in ChromaDB

2. **Query**:
   - Client sends question via `/api/query`
   - TS backend embeds question and searches in ChromaDB
   - Retrieves top-k most relevant chunks
   - Sends context and question to OpenAI to generate answer
   - Returns answer with citations

## Troubleshooting

### Common Issues

1. **"Please upload a PDF file"**
   - Ensure uploaded file is a PDF
   - Check Content-Type header

2. **"Extractor failed"**
   - Check if Python extractor service is running
   - View logs of python-extractor container

3. **"No content extracted"**
   - PDF may be corrupted or have no text
   - Try with a different PDF

4. **OpenAI API errors**
   - Check API key in `.env`
   - Ensure credits are available in OpenAI account

### Logs

```bash
# View logs of all services
docker-compose logs -f

# View logs of specific service
docker-compose logs -f ts-backend
docker-compose logs -f python-extractor
docker-compose logs -f chroma
```

## Development

### Adding New Endpoints

1. Add route in `ts-backend/src/routes.ts`
2. Implement logic in corresponding files
3. Update types in `ts-backend/src/types.ts` if needed

### Changing Embedding Model

1. Update `EMBED_MODEL_NAME` in `docker-compose.yml`
2. Rebuild Python extractor: `docker-compose up --build python-extractor`

### Testing

```bash
# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:7001/ping

# Test upload
curl -X POST -F "file=@document.pdf" http://localhost:3000/api/upload

# Test query
curl -X POST -H "Content-Type: application/json" \
  -d '{"question":"Your question here"}' \
  http://localhost:3000/api/query
```

## License

MIT License
