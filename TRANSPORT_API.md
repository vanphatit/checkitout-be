# Transport Route Management API

API quản lý tuyến đường, trạm và lịch trình cho hệ thống đặt vé xe online sử dụng **OpenStreetMap** (hoàn toàn miễn phí).

## Features

### 🚏 Station Management (Quản lý trạm)
- CRUD operations cho các trạm xe
- Tích hợp OpenStreetMap để tạo trạm tự động từ địa chỉ
- Tìm kiếm trạm gần nhất
- Tìm kiếm trạm theo tên/địa chỉ
- Tìm trạm xe buýt từ OpenStreetMap

### 🛤️ Route Management (Quản lý tuyến đường)  
- CRUD operations cho các tuyến đường
- Tự động tính toán khoảng cách và thời gian từ OSRM (Open Source Routing Machine)
- Quản lý danh sách trạm trong tuyến
- Tìm kiếm tuyến đường theo trạm xuất phát và đích

### 📅 Scheduling Management (Quản lý lịch trình)
- CRUD operations cho lịch trình chạy xe
- Tạo lịch trình lặp lại theo ngày
- Quản lý số ghế còn trống
- Theo dõi trạng thái chuyến xe

## Environment Setup

Thêm cấu hình OpenStreetMap vào file `.env.local`:

```env
# OpenStreetMap Configuration (Free alternative to Google Maps)
# No API key required - uses free Nominatim and OSRM services
OSM_USER_AGENT=CheckItOut-BE/1.0.0
```

## Free Services Used

### 🗺️ **OpenStreetMap & Nominatim** (Geocoding)
- **URL**: `https://nominatim.openstreetmap.org/`
- **Purpose**: Chuyển đổi địa chỉ thành tọa độ và ngược lại
- **Cost**: Hoàn toàn miễn phí
- **Limit**: Reasonable use policy (1 request/second)

### 🚗 **OSRM** (Routing)
- **URL**: `http://router.project-osrm.org/`
- **Purpose**: Tính toán tuyến đường, khoảng cách và thời gian
- **Cost**: Hoàn toàn miễn phí
- **Limit**: Reasonable use policy

### 🔍 **Overpass API** (POI Search)
- **URL**: `https://overpass-api.de/api/interpreter`
- **Purpose**: Tìm kiếm các điểm quan tâm như trạm xe buýt
- **Cost**: Hoàn toàn miễn phí
- **Limit**: Fair use policy

## API Endpoints

### Station Endpoints

#### GET /api/v1/stations
Lấy danh sách tất cả trạm

#### POST /api/v1/stations
Tạo trạm mới (thủ công)

```json
{
  "name": "Bến xe Miền Tây",
  "address": "395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM",
  "longitude": 106.6296638,
  "latitude": 10.8230989,
  "description": "Bến xe chính thức của TPHCM",
  "contactPhone": "028-3868-4430",
  "operatingHours": "05:00 - 22:00",
  "facilities": ["Toilet", "Canteen", "Parking"]
}
```

#### POST /api/v1/stations/from-address
Tạo trạm từ địa chỉ sử dụng OpenStreetMap (tự động)

```json
{
  "address": "Bến xe Miền Tây, An Lạc, Bình Tân, TP.HCM",
  "name": "Bến xe Miền Tây",
  "description": "Bến xe chính thức",
  "facilities": ["Toilet", "Canteen"]
}
```

#### GET /api/v1/stations/search-places
Tìm kiếm địa điểm trên OpenStreetMap
- Query params: `q` (search query)

#### GET /api/v1/stations/nearby-bus-stations
Tìm trạm xe buýt gần nhất từ OpenStreetMap
- Query params: `longitude`, `latitude`, `radius` (optional)

#### GET /api/v1/stations/distance/:id1/:id2
Tính khoảng cách giữa 2 trạm

#### GET /api/v1/stations/nearby
Tìm trạm gần nhất
- Query params: `longitude`, `latitude`, `maxDistance` (optional)

#### GET /api/v1/stations/search
Tìm kiếm trạm
- Query params: `q` (search query)

### Route Endpoints

#### GET /api/v1/routes
Lấy danh sách tất cả tuyến đường

#### POST /api/v1/routes/manual
Tạo tuyến đường thủ công

```json
{
  "name": "Sài Gòn - Hồng Ngự",
  "departureStationId": "6...",
  "arrivalStationId": "6...",
  "intermediateStations": ["6..."],
  "distance": 150000,
  "duration": 180,
  "basePrice": 100000,
  "pricePerKm": 1000,
  "operatingHours": {
    "start": "05:00",
    "end": "22:00"
  },
  "operatingDays": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}
```

#### POST /api/v1/routes/auto
Tạo tuyến đường từ OpenStreetMap (tự động tính toán)

```json
{
  "name": "Sài Gòn - Cần Thơ",
  "departureStationId": "6...",
  "arrivalStationId": "6...",
  "intermediateStations": ["6..."],
  "basePrice": 120000,
  "operatingHours": {
    "start": "05:00",
    "end": "21:00"
  }
}
```

#### PUT /api/v1/routes/:id/recalculate
Tính toán lại khoảng cách từ OpenStreetMap

#### GET /api/v1/routes/by-stations
Tìm tuyến đường theo trạm
- Query params: `departureStationId`, `arrivalStationId`

#### GET /api/v1/routes/:id
Lấy chi tiết tuyến đường

#### PUT /api/v1/routes/:id
Cập nhật tuyến đường

#### DELETE /api/v1/routes/:id
Xóa tuyến đường

### Scheduling Endpoints

#### GET /api/v1/scheduling
Lấy danh sách lịch trình
- Query params: `routeId`, `date`, `status`, `busId` (optional filters)

#### POST /api/v1/scheduling
Tạo lịch trình mới

```json
{
  "routeId": "6...",
  "busId": "6...",
  "departureTime": "08:00",
  "departureDate": "2024-12-25",
  "price": 150000,
  "driver": {
    "name": "Nguyễn Văn A",
    "phone": "0123456789",
    "licenseNumber": "B123456789"
  },
  "status": "scheduled"
}
```

#### POST /api/v1/scheduling/bulk
Tạo lịch trình hàng loạt (cho nhiều ngày)

```json
{
  "routeId": "6...",
  "busId": "6...",
  "departureTime": "08:00", 
  "startDate": "2024-12-25",
  "endDate": "2024-12-31",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "price": 150000,
  "driver": {
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

#### GET /api/v1/scheduling/:id
Lấy chi tiết lịch trình

#### PUT /api/v1/scheduling/:id
Cập nhật lịch trình

#### DELETE /api/v1/scheduling/:id
Xóa lịch trình

#### PUT /api/v1/scheduling/:id/status
Cập nhật trạng thái lịch trình

#### GET /api/v1/scheduling/available-seats/:id
Lấy số ghế còn trống
  "note": "Chuyến xe thường"
}
```

#### POST /api/v1/scheduling/bulk
Tạo nhiều lịch trình cùng lúc (lặp theo ngày)

```json
{
  "routeId": "route_id",
  "busIds": ["bus_id"],
  "etd": "08:00",
  "startDate": "2024-12-01",
  "endDate": "2024-12-31",
  "recurringDays": ["monday", "wednesday", "friday"],
  "price": 150000
}
```

#### GET /api/v1/scheduling/available
Lấy lịch trình có sẵn cho đặt vé
- Query params: `routeId` (required), `date` (required)

#### PATCH /api/v1/scheduling/:id/seat-count
Cập nhật số ghế đã đặt

```json
{
  "bookedSeats": 25
}
```

## Data Flow Examples

## Workflow Examples

### 1. Tạo trạm từ địa chỉ (OpenStreetMap)
```bash
# Tạo trạm tự động từ địa chỉ
POST /api/v1/stations/from-address
{
  "address": "Bến xe Miền Đông, Bình Thạnh, TP.HCM",
  "name": "Bến xe Miền Đông",
  "facilities": ["Toilet", "WiFi", "Parking"]
}
```

### 2. Tìm kiếm địa điểm trên bản đồ
```bash
# Tìm kiếm bến xe ở Cần Thơ
GET /api/v1/stations/search-places?q=bến xe Cần Thơ

# Tìm trạm xe buýt gần vị trí
GET /api/v1/stations/nearby-bus-stations?longitude=105.123&latitude=10.456&radius=5000
```

### 3. Tạo tuyến đường với tính toán tự động
```bash
# Tạo các trạm trước
POST /api/v1/stations/from-address (tạo trạm khởi hành)
POST /api/v1/stations/from-address (tạo trạm đến)

# Tạo tuyến đường với tính toán tự động từ OpenStreetMap
POST /api/v1/routes/auto
{
  "name": "TP.HCM - Cần Thơ",
  "departureStationId": "station_1_id",
  "arrivalStationId": "station_2_id",
  "basePrice": 120000
}
```

### 4. Lập lịch trình hàng tuần
```bash
# Tạo lịch trình lặp lại từ thứ 2 đến thứ 6
POST /api/v1/scheduling/bulk
{
  "routeId": "route_id",
  "busId": "bus_id",
  "departureTime": "07:00",
  "startDate": "2024-12-01",
  "endDate": "2024-12-31",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "price": 120000
}
```

### 5. Tìm chuyến xe khả dụng
```bash
# Tìm chuyến xe theo tuyến và ngày
GET /api/v1/scheduling?routeId=route_id&date=2024-12-25&status=scheduled

# Kiểm tra số ghế còn trống
GET /api/v1/scheduling/available-seats/scheduling_id
```

## Authentication & Authorization

Tất cả các endpoint đều yêu cầu authentication (trừ GET endpoints cho khách hàng).

### Required Roles:
- **ADMIN**: Full access to all operations
- **SELLER**: Can create/update stations, routes, and scheduling
- **CUSTOMER**: Read-only access to public endpoints

## Google Maps Integration

### Tính năng tự động:
1. **Station từ Google Places**: Tự động lấy tên, địa chỉ, tọa độ, thông tin liên hệ
2. **Route calculation**: Tự động tính toán khoảng cách, thời gian, và lưu route data
3. **Distance Matrix**: Hỗ trợ tính toán khoảng cách giữa nhiều điểm

### Tính năng thủ công:
1. Nhập thông tin trạm bằng tay
2. Nhập khoảng cách và thời gian ước tính
3. Quản lý thông tin chi tiết theo nhu cầu

## Database Schema

### Station
- Vị trí địa lý (GeoJSON Point)
- Thông tin liên hệ và tiện ích
- Tích hợp Google Places

### Route
- Danh sách trạm theo thứ tự
- Thông tin khoảng cách và thời gian
- Dữ liệu Google Maps (polyline, bounds)
- Giá cả và giờ hoạt động

### Scheduling
- Liên kết với Route và Bus
- Thông tin thời gian khởi hành/đến
- Quản lý ghế và trạng thái
- Hỗ trợ lịch trình lặp lại

## Notes

1. Google Maps API key cần được cấu hình đúng để sử dụng các tính năng tự động
2. Tất cả tọa độ được lưu theo định dạng [longitude, latitude] (GeoJSON standard)
3. Hệ thống hỗ trợ cả tạo thủ công và tự động để linh hoạt trong sử dụng
4. Soft delete được áp dụng cho tất cả entities để bảo toàn dữ liệu lịch sử