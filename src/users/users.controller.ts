import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Put,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import { UpdateUserDto, UserResponseDto } from './dto/user.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @Get('profile')
  async getProfile(@GetUser() user: any): Promise<UserResponseDto> {
    const userDoc = await this.usersService.findById(user.userId);
    if (!userDoc) {
      throw new Error('User not found');
    }
    return {
      id: (userDoc._id as any).toString(),
      email: userDoc.email,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      phone: userDoc.phone,
      role: userDoc.role,
      status: userDoc.status,
      roleData: userDoc.roleData,
      createdAt: userDoc.createdAt!,
      updatedAt: userDoc.updatedAt!,
    };
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @Put('profile')
  async updateProfile(
    @GetUser() user: any,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.update(
      user.userId,
      updateUserDto,
    );
    return {
      id: (updatedUser._id as any).toString(),
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      role: updatedUser.role,
      status: updatedUser.status,
      roleData: updatedUser.roleData,
      createdAt: updatedUser.createdAt!,
      updatedAt: updatedUser.updatedAt!,
    };
  }

  // Admin only endpoints
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => ({
      id: (user._id as any).toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      roleData: user.roleData,
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    }));
  }

  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.update(id, updateUserDto);
    return {
      id: (updatedUser._id as any).toString(),
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
      role: updatedUser.role,
      status: updatedUser.status,
      roleData: updatedUser.roleData,
      createdAt: updatedUser.createdAt!,
      updatedAt: updatedUser.updatedAt!,
    };
  }

  // Seller specific endpoints
  @ApiOperation({ summary: 'Get seller dashboard (Seller only)' })
  @ApiResponse({ status: 200, description: 'Seller dashboard data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @Get('seller/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerDashboard(@GetUser() user: any) {
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
  async manageProducts(@GetUser() user: any) {
    return {
      message: 'Product management access granted',
      userId: user.userId,
      role: user.role,
      availableActions: ['create', 'update', 'read'],
    };
  }
}
