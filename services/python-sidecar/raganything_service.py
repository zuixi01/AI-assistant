"""
RAG-Anything Service Wrapper

Provides multimodal document parsing and knowledge graph retrieval.
This module wraps RAG-Anything (MinerU + LightRAG) into a clean API
that the NestJS backend can call.

When RAG-Anything is not installed, a lightweight fallback parser is used.
"""

import os
import base64
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ParsedSection:
    """A section of parsed multimodal content."""
    type: str  # "text", "table", "image", "formula", "chart"
    content: str
    section_index: int
    page_number: Optional[int] = None
    caption: Optional[str] = None
    # Table-specific
    table_headers: Optional[List[str]] = None
    table_rows: Optional[List[List[str]]] = None
    # Image-specific
    image_base64: Optional[str] = None
    image_description: Optional[str] = None
    image_mime: Optional[str] = None
    # Formula-specific
    latex: Optional[str] = None
    formula_type: Optional[str] = None
    # Chart-specific
    chart_type: Optional[str] = None
    chart_data: Optional[str] = None
    # Spreadsheet
    sheet_name: Optional[str] = None


@dataclass
class ParseResult:
    """Complete parse result from a document."""
    full_text: str
    sections: List[ParsedSection] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    parse_duration_ms: float = 0.0


@dataclass
class GraphEntity:
    """A knowledge graph entity."""
    id: str
    name: str
    type: str  # "concept", "product", "term", "person", "organization"
    aliases: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphRelation:
    """A relationship between two entities."""
    from_entity_id: str
    to_entity_id: str
    relation_type: str
    weight: float = 1.0


class RAGAnythingService:
    """
    Wrapper around RAG-Anything for multimodal document processing.

    When RAG-Anything (raganything package) is not installed, falls back
    to lightweight text-based parsing and empty graph results.

    To enable full multimodal:
    1. pip install raganything[all]
    2. Install MinerU or Docling
    3. Set ENABLE_KNOWLEDGE_GRAPH=true
    """

    def __init__(self):
        self._raganything = None
        self._lightrag = None
        self._parser_backend = os.getenv("PARSER_BACKEND", "mineru")
        self._graph_enabled = os.getenv("ENABLE_KNOWLEDGE_GRAPH", "false").lower() == "true"

        # Try to import RAG-Anything
        try:
            # import raganything
            # self._raganything = raganything
            logger.info("RAG-Anything not installed, using fallback parser")
        except ImportError:
            logger.info("RAG-Anything not available, multimodal features limited")

    @property
    def multimodal_available(self) -> bool:
        """Whether full multimodal parsing is available."""
        return self._raganything is not None

    @property
    def parser_backend(self) -> str:
        """Configured parser backend name."""
        return self._parser_backend

    @property
    def parser_mode(self) -> str:
        """Current parser execution mode."""
        return "multimodal" if self.multimodal_available else "fallback"

    @property
    def graph_available(self) -> bool:
        """Whether knowledge graph is available."""
        return self._graph_enabled and self._lightrag is not None

    @property
    def graph_mode(self) -> str:
        """Current graph execution mode."""
        if self.graph_available:
            return "graph"
        if self._graph_enabled:
            return "configured_but_unavailable"
        return "disabled"

    def capabilities(self) -> Dict[str, Any]:
        """Expose sidecar capability boundaries for health/status endpoints."""
        return {
            "document_parsing": {
                "backend": self.parser_backend,
                "mode": self.parser_mode,
                "multimodal": self.multimodal_available,
                "fallback": "lightweight parser" if not self.multimodal_available else None,
            },
            "knowledge_graph": {
                "enabled": self._graph_enabled,
                "available": self.graph_available,
                "mode": self.graph_mode,
                "fallback": "returns unavailable mode" if not self.graph_available else None,
            },
        }

    async def parse_document(
        self,
        file_content: bytes,
        filename: str,
        extract_tables: bool = True,
        extract_images: bool = True,
        extract_formulas: bool = True,
    ) -> ParseResult:
        """
        Parse a document and extract multimodal content.

        If RAG-Anything is available, uses MinerU/Docling for high-quality extraction.
        Otherwise, falls back to basic text parsing.
        """
        import time
        start = time.time()

        try:
            if self._raganything:
                result = await self._parse_with_raganything(
                    file_content, filename, extract_tables, extract_images, extract_formulas
                )
            else:
                result = await self._parse_fallback(
                    file_content, filename, extract_tables, extract_images
                )
        except Exception as e:
            logger.error(f"Parse failed for {filename}: {e}")
            result = ParseResult(
                full_text=f"[Parse Error: {str(e)}]",
                sections=[],
                metadata={"error": str(e)},
            )

        result.parse_duration_ms = (time.time() - start) * 1000
        return result

    async def _parse_with_raganything(
        self,
        file_content: bytes,
        filename: str,
        extract_tables: bool,
        extract_images: bool,
        extract_formulas: bool,
    ) -> ParseResult:
        """
        Full multimodal parsing using RAG-Anything.
        Placeholder — implement when RAG-Anything is installed.
        """
        # When RAG-Anything is installed:
        # config = RAGAnythingConfig(
        #     parser_backend=self._parser_backend,
        #     extract_tables=extract_tables,
        #     extract_images=extract_images,
        #     extract_formulas=extract_formulas,
        # )
        # ra = RAGAnything(config=config)
        # result = await ra.parse(file_content, filename)
        # return self._convert_result(result)

        # Fallback for now
        return await self._parse_fallback(
            file_content, filename, extract_tables, extract_images
        )

    async def _parse_fallback(
        self,
        file_content: bytes,
        filename: str,
        _extract_tables: bool,
        _extract_images: bool,
    ) -> ParseResult:
        """Lightweight fallback parser when RAG-Anything is not installed."""
        ext = Path(filename).suffix.lower()

        if ext in ('.txt', '.md', '.markdown'):
            text = file_content.decode('utf-8', errors='replace')
            return ParseResult(
                full_text=text,
                sections=[ParsedSection(type="text", content=text, section_index=0)],
                metadata={"parser": "fallback-txt"},
            )
        elif ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'):
            size_kb = len(file_content) / 1024
            b64 = base64.b64encode(file_content).decode('ascii')
            return ParseResult(
                full_text=f"[Image: {filename}] ({size_kb:.1f}KB)",
                sections=[ParsedSection(
                    type="image",
                    content=f"[Image: {filename}]",
                    section_index=0,
                    image_base64=b64[:200],
                    image_mime=f"image/{ext.lstrip('.')}",
                    caption=filename,
                )],
                metadata={"parser": "fallback-image", "file_size_kb": size_kb},
            )
        else:
            return ParseResult(
                full_text=f"[Binary file: {filename}] - Requires RAG-Anything for parsing {ext} files.",
                sections=[],
                metadata={"parser": "fallback-unsupported", "extension": ext},
            )

    async def generate_image_description(
        self,
        image_content: bytes,
        filename: str,
    ) -> str:
        """
        Generate a description of an image using a vision model.
        Requires a configured vision model (GPT-4o, etc.).
        """
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=os.getenv("VISION_API_KEY", os.getenv("LLM_API_KEY")),
                base_url=os.getenv("VISION_BASE_URL", os.getenv("LLM_BASE_URL")),
            )

            b64 = base64.b64encode(image_content).decode('ascii')
            ext = Path(filename).suffix.lower().lstrip('.')
            mime = f"image/{ext}" if ext else "image/png"

            response = await client.chat.completions.create(
                model=os.getenv("VISION_MODEL", "gpt-4o"),
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "请详细描述这张图片的内容，包括其中的文字、图表、人物、物体和场景。如果是图表，请描述其数据和趋势。"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }],
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.warning(f"Vision description failed for {filename}: {e}")
            return f"[Image: {filename}] - Vision description unavailable"

    async def extract_entities(
        self,
        text: str,
        source_id: str,
    ) -> List[GraphEntity]:
        """
        Extract entities from text using LLM or NLP heuristics.
        """
        entities: List[GraphEntity] = []
        seen = set()

        # Simple heuristic extraction
        import re

        # Chinese organization/entity patterns
        patterns = [
            (r'[""]([^""]{2,30})[""]', "concept"),
            (r'《([^》]{2,30})》', "concept"),
            (r'([一-鿿]{2,10}(?:公司|部门|团队|系统|平台|服务|产品))', "organization"),
        ]

        for pattern, entity_type in patterns:
            for match in re.finditer(pattern, text):
                name = match.group(1).strip()
                if name and len(name) >= 2 and name not in seen:
                    seen.add(name)
                    entities.append(GraphEntity(
                        id=f"ent_{source_id}_{len(entities)}",
                        name=name,
                        type=entity_type,
                    ))

        logger.debug(f"Extracted {len(entities)} entities from {source_id}")
        return entities

    async def search_graph(
        self,
        query: str,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Search the knowledge graph for entities and relations related to a query.
        """
        if not self.graph_available:
            return {"entities": [], "relations": [], "mode": "unavailable"}

        # When LightRAG is available:
        # results = await self._lightrag.query(query, mode="hybrid")
        # return {"entities": [...], "relations": [...], "mode": "graph"}

        return {"entities": [], "relations": [], "mode": "unavailable"}


# Singleton
rag_service = RAGAnythingService()
