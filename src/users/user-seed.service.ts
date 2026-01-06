import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import * as bcrypt from 'bcryptjs';

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}

@Injectable()
export class UserSeedService implements OnModuleInit {
  private readonly logger = new Logger(UserSeedService.name);

  private readonly seedUsers: SeedUser[] = [
    {
      email: 'admin1@checkitout.com',
      password: 'Admin123!',
      firstName: 'Alice',
      lastName: 'Admin',
      phone: '0901234567',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'admin2@checkitout.com',
      password: 'Admin456!',
      firstName: 'Bob',
      lastName: 'Admin',
      phone: '0901234568',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'seller1@checkitout.com',
      password: 'Seller123!',
      firstName: 'Sally',
      lastName: 'Shopper',
      phone: '0912345671',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'seller2@checkitout.com',
      password: 'Seller456!',
      firstName: 'Steven',
      lastName: 'Store',
      phone: '0912345672',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'seller3@checkitout.com',
      password: 'Seller789!',
      firstName: 'Sonia',
      lastName: 'Merchant',
      phone: '0912345673',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'user1@checkitout.com',
      password: 'User123!',
      firstName: 'Uma',
      lastName: 'Buyer',
      phone: '0387654321',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'user2@checkitout.com',
      password: 'User234!',
      firstName: 'Ulysses',
      lastName: 'Buyer',
      phone: '0387654322',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'user3@checkitout.com',
      password: 'User345!',
      firstName: 'Uriel',
      lastName: 'Buyer',
      phone: '0387654323',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'user4@checkitout.com',
      password: 'User456!',
      firstName: 'Umaira',
      lastName: 'Buyer',
      phone: '0387654324',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'user5@checkitout.com',
      password: 'User567!',
      firstName: 'Usha',
      lastName: 'Buyer',
      phone: '0387654325',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  ];

  constructor(private readonly usersService: UsersService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeedData();
  }

  private async ensureSeedData(): Promise<void> {
    for (const seed of this.seedUsers) {
      const existing = await this.usersService.findByEmail(seed.email);
      if (existing) {
        continue;
      }

      const hashedPassword = await bcrypt.hash(seed.password, 12);

      const seededUser = await this.usersService.create({
        email: seed.email,
        password: hashedPassword,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        role: seed.role,
        status: seed.status,
      });

      if (seed.status === UserStatus.ACTIVE) {
        await this.usersService.setEmailVerifiedTimestamp(
          (seededUser._id as any).toString(),
        );
      }

      this.logger.log(`Seeded default user ${seed.email} (${seed.role})`);
    }
  }
}
