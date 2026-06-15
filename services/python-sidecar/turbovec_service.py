"""Optional turbovec vector accelerator for the RAG sidecar.

PostgreSQL remains the source of truth. This service keeps a local
IdMapIndex cache keyed by knowledge_chunks.vector_index_id and returns chunk
IDs that NestJS must rehydrate and validate before using.
"""

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class TurbovecService:
    def __init__(
        self,
        index_dir: Optional[str] = None,
        enabled: Optional[bool] = None,
        dim: Optional[int] = None,
        bit_width: Optional[int] = None,
    ):
        self.enabled = (
            enabled
            if enabled is not None
            else os.getenv("TURBOVEC_ENABLED", "false").lower() == "true"
        )
        self.dim = dim or int(os.getenv("EMBEDDING_DIM", "1536"))
        self.bit_width = bit_width or int(os.getenv("TURBOVEC_BIT_WIDTH", "4"))
        self.index_dir = Path(index_dir or os.getenv("TURBOVEC_INDEX_DIR", ".data/turbovec"))
        if not self.index_dir.is_absolute():
            self.index_dir = Path(__file__).parent / self.index_dir
        self.index_path = self.index_dir / "knowledge_chunks.tvim"
        self.metadata_path = self.index_dir / "knowledge_chunks.metadata.json"

        self._lock = threading.RLock()
        self._index = None
        self._id_metadata: Dict[int, Dict[str, Any]] = {}
        self._tenant_ids: Dict[str, set[int]] = {}
        self._content_type_ids: Dict[str, set[int]] = {}
        self._index_version: Optional[str] = None
        self._stale = True
        self._error: Optional[str] = None

        self._np = None
        self._id_map_index = None
        self._import_error: Optional[str] = None
        self._load_optional_dependencies()
        self._load_from_disk()

    @property
    def available(self) -> bool:
        return self._np is not None and self._id_map_index is not None

    def health(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": "ok" if self.available and not self._stale else "degraded",
                "provider": "turbovec",
                "enabled": self.enabled,
                "available": self.available,
                "stale": self._stale,
                "dim": self.dim,
                "bit_width": self.bit_width,
                "chunk_count": len(self._id_metadata),
                "index_version": self._index_version,
                "error": self._error or self._import_error,
            }

    def search(
        self,
        tenant_id: str,
        embedding: List[float],
        top_k: int = 5,
        allow_ids: Optional[List[int]] = None,
        content_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            if not self.enabled:
                return self._unavailable("turbovec disabled")
            if not self.available:
                return self._unavailable(self._import_error or "turbovec unavailable")
            if self._index is None or self._stale:
                return self._unavailable(self._error or "index is stale")
            if len(embedding) != self.dim:
                return self._unavailable(f"dimension mismatch: expected {self.dim}, got {len(embedding)}")

            allowed = set(self._tenant_ids.get(tenant_id, set()))
            if content_types:
                type_allowed: set[int] = set()
                for content_type in content_types:
                    type_allowed.update(self._content_type_ids.get(content_type, set()))
                allowed &= type_allowed
            if allow_ids:
                allowed &= {int(i) for i in allow_ids}
            if not allowed:
                return self._success([])

            query = self._np.asarray([embedding], dtype=self._np.float32)
            allowlist = self._np.asarray(sorted(allowed), dtype=self._np.uint64)
            try:
                scores, ids = self._index.search(query, k=top_k, allowlist=allowlist)
            except Exception as exc:
                return self._unavailable(str(exc))

            results = []
            for score, vector_id in zip(scores[0].tolist(), ids[0].tolist()):
                vector_id = int(vector_id)
                metadata = self._id_metadata.get(vector_id)
                if not metadata:
                    continue
                results.append({
                    "vector_index_id": vector_id,
                    "chunk_id": metadata["chunk_id"],
                    "score": float(score),
                })
            return self._success(results)

    def rebuild(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        if not self.enabled:
            return self._unavailable("turbovec disabled")
        if not self.available:
            return self._unavailable(self._import_error or "turbovec unavailable")

        database_url = os.getenv("SIDECAR_DATABASE_URL") or os.getenv("DATABASE_URL")
        if not database_url:
            return self._unavailable("DATABASE_URL is required for rebuild")

        try:
            import psycopg
        except Exception as exc:
            return self._unavailable(f"psycopg unavailable: {exc}")

        sql = """
            SELECT kc.id::text, kc.vector_index_id, kc.tenant_id::text,
                   kc.source_id::text, kc.content_type, kc.embedding::text
            FROM knowledge_chunks kc
            JOIN knowledge_sources ks ON kc.source_id = ks.id
            WHERE kc.embedding IS NOT NULL
              AND kc.status = 'active'
              AND ks.status = 'active'
        """
        params: List[Any] = []
        if tenant_id:
            sql += " AND kc.tenant_id = %s::uuid"
            params.append(tenant_id)
        sql += " ORDER BY kc.vector_index_id"

        vectors = []
        ids = []
        metadata: Dict[int, Dict[str, Any]] = {}
        try:
            with psycopg.connect(database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    for chunk_id, vector_index_id, row_tenant_id, source_id, content_type, vector_text in cur.fetchall():
                        vector = self._parse_pgvector(vector_text)
                        if len(vector) != self.dim:
                            raise ValueError(
                                f"chunk {chunk_id} dimension mismatch: expected {self.dim}, got {len(vector)}"
                            )
                        vector_id = int(vector_index_id)
                        ids.append(vector_id)
                        vectors.append(vector)
                        metadata[vector_id] = {
                            "chunk_id": chunk_id,
                            "tenant_id": row_tenant_id,
                            "source_id": source_id,
                            "content_type": content_type,
                        }
        except Exception as exc:
            return self._unavailable(f"rebuild query failed: {exc}")

        with self._lock:
            self._index = self._id_map_index(dim=self.dim, bit_width=self.bit_width)
            if vectors:
                self._index.add_with_ids(
                    self._np.asarray(vectors, dtype=self._np.float32),
                    self._np.asarray(ids, dtype=self._np.uint64),
                )
                self._index.prepare()
            self._id_metadata = metadata
            self._rebuild_maps()
            self._stale = False
            self._error = None
            self._index_version = self._now()
            self._persist()
            return {
                "success": True,
                "provider": "turbovec",
                "stale": False,
                "index_version": self._index_version,
                "chunk_count": len(self._id_metadata),
            }

    def upsert_batch(self, tenant_id: str, source_id: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not self.enabled:
            return self._unavailable("turbovec disabled")
        if not self.available:
            return self._unavailable(self._import_error or "turbovec unavailable")

        valid_chunks = []
        for chunk in chunks:
            vector = chunk.get("embedding") or []
            vector_id = chunk.get("vector_index_id")
            chunk_id = chunk.get("chunk_id")
            if vector_id is None or not chunk_id:
                continue
            if len(vector) != self.dim:
                return self._unavailable(f"dimension mismatch for chunk {chunk_id}")
            valid_chunks.append((int(vector_id), chunk_id, vector, chunk.get("content_type", "text")))

        if not valid_chunks:
            return self._success([])

        with self._lock:
            if self._index is None:
                self._index = self._id_map_index(dim=self.dim, bit_width=self.bit_width)

            ids = []
            vectors = []
            for vector_id, chunk_id, vector, content_type in valid_chunks:
                try:
                    if self._index.contains(vector_id):
                        self._index.remove(vector_id)
                except Exception:
                    pass
                ids.append(vector_id)
                vectors.append(vector)
                self._id_metadata[vector_id] = {
                    "chunk_id": chunk_id,
                    "tenant_id": tenant_id,
                    "source_id": source_id,
                    "content_type": content_type,
                }

            self._index.add_with_ids(
                self._np.asarray(vectors, dtype=self._np.float32),
                self._np.asarray(ids, dtype=self._np.uint64),
            )
            self._index.prepare()
            self._rebuild_maps()
            self._stale = False
            self._error = None
            self._index_version = self._now()
            self._persist()
            return {
                "success": True,
                "provider": "turbovec",
                "stale": False,
                "index_version": self._index_version,
                "upserted": len(valid_chunks),
            }

    def delete(
        self,
        source_id: Optional[str] = None,
        chunk_ids: Optional[List[str]] = None,
        vector_index_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        if not self.enabled:
            return self._unavailable("turbovec disabled")
        if not self.available:
            return self._unavailable(self._import_error or "turbovec unavailable")

        chunk_id_set = set(chunk_ids or [])
        delete_ids = {int(i) for i in (vector_index_ids or [])}
        with self._lock:
            for vector_id, metadata in list(self._id_metadata.items()):
                if source_id and metadata.get("source_id") == source_id:
                    delete_ids.add(vector_id)
                if chunk_id_set and metadata.get("chunk_id") in chunk_id_set:
                    delete_ids.add(vector_id)

            deleted = 0
            if self._index is not None:
                for vector_id in delete_ids:
                    try:
                        if self._index.remove(vector_id):
                            deleted += 1
                    except Exception:
                        pass
                    self._id_metadata.pop(vector_id, None)

            self._rebuild_maps()
            self._index_version = self._now()
            self._persist()
            return {
                "success": True,
                "provider": "turbovec",
                "stale": self._stale,
                "index_version": self._index_version,
                "deleted": deleted,
            }

    def _load_optional_dependencies(self) -> None:
        try:
            import numpy as np
            from turbovec import IdMapIndex

            self._np = np
            self._id_map_index = IdMapIndex
        except Exception as exc:
            self._import_error = str(exc)

    def _load_from_disk(self) -> None:
        if not self.available or not self.index_path.exists() or not self.metadata_path.exists():
            return
        try:
            self._index = self._id_map_index.load(str(self.index_path))
            payload = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            self._id_metadata = {int(k): v for k, v in payload.get("metadata", {}).items()}
            self._index_version = payload.get("index_version")
            self._stale = False
            self._error = None
            self._rebuild_maps()
        except Exception as exc:
            self._error = f"failed to load index: {exc}"
            self._stale = True

    def _persist(self) -> None:
        if not self.available or self._index is None:
            return
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._index.write(str(self.index_path))
        self.metadata_path.write_text(
            json.dumps({
                "index_version": self._index_version,
                "metadata": {str(k): v for k, v in self._id_metadata.items()},
            }, ensure_ascii=True),
            encoding="utf-8",
        )

    def _rebuild_maps(self) -> None:
        self._tenant_ids = {}
        self._content_type_ids = {}
        for vector_id, metadata in self._id_metadata.items():
            self._tenant_ids.setdefault(metadata["tenant_id"], set()).add(vector_id)
            self._content_type_ids.setdefault(metadata.get("content_type", "text"), set()).add(vector_id)

    def _parse_pgvector(self, vector_text: str) -> List[float]:
        return [float(x) for x in json.loads(vector_text)]

    def _success(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "success": True,
            "provider": "turbovec",
            "stale": False,
            "index_version": self._index_version,
            "results": results,
        }

    def _unavailable(self, error: str) -> Dict[str, Any]:
        self._error = error
        return {
            "success": False,
            "provider": "turbovec",
            "stale": True,
            "index_version": self._index_version,
            "error": error,
            "results": [],
        }

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()


turbovec_service = TurbovecService()
