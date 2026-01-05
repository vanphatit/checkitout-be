import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';

export interface IUserStrategy {
  getRole(): UserRole;
  validateCreationData(userData: CreateUserDto): Promise<void>;
  processCreationData(userData: CreateUserDto): Promise<Partial<UserDocument>>;
  validateUpdateData(userData: UpdateUserDto): Promise<void>;
  processUpdateData(userData: UpdateUserDto): Promise<Partial<UserDocument>>;
}
