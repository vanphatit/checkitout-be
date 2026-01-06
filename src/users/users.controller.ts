import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Put,
  Param,
  Delete,
  NotFoundException,
  Query,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { UserActivityResponseDto } from './dto/user-activity.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import * as bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

interface JwtUser {
  userId: string;
  role: UserRole;
  email?: string;
  phone: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Region: Self-service endpoints

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @Get('profile')
  async getProfile(@GetUser() user: JwtUser): Promise<UserResponseDto> {
    const userDoc = await this.usersService.findById(user.userId);
    if (!userDoc) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toResponseDto(userDoc);
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @Put('profile')
  async updateProfile(
    @GetUser() user: JwtUser,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.update(
      user.userId,
      updateUserDto,
      { actorId: user.userId },
    );
    return this.usersService.toResponseDto(updatedUser);
  }

  @ApiOperation({ summary: 'Upload/update user avatar' })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file format' })
  @ApiConsumes('multipart/form-data')
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @GetUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file format. Only JPG, PNG, and WEBP are allowed',
      );
    }

    const updatedUser = await this.usersService.updateAvatar(
      user.userId,
      file,
      { actorId: user.userId },
    );
    return this.usersService.toResponseDto(updatedUser);
  }

  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiResponse({
    status: 200,
    description: 'Avatar deleted successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  @Delete('profile/avatar')
  async deleteAvatar(@GetUser() user: JwtUser): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.deleteAvatar(user.userId, {
      actorId: user.userId,
    });
    return this.usersService.toResponseDto(updatedUser);
  }

  // Seller specific endpoints
  @ApiOperation({ summary: 'Get seller dashboard (Seller only)' })
  @ApiResponse({ status: 200, description: 'Seller dashboard data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get('seller/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerDashboard(@GetUser() user: JwtUser) {
    return {
      message: 'Seller dashboard data',
      userId: user.userId,
      role: user.role,
    };
  }

  // Role-based endpoint example
  @ApiOperation({ summary: 'Manage products (Seller and Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Product management access granted',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Post('manage-products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  async manageProducts(@GetUser() user: JwtUser) {
    return {
      message: 'Product management access granted',
      userId: user.userId,
      role: user.role,
      availableActions: ['create', 'update', 'read'],
    };
  }

  // Admin only endpoints
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers(@Query() query: GetUsersQueryDto): Promise<{
    items: UserResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const result = await this.usersService.findAllPaginated(query);
    return {
      items: result.items.map((user) => this.usersService.toResponseDto(user)),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @ApiOperation({ summary: 'Create new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createUser(
    @GetUser() admin: JwtUser,
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    // Hash password if provided (required for ACTIVE/PENDING users, optional for PRE_REGISTERED)
    const userData: CreateUserDto = { ...createUserDto };
    if (createUserDto.password) {
      userData.password = await bcrypt.hash(
        createUserDto.password,
        BCRYPT_SALT_ROUNDS,
      );
    }

    const createdUser = await this.usersService.create(userData, {
      actorId: admin.userId,
    });

    return this.usersService.toResponseDto(createdUser);
  }

  @ApiOperation({ summary: 'Get user activities (Admin or owner)' })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get(':id/activities')
  async getUserActivities(
    @Param('id') id: string,
    @GetUser() currentUser: JwtUser,
    @Query('limit') limit?: string,
  ): Promise<UserActivityResponseDto[]> {
    if (currentUser.role !== UserRole.ADMIN && currentUser.userId !== id) {
      throw new ForbiddenException('Access denied');
    }
    const parsedLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 200)
      : 50;
    const activities = await this.usersService.getUserActivities(
      id,
      parsedLimit,
    );

    return activities.map((activity) => ({
      id: (activity._id as any).toString(),
      userId: (activity.user as any).toString(),
      action: activity.action,
      performedBy: activity.performedBy
        ? (activity.performedBy as any).toString()
        : undefined,
      metadata: activity.metadata,
      description: activity.description,
      ipAddress: activity.ipAddress,
      device: activity.device,
      createdAt: activity.createdAt!,
    }));
  }

  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.toResponseDto(user);
  }

  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @GetUser() admin: JwtUser,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.update(id, updateUserDto, {
      actorId: admin.userId,
    });
    return this.usersService.toResponseDto(updatedUser);
  }

  @ApiOperation({ summary: 'Delete user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteUser(
    @Param('id') id: string,
    @GetUser() admin: JwtUser,
  ): Promise<{ message: string }> {
    await this.usersService.delete(id, { actorId: admin.userId });
    return { message: 'User removed successfully' };
  }
}
