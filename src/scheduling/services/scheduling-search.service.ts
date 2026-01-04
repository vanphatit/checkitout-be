import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchService } from '../../modules/search/search.service';
import { Scheduling } from '../entities/scheduling.entity';

@Injectable()
export class SchedulingSearchService implements OnModuleInit {
    private readonly logger = new Logger(SchedulingSearchService.name);
    private readonly INDEX_NAME = 'schedulings';

    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        private readonly searchService: SearchService,
    ) { }

    async onModuleInit() {
        await this.createIndex();
    }

    /**
     * Create Elasticsearch index with mapping
     */
    private async createIndex(): Promise<void> {
        const mapping = {
            mappings: {
                properties: {
                    routeId: { type: 'keyword' },
                    routeName: { type: 'text', analyzer: 'standard' },
                    busIds: { type: 'keyword' },
                    etd: { type: 'keyword' },
                    eta: { type: 'keyword' },
                    departureDate: { type: 'date' },
                    arrivalDate: { type: 'date' },
                    price: { type: 'integer' },
                    availableSeats: { type: 'integer' },
                    bookedSeats: { type: 'integer' },
                    status: { type: 'keyword' },
                    isActive: { type: 'boolean' },
                    driver: {
                        type: 'object',
                        properties: {
                            name: { type: 'text' },
                            phone: { type: 'keyword' },
                            licenseNumber: { type: 'keyword' },
                        },
                    },
                    estimatedDuration: { type: 'integer' },
                    createdAt: { type: 'date' },
                    updatedAt: { type: 'date' },
                },
            },
        };

        await this.searchService.createIndex(this.INDEX_NAME, mapping);
    }

    /**
     * Index a single scheduling document
     */
    async indexScheduling(scheduling: any): Promise<void> {
        const document = {
            routeId: scheduling.routeId?._id?.toString() || scheduling.routeId,
            routeName: scheduling.routeId?.name || '',
            busIds: scheduling.busIds?.map((b: any) => b._id?.toString() || b) || [],
            etd: scheduling.etd,
            eta: scheduling.eta,
            departureDate: scheduling.departureDate,
            arrivalDate: scheduling.arrivalDate,
            price: scheduling.price,
            availableSeats: scheduling.availableSeats,
            bookedSeats: scheduling.bookedSeats,
            status: scheduling.status,
            isActive: scheduling.isActive,
            driver: scheduling.driver,
            estimatedDuration: scheduling.estimatedDuration,
            createdAt: scheduling.createdAt,
            updatedAt: scheduling.updatedAt,
        };

        await this.searchService.indexDocument(
            this.INDEX_NAME,
            scheduling._id.toString(),
            document,
        );
    }

    /**
     * Update a scheduling document
     */
    async updateScheduling(id: string, scheduling: any): Promise<void> {
        await this.indexScheduling({ _id: id, ...scheduling });
    }

    /**
     * Delete a scheduling document
     */
    async deleteScheduling(id: string): Promise<void> {
        await this.searchService.deleteDocument(this.INDEX_NAME, id);
    }

    /**
     * Bulk index all schedulings from MongoDB
     */
    async reindexAll(): Promise<void> {
        this.logger.log('Starting full reindex of schedulings...');

        const schedulings = await this.schedulingModel
            .find()
            .populate('routeId', 'name')
            .lean()
            .exec();

        if (schedulings.length === 0) {
            this.logger.log('No schedulings to index');
            return;
        }

        const documents = schedulings.map((scheduling: any) => ({
            _id: scheduling._id.toString(),
            routeId: scheduling.routeId?._id?.toString() || scheduling.routeId,
            routeName: scheduling.routeId?.name || '',
            busIds: scheduling.busIds?.map((b: any) => b.toString()) || [],
            etd: scheduling.etd,
            eta: scheduling.eta,
            departureDate: scheduling.departureDate,
            arrivalDate: scheduling.arrivalDate,
            price: scheduling.price,
            availableSeats: scheduling.availableSeats,
            bookedSeats: scheduling.bookedSeats,
            status: scheduling.status,
            isActive: scheduling.isActive,
            driver: scheduling.driver,
            estimatedDuration: scheduling.estimatedDuration,
            createdAt: scheduling.createdAt,
            updatedAt: scheduling.updatedAt,
        }));

        await this.searchService.bulkIndex(this.INDEX_NAME, documents);
        this.logger.log(`Reindexed ${documents.length} schedulings`);
    }

    /**
     * Search schedulings with Elasticsearch
     */
    async searchSchedulings(filters: {
        query?: string;
        date?: string;
        status?: string;
        routeId?: string;
        page?: number;
        limit?: number;
    }): Promise<{ schedulings: any[]; total: number }> {
        const { query, date, status, routeId, page = 1, limit = 10 } = filters;
        const from = (page - 1) * limit;

        const must: any[] = [{ term: { isActive: true } }];

        // Text search on route name
        if (query) {
            must.push({
                match: {
                    routeName: {
                        query,
                        fuzziness: 'AUTO',
                    },
                },
            });
        }

        // Date filter
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            must.push({
                range: {
                    departureDate: {
                        gte: startOfDay.toISOString(),
                        lte: endOfDay.toISOString(),
                    },
                },
            });
        }

        // Status filter
        if (status) {
            must.push({ term: { status } });
        }

        // Route filter
        if (routeId) {
            must.push({ term: { routeId } });
        }

        const searchQuery = {
            query: {
                bool: { must },
            },
            sort: [{ departureDate: 'asc' }, { etd: 'asc' }],
        };

        const result = await this.searchService.search(
            this.INDEX_NAME,
            searchQuery,
            from,
            limit,
        );

        const schedulings = result.hits.hits.map((hit: any) => ({
            _id: hit._id,
            ...hit._source,
        }));

        return {
            schedulings,
            total: result.hits.total.value,
        };
    }
}
