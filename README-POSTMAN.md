# 🚌 CheckItOut - Hệ thống quản lý xe khách

## 🚀 **AUTO-FLOW POSTMAN TESTING**

### 📁 **File duy nhất cần dùng:**
`postman/CheckItOut-AutoFlow.postman_collection.json`

### 🎯 **Cách test toàn bộ hệ thống bằng 1 click:**
1. **Import** collection vào Postman
2. **Click "Run Collection"** → Select All (8 requests) → **Run**
3. **Xem kết quả** → Tất cả variables tự động set!

---

## 🔥 **AUTO-FLOW SEQUENCE (8 bước tự động):**

### **1. Login Admin**
- **Endpoint:** `POST /auth/login`
- **Body:** `{"email": "admin@example.com", "password": "Admin123!"}`
- **Auto-Set:** `adminToken` variable

### **2. Get All Stations** 
- **Endpoint:** `GET /users/stations`
- **Auth:** Bearer token tự động
- **Auto-Set:** `stationId1`, `stationId2` từ response

### **3. Get All Buses**
- **Endpoint:** `GET /bus`
- **Auth:** Bearer token tự động  
- **Auto-Set:** `busId1` từ response

### **4. Create Route**
- **Endpoint:** `POST /users/routes`
- **Body:** Tự động dùng `stationId1`, `stationId2`
- **Auto-Set:** `routeId1` từ response

### **5. Create Schedule**
- **Endpoint:** `POST /schedules` 
- **Body:** Tự động dùng `routeId1`, `busId1`
- **Auto-Set:** `scheduleId1` từ response

### **6. Get All Schedules (Verify)**
- **Endpoint:** `GET /schedules`
- **Purpose:** Verify data đã tạo thành công

### **7. Get Bus Seats**
- **Endpoint:** `GET /seat/bus/{{busId1}}`
- **Auto-Set:** `seatId1` từ response

### **8. Final Check**
- **Endpoint:** `GET /users/profile`
- **Purpose:** Verify tất cả variables đã set đúng

---

## ✅ **Tính năng chính của hệ thống:**

### 🚏 **Station Management**
- Quản lý trạm xe với GPS coordinates
- Tính khoảng cách giữa các trạm
- Search và filter trạm

### 🛣️ **Route Management** 
- Tạo tuyến đường giữa các trạm
- Auto-calculate distance và duration
- Quản lý multiple routes

### 🚌 **Bus Management**
- Quản lý đội xe (Sleeper, Limousine, Standard)
- Track trạng thái xe (Active, Inactive, Maintenance)
- Quản lý số ghế theo loại xe

### 📅 **Schedule Management**
- Tạo lịch trình cho từng tuyến
- Quản lý giá vé, thời gian
- Track tài xế và thông tin liên hệ

### 💺 **Seat Management**
- Quản lý ghế theo từng xe
- Book/Reserve ghế cho khách
- Track trạng thái ghế (Available, Booked, Blocked)

### 🔐 **Authentication & Authorization**
- Multi-role system (Admin, Seller, Customer)
- JWT token-based authentication
- Protected routes theo role

### 📊 **Excel Import/Export**
- Import bulk schedules từ Excel
- Validate data trước khi import
- Download template chuẩn

---

## 🛠️ **Prerequisites để chạy test:**

### **Server Setup:**
```bash
npm run start:dev  # Server chạy tại http://localhost:3000
```

### **Database Setup:**
- MongoDB đã setup với collections cần thiết
- Admin user đã tồn tại: `admin@example.com / Admin123!`
- Basic data (stations, buses) có sẵn

### **Expected Results sau khi chạy Auto-Flow:**
```
✅ adminToken: SET
✅ stationId1: 673xxxxxxxxxxxxx 
✅ stationId2: 673xxxxxxxxxxxxx
✅ busId1: 673xxxxxxxxxxxxx
✅ routeId1: 673xxxxxxxxxxxxx  
✅ scheduleId1: 673xxxxxxxxxxxxx
✅ seatId1: 673xxxxxxxxxxxxx
```

---

## 🎉 **Usage Flow:**

### **Development Testing:**
1. Run Auto-Flow collection → Get all variables set
2. Use variables for manual API testing
3. Test advanced features (Excel import, seat booking, etc.)

### **Production Validation:**
1. Update baseUrl to production
2. Update admin credentials
3. Run Auto-Flow to verify deployment
4. Run additional manual tests for edge cases

### **CI/CD Integration:**
1. Export collection với Newman
2. Add to CI pipeline: `newman run CheckItOut-AutoFlow.postman_collection.json`
3. Parse results for automated testing

---

## 📈 **Advanced Features Available:**

- **🌍 OpenStreetMap Integration:** Real GPS coordinates và distance calculation
- **📍 Geolocation Services:** Find nearby stations, route optimization
- **🔄 Real-time Data Sync:** Auto-update relationships khi data thay đổi  
- **🛡️ Data Validation:** Model-level constraints và business rules
- **📊 Excel Processing:** Comprehensive import/export với validation
- **⚡ Performance Optimization:** Pagination, caching, query optimization

**🚀 Import collection → Click Run → Test toàn bộ hệ thống trong 30 giây!**