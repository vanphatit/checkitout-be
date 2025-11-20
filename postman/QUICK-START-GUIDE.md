# 🚌 CheckItOut API - Hướng dẫn sử dụng nhanh

## 📥 **Import Postman Collection**

1. **Mở Postman**
2. **Click Import** → **Upload Files**  
3. **Chọn file:** `postman/CheckItOut-Complete-API-Test.postman_collection.json`

## 🚀 **Quy trình Test nhanh (5 phút)**

### **Bước 1: Authentication & Seed Data**
```
1. Login Admin          → Lấy token admin
2. Seed All Data        → Tạo 240+ lịch trình
```

### **Bước 2: Test Core Features** 
```
3. Get All Stations     → Xem 10 trạm xe
4. Get All Routes       → Xem 15 tuyến đường  
5. Get All Buses        → Xem 20 xe khách
6. Get All Schedules    → Xem 240+ lịch trình
```

### **Bước 3: Test Advanced Features**
```
7. Create New Station   → Tạo trạm mới
8. Calculate Distance   → Tính khoảng cách 2 trạm
9. Search Places        → Tìm địa điểm trên OpenStreetMap
10. Book Seats          → Đặt ghế cho khách
```

## ⚡ **Features Highlights**

### **🔐 Built-in Test Accounts**
- **Admin:** admin1@checkitout.com / Admin123!
- **Seller:** seller1@checkitout.com / Seller123!  
- **Customer:** user1@checkitout.com / User123!

### **🤖 Smart Automation**
- ✅ Auto-save tokens & IDs 
- ✅ Auto-populate variables
- ✅ Response validation
- ✅ Error handling

### **📊 Response DTO Features**
- ✅ Consistent pagination format
- ✅ Vietnamese field descriptions
- ✅ Type-safe responses  
- ✅ Professional JSON structure

### **🌍 Advanced Integration**
- ✅ OpenStreetMap geocoding
- ✅ Distance calculation
- ✅ Place search
- ✅ Geospatial queries

## 📋 **Test Results Summary**

Sau khi chạy **Seed All Data**:

| Resource | Count | Features |
|----------|-------|----------|
| 🚏 **Stations** | 10 | GPS coordinates, facilities, Vietnam locations |
| 🚌 **Buses** | 20 | Different types (SLEEPER/SEATER), driver info |
| 🛣️ **Routes** | 15+ | Auto-calculated distance, operating hours |
| 📅 **Schedules** | 240+ | 30-day period, multiple daily trips |

## 🔧 **Quick Troubleshooting**

### **Common Issues:**
1. **401 Unauthorized** → Run "Login Admin" first
2. **Empty data responses** → Run "Seed All Data"  
3. **Server not responding** → Check `localhost:9091`

### **Verify Setup:**
```bash
# Check server status
curl http://localhost:9091/api/v1/stations?limit=1

# Expected response:
{
  "statusCode": 200,
  "success": true,
  "data": { "data": [...], "total": 10 }
}
```

## 🎯 **Key Endpoints to Test**

| Category | Endpoint | Description |
|----------|----------|-------------|
| 🔐 Auth | `POST /auth/login` | Get access token |
| 🌱 Seeder | `POST /seeder/seed-all` | Generate test data |
| 🚏 Stations | `GET /stations` | List with pagination |
| 🛣️ Routes | `GET /routes` | Auto-calculated routes |
| 📅 Schedules | `GET /scheduling` | Complex scheduling data |
| 💺 Seats | `POST /seats/.../book` | Book customer seats |

## 🎉 **Success Indicators**

✅ **Login successful** → Token saved automatically  
✅ **Seed completed** → 240+ schedules created  
✅ **Stations loaded** → 10 Vietnam bus stations  
✅ **Routes active** → 15 different city connections  
✅ **Response DTOs** → Professional JSON format  

**Happy Testing! 🚀**

---
*Generated on: November 20, 2025*  
*API Version: v1.0*  
*Response DTOs: ✅ Active*