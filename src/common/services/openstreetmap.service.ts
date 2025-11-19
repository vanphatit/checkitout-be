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

    constructor() {
        // Sử dụng OpenStreetMap Nominatim cho geocoding (hoàn toàn miễn phí)
        this.geocoder = NodeGeocoder({
            provider: 'openstreetmap',
            httpAdapter: 'https',
            apiKey: '', // OpenStreetMap không cần API key
            formatter: null,
        });
    }

    /**
     * Geocoding: Chuyển địa chỉ thành tọa độ
     */
    async geocodeAddress(address: string): Promise<GeocodeResult[]> {
        try {
            const results = await this.geocoder.geocode(address);

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
            throw new BadRequestException(`Lỗi khi geocode địa chỉ: ${error.message}`);
        }
    }

    /**
     * Reverse geocoding: Chuyển tọa độ thành địa chỉ
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
        try {
            const results = await this.geocoder.reverse({ lat: latitude, lon: longitude });

            if (!results.length) {
                throw new BadRequestException('Không tìm thấy địa chỉ cho tọa độ này');
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
            throw new BadRequestException(`Lỗi khi reverse geocode: ${error.message}`);
        }
    }

    /**
     * Tìm kiếm địa điểm theo tên
     */
    async searchPlaces(query: string, limit: number = 10): Promise<GeocodeResult[]> {
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
                headers: {
                    'User-Agent': 'CheckItOut-BE/1.0.0', // Nominatim yêu cầu User-Agent
                }
            });

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
            throw new BadRequestException(`Lỗi khi tìm kiếm địa điểm: ${error.message}`);
        }
    }

    /**
     * Tính toán route sử dụng OSRM (Open Source Routing Machine) - miễn phí
     */
    async calculateRoute(waypoints: LocationCoordinates[]): Promise<RouteInfo> {
        if (waypoints.length < 2) {
            throw new BadRequestException('Cần ít nhất 2 điểm để tính route');
        }

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

            const response = await axios.get(url, { params });

            if (response.data.code !== 'Ok') {
                throw new BadRequestException('Không thể tính toán route');
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
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(`Lỗi khi tính toán route: ${error.message}`);
        }
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
                headers: {
                    'Content-Type': 'text/plain',
                },
            });

            const elements = response.data.elements || [];

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
            throw new BadRequestException(`Lỗi khi tìm địa điểm gần nhất: ${error.message}`);
        }
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