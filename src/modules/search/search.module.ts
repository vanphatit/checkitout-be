import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
    imports: [
        ElasticsearchModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                node: configService.get('ELASTICSEARCH_NODE', 'http://localhost:9200'),
                maxRetries: 10,
                requestTimeout: 60000,
                sniffOnStart: false,
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService, ElasticsearchModule],
})
export class SearchModule { }
