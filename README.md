# CheckItOut Backend API

A robust NestJS backend application with authentication, email verification, and session management.

## 🚀 Features

- **Authentication System**: JWT-based authentication with access and refresh tokens
- **User Status Management**: Three-state user status (PENDING, ACTIVE, INACTIVE)
- **Email Verification**: Mandatory email verification with automatic resend
- **Session Management**: Redis-based session storage for refresh tokens
- **Password Reset**: Secure password reset flow with email notifications
- **Rate Limiting**: Configurable rate limiting for API endpoints
- **Email Service**: Gmail SMTP integration for transactional emails
- **MongoDB Integration**: Mongoose ODM with schema validation
- **API Documentation**: Swagger/OpenAPI documentation
- **Security**: CORS, validation pipes, HTTP-only cookies, status-based access control

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Docker (for MongoDB and Redis)
- Gmail account (for SMTP)

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd checkitout-be
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Create `.env.local` file in the root directory:

   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/checkitout

   # JWT Configuration
   JWT_ACCESS_SECRET=your-access-secret
   JWT_REFRESH_SECRET=your-refresh-secret
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0

   # Email Configuration (Gmail SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=your-gmail@gmail.com
   FROM_NAME=CheckItOut

   # Application
   PORT=3000
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB and Redis with Docker**

   ```bash
   # MongoDB
   docker run -d --name mongodb -p 27017:27017 mongo:latest

   # Redis
   docker run -d --name redis -p 6379:6379 redis:latest
   ```

## 🚦 Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

The application will be available at:

- **API**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api/docs

## 📚 API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint           | Description               | Rate Limit |
| ------ | ------------------ | ------------------------- | ---------- |
| POST   | `/login`           | User login                | 5 req/5min |
| POST   | `/register`        | User registration         | 3 req/5min |
| POST   | `/refresh-token`   | Refresh access token      | Default    |
| POST   | `/logout`          | User logout               | Default    |
| POST   | `/forgot-password` | Request password reset    | 3 req/5min |
| POST   | `/reset-password`  | Reset password with token | 3 req/5min |
| POST   | `/verify-email`    | Verify email address      | 10 req/min |

### Request/Response Examples

#### Register User

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:

```json
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "status": "PENDING"
  }
}
```

#### Verify Email

```bash
POST /api/v1/auth/verify-email
Content-Type: application/json

{
  "token": "verification_token_from_email"
}
```

#### Login User

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Success Response (ACTIVE user):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "status": "ACTIVE"
  },
  "accessToken": "jwt_access_token"
}
```

**Error Response (PENDING user):**

```json
{
  "message": "Please verify your email before logging in. A new verification email has been sent.",
  "statusCode": 401
}
```

**Error Response (INACTIVE user):**

```json
{
  "message": "Account has been deactivated. Please contact support.",
  "statusCode": 401
}
```

_Note: Refresh token is set as HTTP-only cookie for successful logins_

## 🗃️ Database Schema

### User Schema (MongoDB)

```javascript
{
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'PENDING', 'INACTIVE'],
    default: 'PENDING'
  },
  createdAt: { type: Date, auto-generated },
  updatedAt: { type: Date, auto-generated }
}
```

### User Status States

- **PENDING**: Email not verified yet (default after registration)
- **ACTIVE**: Email verified, can login normally
- **INACTIVE**: Account deactivated, cannot login

## 🔄 Authentication Flow

### Registration & Email Verification Flow

1. User registers with email and password
2. System creates user account with status: PENDING
3. System generates verification token (24h expiry)
4. System sends verification email with token
5. User clicks email link and calls verify-email endpoint
6. System verifies token and updates user status to ACTIVE
7. System sends welcome email
8. User can now login normally

### Login Flow

1. User provides email and password
2. System validates credentials (email + password)
3. System checks user status and responds accordingly:
   - **ACTIVE**: ✅ Login successful, generates and returns tokens
   - **PENDING**: ❌ Login blocked, automatically resends verification email
   - **INACTIVE**: ❌ Login denied, account deactivated
4. For ACTIVE users only:
   - Generates access token (15min) and refresh token (7 days)
   - Access token returned in response body
   - Refresh token set as HTTP-only cookie
   - Refresh token also stored in Redis with TTL
5. For PENDING users:
   - New verification email sent automatically
   - User must verify email before attempting login again

### Token Refresh Flow

1. Client sends refresh token via cookie
2. System validates token against Redis storage
3. System generates new token pair
4. Old refresh token replaced in Redis
5. New tokens returned/set

## 📧 Email Templates

The system sends the following emails:

1. **Email Verification**: Sent after registration
2. **Welcome Email**: Sent after email verification
3. **Password Reset**: Sent when user requests password reset

All emails are HTML-formatted with responsive design.

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: Separate access and refresh token secrets
- **HTTP-Only Cookies**: Refresh tokens stored securely
- **CORS Configuration**: Cross-origin request handling
- **Rate Limiting**: Endpoint-specific rate limits
- **Input Validation**: DTO validation with class-validator
- **Session Management**: Redis-based session storage
- **Status-Based Access Control**: Only ACTIVE users can access protected routes
- **Mandatory Email Verification**: Users must verify email before login
- **Automatic Email Resend**: Verification emails resent when PENDING users try to login

## 🧪 Testing with Postman

Import the Postman collection from `/postman/` directory:

1. **Collection**: `CheckItOut-Auth-API.postman_collection.json`
2. **Environment**: `CheckItOut-Development.postman_environment.json`

The collection includes:

- All authentication endpoints
- Pre-request scripts for token management
- Test scripts for response validation
- Environment variables for base URL and tokens

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**

   ```bash
   # Check if MongoDB is running
   docker ps | grep mongodb

   # Start MongoDB if not running
   docker start mongodb
   ```

2. **Redis Connection Failed**

   ```bash
   # Check if Redis is running
   docker ps | grep redis

   # Start Redis if not running
   docker start redis
   ```

3. **Email Not Sending**
   - Verify Gmail SMTP credentials
   - Ensure app-specific password is used
   - Check if 2FA is enabled on Google account

4. **User Status Issues**
   - Check MongoDB to verify user status field
   - Ensure email verification tokens are in Redis
   - Verify SMTP service is working for resend emails

## 🧪 Testing Examples

### Complete User Registration & Login Flow

```bash
# 1. Register new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Response: User created with status: PENDING

# 2. Try to login (should fail and resend verification)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'

# Response: 401 - Please verify your email...

# 3. Verify email (get token from email)
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your_verification_token_from_email"
  }'

# Response: Email verified successfully

# 4. Login again (should succeed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'

# Response: Success with tokens
```

## 🔧 Development Scripts

```bash
# Development
npm run start:dev          # Start in watch mode
npm run start:debug        # Start in debug mode

# Production
npm run build              # Build the application
npm run start:prod         # Start production server

# Testing
npm run test               # Run unit tests
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Run tests with coverage

# Linting & Formatting
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues
npm run format             # Format code with Prettier
```

## 📋 Project Structure

```text
checkitout-be/
├── src/                                # Main source code
│   ├── auth/                          # Authentication module
│   │   ├── dto/                       # Data Transfer Objects for validation
│   │   │   ├── login.dto.ts           # DTO for login (email, password)
│   │   │   ├── register.dto.ts        # DTO for registration (email, password, firstName, lastName)
│   │   │   └── verify-email.dto.ts    # DTO for email verification (token)
│   │   ├── guards/                    # Route protection
│   │   │   ├── jwt-auth.guard.ts      # Guard for JWT token validation
│   │   │   └── local-auth.guard.ts    # Guard for local authentication
│   │   ├── strategies/                # Passport authentication strategies
│   │   │   ├── jwt.strategy.ts        # JWT token validation handling
│   │   │   └── local.strategy.ts      # Login with email/password handling
│   │   ├── auth.controller.ts         # API endpoints: /register, /login, /logout, /verify-email
│   │   ├── auth.service.ts            # Business logic: hash password, create tokens, verify email
│   │   └── auth.module.ts             # Module configuration: import services, strategies, guards
│   │
│   ├── users/                         # User management module
│   │   ├── entities/                  # Database schemas
│   │   │   └── user.entity.ts         # MongoDB schema: email, password, name, status, timestamps
│   │   ├── enums/                     # Enum definitions
│   │   │   └── user-status.enum.ts    # Enum: ACTIVE, PENDING, INACTIVE
│   │   ├── dto/                       # DTOs for user operations
│   │   ├── users.service.ts           # CRUD operations: create user, find, update status
│   │   └── users.module.ts            # Module configuration: MongoDB connection, services
│   │
│   ├── modules/                       # Shared services modules
│   │   ├── redis/                     # Redis service for session management
│   │   │   ├── redis.service.ts       # Redis connection, store/retrieve refresh tokens
│   │   │   └── redis.module.ts        # Redis connection configuration
│   │   └── email/                     # Email service for sending emails
│   │       ├── email.service.ts       # Gmail SMTP, templates for verification/welcome emails
│   │       └── email.module.ts        # NodeMailer configuration with Gmail
│   │
│   ├── common/                        # Utilities and shared code
│   │   └── decorators/                # Custom decorators
│   │       └── get-user.decorator.ts  # Decorator to extract user from request object
│   │
│   ├── app.controller.ts              # Main controller (health check)
│   ├── app.controller.spec.ts         # Unit tests for app controller
│   ├── app.service.ts                 # Main app service
│   ├── app.module.ts                  # Root module: import all modules, global configuration
│   └── main.ts                        # Entry point: initialize NestJS app, CORS, Swagger
│
├── test/                              # End-to-end tests
│   ├── app.e2e-spec.ts               # E2E test cases
│   └── jest-e2e.json                 # Jest config for E2E testing
│
├── postman/                           # API testing collection
│   ├── CheckItOut Auth APIs.postman_collection.json    # Postman collection
│   └── CheckItOut - Local.postman_environment.json    # Environment variables
│
├── dist/                              # Compiled JavaScript files (after build)
├── node_modules/                      # Dependencies
│
├── .env.example                       # Template for environment variables
├── .env.local                         # Local environment config (not committed)
├── .gitignore                         # Git ignore rules
├── .prettierrc                        # Prettier formatting config
├── eslint.config.mjs                  # ESLint configuration
├── nest-cli.json                      # NestJS CLI configuration
├── package.json                       # Dependencies and scripts
├── package-lock.json                  # Lockfile for exact versions
├── tsconfig.json                      # TypeScript compiler config
├── tsconfig.build.json                # TypeScript build config
└── README.md                          # Documentation (this file)
```

### 🔍 Component Details

#### **Authentication Flow (`src/auth/`)**

- **Controllers**: Handle HTTP requests for registration, login, email verification
- **Services**: Business logic like password hashing, JWT token creation, email verification
- **Guards**: Protect routes, validate tokens before allowing access
- **Strategies**: Implement Passport strategies for JWT and local authentication
- **DTOs**: Validation rules for input data from client

#### **User Management (`src/users/`)**

- **Entities**: MongoDB schema definition with Mongoose
- **Enums**: UserStatus enum replacing boolean fields (isActive, isEmailVerified)
- **Services**: CRUD operations, business logic for user data

#### **Shared Services (`src/modules/`)**

- **Redis**: Session management, store refresh tokens with TTL
- **Email**: SMTP service with Gmail, email templates for verification

#### **Configuration Files**

- **Environment**: Separate configs for development/production
- **TypeScript**: Strict type checking, path mapping
- **ESLint/Prettier**: Code quality and formatting standards
