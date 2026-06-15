import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface GraphEntity {
  id: string;
  name: string;
  type: 'concept' | 'product' | 'term' | 'person' | 'organization';
  aliases: string[];
  sourceId: string;
  metadata: Record<string, any>;
}

export interface GraphRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  weight: number;
  sourceId: string;
}

export interface GraphSearchResult {
  entity: GraphEntity;
  relatedEntities: Array<{ entity: GraphEntity; relation: GraphRelation }>;
  score: number;
}

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Extract entities from document content using NLP heuristics.
   * In production, this could call a Python NLP service or LLM.
   */
  async extractEntities(
    tenantId: string,
    sourceId: string,
    content: string,
  ): Promise<GraphEntity[]> {
    const entities: GraphEntity[] = [];
    const seen = new Set<string>();

    // Heuristic extraction: capitalized phrases, product-like patterns, technical terms
    const patterns = [
      // Product names: quoted strings
      /[""]([^""]{2,30})[""]/g,
      // Technical terms: backtick-enclosed
      /`([^`]{2,30})`/g,
      // Capitalized multi-word phrases (Chinese/English)
      /(?:[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)/g,
      // Chinese organization patterns: XX公司, XX部门
      /([一-鿿]{2,10}(?:公司|部门|团队|系统|平台|服务|产品|功能|模块))/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1]?.trim();
        if (name && name.length >= 2 && name.length <= 30 && !seen.has(name)) {
          seen.add(name);
          entities.push({
            id: `ent_${sourceId}_${entities.length}`,
            name,
            type: this.classifyEntityType(name),
            aliases: [],
            sourceId,
            metadata: {},
          });
        }
      }
    }

    this.logger.log(`Extracted ${entities.length} entities from source ${sourceId}`);
    return entities;
  }

  /**
   * Build relations between extracted entities based on co-occurrence.
   */
  async buildRelations(
    _tenantId: string,
    sourceId: string,
    entities: GraphEntity[],
    chunks: Array<{ content: string; chunkIndex: number }>,
  ): Promise<GraphRelation[]> {
    const relations: GraphRelation[] = [];

    for (const chunk of chunks) {
      const presentEntities = entities.filter((e) => chunk.content.includes(e.name));
      for (let i = 0; i < presentEntities.length; i++) {
        for (let j = i + 1; j < presentEntities.length; j++) {
          relations.push({
            id: `rel_${sourceId}_${i}_${j}_${chunk.chunkIndex}`,
            fromEntityId: presentEntities[i].id,
            toEntityId: presentEntities[j].id,
            relationType: 'co_occurrence',
            weight: 1.0,
            sourceId,
          });
        }
      }
    }

    this.logger.log(`Built ${relations.length} relations for source ${sourceId}`);
    return relations;
  }

  /**
   * Search the knowledge graph for entities related to a query.
   * This is a simplified in-memory implementation for Phase 1.
   * Phase 2 will use LightRAG/Python sidecar for full graph search.
   */
  async search(
    _tenantId: string,
    _query: string,
    _topK = 5,
  ): Promise<GraphSearchResult[]> {
    // Phase 1: Return empty results, graph search requires Python sidecar
    this.logger.debug('Graph search requested but Python sidecar not available');
    return [];
  }

  /**
   * Generate a graph-enhanced context string for LLM prompt.
   */
  async buildGraphContext(
    tenantId: string,
    query: string,
  ): Promise<string | null> {
    const results = await this.search(tenantId, query, 3);
    if (results.length === 0) return null;

    const lines = ['## 知识图谱关联信息'];
    for (const r of results) {
      lines.push(`- **${r.entity.name}** (${r.entity.type})`);
      for (const rel of r.relatedEntities) {
        lines.push(`  → ${rel.relation.relationType}: ${rel.entity.name}`);
      }
    }
    return lines.join('\n');
  }

  private classifyEntityType(
    name: string,
  ): GraphEntity['type'] {
    if (/公司|部门|团队/.test(name)) return 'organization';
    if (/产品|商品|SKU/.test(name)) return 'product';
    if (/系统|平台|服务|功能|模块/.test(name)) return 'concept';
    if (/先生|女士|经理|主管/.test(name)) return 'person';
    return 'term';
  }
}
