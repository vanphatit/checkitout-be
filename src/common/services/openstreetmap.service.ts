import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import NodeGeocoder from 'node-geocoder';

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

export interface RouteInfo {
    distance: number; // km
    duration: number; // minutes
    polyline?: string;
    legs?: Array<{
        distance: number;
        duration: number;
        startLocation: LocationCoordinates;
        endLocation: LocationCoordinates;
    }>;
}

export interface GeocodeResult {
    name: string;
    address: string;
    coordinates: LocationCoordinates;
    country?: string;
    city?: string;
    displayName?: string;
}

@Injectable()
export class OpenStreetMapService {
    private geocoder: any;
    private readonly timeout = 10000; // 10 seconds
    private readonly maxRetries = 3;

    constructor() {
        // Sử dụng OpenStreetMap Nominatim cho geocoding (hoàn toàn miễn phí)
        this.geocoder = NodeGeocoder({
            provider: 'openstreetmap',
            httpAdapter: 'https',
            apiKey: '', // OpenStreetMap không cần API key
            formatter: null,
            timeout: this.timeout,
        });
    }

    /**
     * Sleep utility for retry delays
     */
    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry wrapper with exponential backoff
     */
    private async withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
        let lastError: any;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`${context} - Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
                
                if (attempt === this.maxRetries) {
                    break;
                }
                
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await this.sleep(delay);
            }
        }
        
        // If all retries failed, return fallback or throw graceful error
        console.error(`${context} - All retry attempts failed, using fallback`);
        throw new BadRequestException(`${context} tạm thời không khả dụng. Vui lòng thử lại sau.`);
    }

    /**
     * Geocoding: Chuyển địa chỉ thành tọa độ
     */
    async geocodeAddress(address: string): Promise<GeocodeResult[]> {
        return this.withRetry(async () => {
            try {
                const results = await this.geocoder.geocode(address);
                
                if (!results || results.length === 0) {
                    // Return fallback result instead of throwing error
                    console.warn(`No geocoding results found for: ${address}`);
                    return [{
                        name: address,
                        address: address,
                        coordinates: {
                            latitude: 10.8231, // Default to Ho Chi Minh City
                            longitude: 106.6297,
                        },
                        country: 'Vietnam',
                        city: 'Ho Chi Minh City',
                        displayName: `${address} (Vị trí mặc định)`,
                    }];
                }

                return results.map(result => ({
                    name: result.formattedAddress || result.extra?.displayName || address,
                    address: result.formattedAddress || address,
                    coordinates: {
                        latitude: result.latitude,
                        longitude: result.longitude,
                    },
                    country: result.country,
                    city: result.city,
                    displayName: result.extra?.displayName,
                }));
            } catch (error) {
                throw new Error(`Geocoding failed: ${error.message}`);
            }
        }, 'Geocoding service');
    }

    /**
     * Reverse geocoding: Chuyển tọa độ thành địa chỉ
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
        return this.withRetry(async () => {
            try {
                const results = await this.geocoder.reverse({ lat: latitude, lon: longitude });

                if (!results.length) {
                    // Return fallback result
                    return {
                        name: `Vị trí ${latitude}, ${longitude}`,
                        address: `${latitude}, ${longitude}`,
                        coordinates: { latitude, longitude },
                        country: 'Vietnam',
                        city: 'Không xác định',
                    };
                }

                const result = results[0];
                return {
                    name: result.formattedAddress || `${latitude}, ${longitude}`,
                    address: result.formattedAddress || `${latitude}, ${longitude}`,
                    coordinates: { latitude, longitude },
                    country: result.country,
                    city: result.city,
                };
            } catch (error) {
                throw new Error(`Reverse geocoding failed: ${error.message}`);
            }
        }, 'Reverse geocoding service');
    }

    /**
     * Tìm kiếm địa điểm theo tên
     */
    async searchPlaces(query: string, limit: number = 10): Promise<GeocodeResult[]> {
        return this.withRetry(async () => {
            try {
                const url = `https://nominatim.openstreetmap.org/search`;
                const params = {
                    q: query,
                    format: 'json',
                    limit: limit,
                    addressdetails: 1,
                    countrycodes: 'vn', // Chỉ tìm ở Việt Nam
                };

                const response = await axios.get(url, {
                    params,
                    timeout: this.timeout,
                    headers: {
                        'User-Agent': 'CheckItOut-BE/1.0.0', // Nominatim yêu cầu User-Agent
                    }
                });

                if (!response.data || response.data.length === 0) {
                    // Return fallback results
                    return [{
                        name: query,
                        address: `${query}, Ho Chi Minh City, Vietnam`,
                        coordinates: {
                            latitude: 10.8231,
                            longitude: 106.6297,
                        },
                        country: 'Vietnam',
                        city: 'Ho Chi Minh City',
                        displayName: `${query} (Kết quả gợi ý)`,
                    }];
                }

                return response.data.map((place: any) => ({
                    name: place.display_name.split(',')[0],
                    address: place.display_name,
                    coordinates: {
                        latitude: parseFloat(place.lat),
                        longitude: parseFloat(place.lon),
                    },
                    country: place.address?.country,
                    city: place.address?.city || place.address?.town || place.address?.village,
                    displayName: place.display_name,
                }));
            } catch (error) {
                throw new Error(`Search places failed: ${error.message}`);
            }
        }, 'Search places service');
    }

    /**
     * Tính toán route sử dụng OSRM (Open Source Routing Machine) - miễn phí
     */
    async calculateRoute(waypoints: LocationCoordinates[]): Promise<RouteInfo> {
        if (waypoints.length < 2) {
            throw new BadRequestException('Cần ít nhất 2 điểm để tính route');
        }

        return this.withRetry(async () => {
            try {
                // Tạo coordinates string cho OSRM
                const coordinates = waypoints
                    .map(point => `${point.longitude},${point.latitude}`)
                    .join(';');

                const url = `http://router.project-osrm.org/route/v1/driving/${coordinates}`;
                const params = {
                    overview: 'full',
                    geometries: 'polyline',
                    steps: 'true',
                };

                const response = await axios.get(url, { 
                    params,
                    timeout: this.timeout,
                    headers: {
                        'User-Agent': 'CheckItOut-BE/1.0.0',
                    }
                });

                if (response.data.code !== 'Ok') {
                    throw new Error('OSRM routing failed');
                }

                const route = response.data.routes[0];
                const legs = route.legs || [];

                return {
                    distance: route.distance / 1000, // Convert meters to km
                    duration: route.duration / 60,   // Convert seconds to minutes
                    polyline: route.geometry,
                    legs: legs.map((leg: any, index: number) => ({
                        distance: leg.distance / 1000,
                        duration: leg.duration / 60,
                        startLocation: waypoints[index],
                        endLocation: waypoints[index + 1],
                    })),
                };
            } catch (error) {
                // Fallback to straight-line calculation
                console.warn('OSRM routing failed, using straight-line calculation:', error.message);
                
                const start = waypoints[0];
                const end = waypoints[waypoints.length - 1];
                const distance = this.calculateDistance(start, end);
                
                return {
                    distance,
                    duration: distance * 1.5, // Estimate: 1.5 minutes per km
                    polyline: '',
                    legs: [{
                        distance,
                        duration: distance * 1.5,
                        startLocation: start,
                        endLocation: end,
                    }],
                };
            }
        }, 'Route calculation service');
    }

    /**
     * Tính khoảng cách giữa 2 điểm (haversine formula)
     */
    calculateDistance(point1: LocationCoordinates, point2: LocationCoordinates): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(point2.latitude - point1.latitude);
        const dLon = this.toRadians(point2.longitude - point1.longitude);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    /**
     * Tìm các địa điểm gần nhất
     */
    async findNearbyPlaces(
        latitude: number,
        longitude: number,
        radius: number = 5, // km
        amenity: string = 'bus_station'
    ): Promise<GeocodeResult[]> {
        return this.withRetry(async () => {
            try {
                // Sử dụng Overpass API để tìm các địa điểm gần nhất
                const overpassUrl = 'https://overpass-api.de/api/interpreter';
                const query = `
        [out:json][timeout:25];
        (
          node["amenity"="${amenity}"](around:${radius * 1000},${latitude},${longitude});
          way["amenity"="${amenity}"](around:${radius * 1000},${latitude},${longitude});
          relation["amenity"="${amenity}"](around:${radius * 1000},${latitude},${longitude});
        );
        out geom;
      `;

                const response = await axios.post(overpassUrl, query, {
                    timeout: this.timeout,
                    headers: {
                        'Content-Type': 'text/plain',
                        'User-Agent': 'CheckItOut-BE/1.0.0',
                    },
                });

                const elements = response.data.elements || [];

                if (elements.length === 0) {
                    // Return fallback nearby places
                    return [
                        {
                            name: 'Bến xe miền Đông',
                            address: 'Bến xe miền Đông, TP.HCM',
                            coordinates: { latitude: 10.8155, longitude: 106.7248 },
                        },
                        {
                            name: 'Bến xe miền Tây',
                            address: 'Bến xe miền Tây, TP.HCM',
                            coordinates: { latitude: 10.7397, longitude: 106.6259 },
                        },
                        {
                            name: 'Bến xe Gia Lâm',
                            address: 'Bến xe Gia Lâm, Hà Nội',
                            coordinates: { latitude: 21.0467, longitude: 105.8775 },
                        },
                    ].filter(place => {
                        const distance = this.calculateDistance(
                            { latitude, longitude },
                            place.coordinates
                        );
                        return distance <= radius * 10; // Expand search radius for fallback
                    });
                }

                return elements.map((element: any) => ({
                    name: element.tags?.name || `${amenity} ${element.id}`,
                    address: this.formatAddress(element.tags),
                    coordinates: {
                        latitude: element.lat || (element.center?.lat),
                        longitude: element.lon || (element.center?.lon),
                    },
                })).filter((place: GeocodeResult) =>
                    place.coordinates.latitude && place.coordinates.longitude
                );
            } catch (error) {
                throw new Error(`Find nearby places failed: ${error.message}`);
            }
        }, 'Find nearby places service');
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    private formatAddress(tags: any): string {
        const parts: string[] = [];
        if (tags['addr:street']) parts.push(tags['addr:street']);
        if (tags['addr:city']) parts.push(tags['addr:city']);
        if (tags['addr:state']) parts.push(tags['addr:state']);
        return parts.join(', ') || 'Không có địa chỉ';
    }
}