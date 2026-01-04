import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);
    private readonly indexPrefix: string;

    constructor(
        private readonly elasticsearchService: ElasticsearchService,
        private readonly configService: ConfigService,
    ) {
        this.indexPrefix = this.configService.get('ELASTICSEARCH_INDEX_PREFIX', 'checkitout');
    }

    /**
     * Get full index name with prefix
     */
    getIndexName(index: string): string {
        return `${this.indexPrefix}_${index}`;
    }

    /**
     * Create index with mapping if not exists
     */
    async createIndex(index: string, mapping: any): Promise<void> {
        const indexName = this.getIndexName(index);
        try {
            const exists = await this.elasticsearchService.indices.exists({ index: indexName });
            if (!exists) {
                await this.elasticsearchService.indices.create({
                    index: indexName,
                    body: mapping,
                });
                this.logger.log(`Created index: ${indexName}`);
            }
        } catch (error) {
            this.logger.error(`Error creating index ${indexName}:`, error);
            throw error;
        }
    }

    /**
     * Index a document
     */
    async indexDocument(index: string, id: string, document: any): Promise<void> {
        const indexName = this.getIndexName(index);
        try {
            await this.elasticsearchService.index({
                index: indexName,
                id,
                document,
            });
            this.logger.debug(`Indexed document ${id} to ${indexName}`);
        } catch (error) {
            this.logger.error(`Error indexing document ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update a document
     */
    async updateDocument(index: string, id: string, document: any): Promise<void> {
        const indexName = this.getIndexName(index);
        try {
            await this.elasticsearchService.update({
                index: indexName,
                id,
                doc: document,
            });
            this.logger.debug(`Updated document ${id} in ${indexName}`);
        } catch (error) {
            this.logger.error(`Error updating document ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a document
     */
    async deleteDocument(index: string, id: string): Promise<void> {
        const indexName = this.getIndexName(index);
        try {
            await this.elasticsearchService.delete({
                index: indexName,
                id,
            });
            this.logger.debug(`Deleted document ${id} from ${indexName}`);
        } catch (error) {
            if (error.meta?.statusCode !== 404) {
                this.logger.error(`Error deleting document ${id}:`, error);
                throw error;
            }
        }
    }

    /**
     * Search documents with pagination
     */
    async search(index: string, query: any, from: number = 0, size: number = 10): Promise<any> {
        const indexName = this.getIndexName(index);
        try {
            const result = await this.elasticsearchService.search({
                index: indexName,
                from,
                size,
                body: query,
            });
            return result;
        } catch (error) {
            this.logger.error(`Error searching in ${indexName}:`, error);
            throw error;
        }
    }

    /**
     * Bulk index documents
     */
    async bulkIndex(index: string, documents: any[]): Promise<void> {
        const indexName = this.getIndexName(index);
        const body = documents.flatMap((doc) => {
            const { _id, ...docWithoutId } = doc;
            return [
                { index: { _index: indexName, _id: _id || doc.id } },
                docWithoutId,
            ];
        });

        try {
            const result = await this.elasticsearchService.bulk({ body });
            if (result.errors) {
                this.logger.error('Bulk indexing had errors:', result.items);
            } else {
                this.logger.log(`Bulk indexed ${documents.length} documents to ${indexName}`);
            }
        } catch (error) {
            this.logger.error(`Error bulk indexing:`, error);
            throw error;
        }
    }

    /**
     * Delete index
     */
    async deleteIndex(index: string): Promise<void> {
        const indexName = this.getIndexName(index);
        try {
            await this.elasticsearchService.indices.delete({ index: indexName });
            this.logger.log(`Deleted index: ${indexName}`);
        } catch (error) {
            if (error.meta?.statusCode !== 404) {
                this.logger.error(`Error deleting index ${indexName}:`, error);
                throw error;
            }
        }
    }

    /**
     * Check if Elasticsearch is healthy
     */
    async checkHealth(): Promise<boolean> {
        try {
            const health = await this.elasticsearchService.cluster.health();
            return health.status === 'green' || health.status === 'yellow';
        } catch (error) {
            this.logger.error('Elasticsearch health check failed:', error);
            return false;
        }
    }
}
