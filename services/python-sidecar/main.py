"""
RAG-Anything Python Sidecar API Server

Provides HTTP endpoints for multimodal document parsing and knowledge graph retrieval.
This runs alongside the NestJS backend and handles heavy document processing.

Usage:
    python main.py

Endpoints:
    POST /parse          - Parse a document (multipart file upload)
    POST /image/describe - Generate image description using vision model
    POST /entities/extract - Extract entities from text
    POST /graph/search   - Search the knowledge graph
    GET  /health         - Health check
"""

import os
import sys
import logging
from typing import Optional

from dotenv import load_dotenv

# Load .env from sidecar directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current dir to path
sys.path.insert(0, os.path.dirname(__file__))
from raganything_service import rag_service, ParseResult, GraphEntity
from turbovec_service import turbovec_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag-anything-sidecar")

# Config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8001"))
SIDECAR_SHARED_TOKEN = os.getenv("SIDECAR_SHARED_TOKEN", "").strip()
SIDE_CAR_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("SIDECAR_ALLOWED_ORIGINS", "http://localhost:3100,http://127.0.0.1:3100").split(",")
    if origin.strip()
]

# FastAPI app
app = FastAPI(
    title="RAG-Anything Sidecar",
    description="Multimodal document parsing and knowledge graph retrieval service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=SIDE_CAR_ALLOWED_ORIGINS,
    allow_credentials=bool(SIDE_CAR_ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_sidecar_token(authorization: Optional[str] = Header(None), x_sidecar_token: Optional[str] = Header(None)):
    """Protect internal vector endpoints with a shared token when configured."""
    if not SIDECAR_SHARED_TOKEN:
        return

    bearer_token = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:].strip()

    provided_token = x_sidecar_token or bearer_token
    if provided_token != SIDECAR_SHARED_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized sidecar request")


@app.on_event("startup")
async def maybe_rebuild_turbovec_on_startup():
    """Optionally rebuild the local vector index when the sidecar starts."""
    if os.getenv("TURBOVEC_REBUILD_ON_START", "false").lower() != "true":
        return
    result = turbovec_service.rebuild()
    if result.get("success"):
        logger.info(
            "turbovec index rebuilt on startup: "
            f"{result.get('chunk_count', 0)} chunks"
        )
    else:
        logger.warning(f"turbovec startup rebuild skipped/failed: {result.get('error')}")


# ============ Pydantic Models ============

class ParseResponse(BaseModel):
    success: bool
    full_text: str
    sections: list = []
    metadata: dict = {}
    parse_duration_ms: float = 0.0
    error: Optional[str] = None


class ImageDescriptionRequest(BaseModel):
    filename: str


class ImageDescriptionResponse(BaseModel):
    success: bool
    description: str
    error: Optional[str] = None


class EntityExtractionRequest(BaseModel):
    text: str
    source_id: str = "default"


class EntityExtractionResponse(BaseModel):
    success: bool
    entities: list = []


class GraphSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class GraphSearchResponse(BaseModel):
    success: bool
    entities: list = []
    relations: list = []
    mode: str = "unavailable"


class HealthResponse(BaseModel):
    status: str
    multimodal_available: bool
    graph_available: bool
    parser_backend: str
    parser_mode: str
    graph_mode: str
    capabilities: dict = {}
    vector: dict = {}


class VectorRebuildRequest(BaseModel):
    tenant_id: Optional[str] = None


class VectorSearchRequest(BaseModel):
    tenant_id: str
    embedding: list[float]
    top_k: int = 5
    allow_ids: Optional[list[int]] = None
    content_types: Optional[list[str]] = None


class VectorUpsertChunk(BaseModel):
    chunk_id: str
    vector_index_id: int
    tenant_id: str
    source_id: str
    content_type: str = "text"
    embedding: list[float]
    metadata: dict = {}


class VectorUpsertBatchRequest(BaseModel):
    tenant_id: str
    source_id: str
    chunks: list[VectorUpsertChunk]


class VectorDeleteRequest(BaseModel):
    source_id: Optional[str] = None
    chunk_ids: Optional[list[str]] = None
    vector_index_ids: Optional[list[int]] = None


# ============ Routes ============

@app.get("/", response_model=HealthResponse)
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        multimodal_available=rag_service.multimodal_available,
        graph_available=rag_service.graph_available,
        parser_backend=rag_service.parser_backend,
        parser_mode=rag_service.parser_mode,
        graph_mode=rag_service.graph_mode,
        capabilities=rag_service.capabilities(),
        vector=turbovec_service.health(),
    )


@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    extract_tables: bool = Form(True),
    extract_images: bool = Form(True),
    extract_formulas: bool = Form(True),
):
    """
    Parse a document file and extract multimodal content.

    Returns text, tables, images, formulas, and charts as structured sections.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        content = await file.read()
        result = await rag_service.parse_document(
            content,
            file.filename,
            extract_tables=extract_tables,
            extract_images=extract_images,
            extract_formulas=extract_formulas,
        )

        return ParseResponse(
            success=True,
            full_text=result.full_text,
            sections=[
                {
                    "type": s.type,
                    "content": s.content,
                    "sectionIndex": s.section_index,
                    "pageNumber": s.page_number,
                    "caption": s.caption,
                    "tableHeaders": s.table_headers,
                    "tableRows": s.table_rows,
                    "imageDescription": s.image_description,
                    "imageMime": s.image_mime,
                    "latex": s.latex,
                    "formulaType": s.formula_type,
                    "chartType": s.chart_type,
                    "sheetName": s.sheet_name,
                }
                for s in result.sections
            ],
            metadata=result.metadata,
            parse_duration_ms=result.parse_duration_ms,
        )
    except Exception as e:
        logger.error(f"Parse failed: {e}")
        return ParseResponse(
            success=False,
            full_text="",
            error=str(e),
        )


@app.post("/image/describe", response_model=ImageDescriptionResponse)
async def describe_image(
    file: UploadFile = File(...),
    request: Optional[ImageDescriptionRequest] = None,
):
    """
    Generate a description of an image using a vision model (GPT-4o).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        content = await file.read()
        filename = request.filename if request else file.filename
        description = await rag_service.generate_image_description(content, filename)
        return ImageDescriptionResponse(
            success=True,
            description=description,
        )
    except Exception as e:
        logger.error(f"Image description failed: {e}")
        return ImageDescriptionResponse(
            success=False,
            description="",
            error=str(e),
        )


@app.post("/entities/extract", response_model=EntityExtractionResponse)
async def extract_entities(request: EntityExtractionRequest):
    """Extract entities from text for knowledge graph construction."""
    try:
        entities = await rag_service.extract_entities(request.text, request.source_id)
        return EntityExtractionResponse(
            success=True,
            entities=[
                {
                    "id": e.id,
                    "name": e.name,
                    "type": e.type,
                    "aliases": e.aliases,
                    "metadata": e.metadata,
                }
                for e in entities
            ],
        )
    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        return EntityExtractionResponse(success=False)


@app.post("/graph/search", response_model=GraphSearchResponse)
async def search_graph(request: GraphSearchRequest):
    """Search the knowledge graph for entities related to a query."""
    try:
        result = await rag_service.search_graph(request.query, request.top_k)
        return GraphSearchResponse(
            success=True,
            entities=result.get("entities", []),
            relations=result.get("relations", []),
            mode=result.get("mode", "unavailable"),
        )
    except Exception as e:
        logger.error(f"Graph search failed: {e}")
        return GraphSearchResponse(success=False)


@app.get("/vector/health", response_model=dict)
async def vector_health():
    """Health check for the optional turbovec index."""
    return turbovec_service.health()


@app.post("/vector/rebuild", response_model=dict)
async def vector_rebuild(
    request: VectorRebuildRequest,
    authorization: Optional[str] = Header(None),
    x_sidecar_token: Optional[str] = Header(None),
):
    """Rebuild the optional turbovec index from PostgreSQL."""
    require_sidecar_token(authorization, x_sidecar_token)
    return turbovec_service.rebuild(tenant_id=request.tenant_id)


@app.post("/vector/search", response_model=dict)
async def vector_search(
    request: VectorSearchRequest,
    authorization: Optional[str] = Header(None),
    x_sidecar_token: Optional[str] = Header(None),
):
    """Search the optional turbovec index for candidate chunk IDs."""
    require_sidecar_token(authorization, x_sidecar_token)
    return turbovec_service.search(
        tenant_id=request.tenant_id,
        embedding=request.embedding,
        top_k=request.top_k,
        allow_ids=request.allow_ids,
        content_types=request.content_types,
    )


@app.post("/vector/upsert-batch", response_model=dict)
async def vector_upsert_batch(
    request: VectorUpsertBatchRequest,
    authorization: Optional[str] = Header(None),
    x_sidecar_token: Optional[str] = Header(None),
):
    """Upsert chunks into the optional turbovec index."""
    require_sidecar_token(authorization, x_sidecar_token)
    return turbovec_service.upsert_batch(
        tenant_id=request.tenant_id,
        source_id=request.source_id,
        chunks=[chunk.model_dump() for chunk in request.chunks],
    )


@app.post("/vector/delete", response_model=dict)
async def vector_delete(
    request: VectorDeleteRequest,
    authorization: Optional[str] = Header(None),
    x_sidecar_token: Optional[str] = Header(None),
):
    """Remove chunks from the optional turbovec index."""
    require_sidecar_token(authorization, x_sidecar_token)
    return turbovec_service.delete(
        source_id=request.source_id,
        chunk_ids=request.chunk_ids,
        vector_index_ids=request.vector_index_ids,
    )


class Entity(BaseModel):
    id: str
    name: str
    type: str

class BulkExtractionRequest(BaseModel):
    texts: list[str]
    source_id: str = "default"

@app.post("/entities/extract-bulk", response_model=dict)
async def extract_entities_bulk(request: BulkExtractionRequest):
    """Extract entities from multiple text chunks."""
    all_entities = []
    for text in request.texts:
        entities = await rag_service.extract_entities(text, request.source_id)
        all_entities.extend([{"id": e.id, "name": e.name, "type": e.type} for e in entities])
    return {"success": True, "entities": all_entities}


# ============ Main ============

if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting RAG-Anything Sidecar on {HOST}:{PORT}")
    logger.info(f"Multimodal available: {rag_service.multimodal_available}")
    logger.info(f"Graph available: {rag_service.graph_available}")
    logger.info(f"Parser backend: {os.getenv('PARSER_BACKEND', 'mineru')}")

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )
