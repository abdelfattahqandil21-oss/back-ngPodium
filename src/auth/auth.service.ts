import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { JwtService } from '@nestjs/jwt';

//
// ─── DTOs ─────────────────────────────────────────────
//

export class LoginDto {
  @ApiProperty({ description: 'Username or email', example: 'abdo' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ description: 'User password', example: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}


export class RegisterDto {
  @ApiProperty({ description: 'Full name', example: 'Abdo Kandel' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'User email', example: 'abdo@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'Unique username', example: 'abdo' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: 'Display nickname', example: 'Boudy' })
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @ApiProperty({ description: 'User phone (optional)', example: '01012345678', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'User password', example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({ description: 'Confirm password', example: 'password123' })
  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;

  @ApiProperty({ description: 'Profile image URL (optional)', example: 'https://example.com/image.jpg', required: false })
  @IsOptional()
  @IsString()
  imgProfile?: string;
}

export class Profile{
   @ApiProperty({ description: 'User ID', example: 1 })
   id: number;

   @ApiProperty({ description: 'User name', example: 'Abdo Kandel' })
   name: string;

   @ApiProperty({ description: 'User email', example: 'abdo@gmail.com' })
   email: string;

   @ApiProperty({ description: 'User username', example: 'abdo' })
   username: string;

   @ApiProperty({ description: 'User nickname', example: 'Boudy' })
   nickname: string;

   @ApiProperty({ description: 'User phone (optional)', example: '01012345678', required: false })
   phone?: string;

   @ApiProperty({ description: 'User profile image URL (optional)', example: 'https://example.com/image.jpg', required: false })
   imgProfile?: string;
}
export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imgProfile?: string;
}
//
// ─── SERVICE ─────────────────────────────────────────────
//

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}
private readonly dbPath = path.resolve('src', 'data', 'users.db.json');

  private async readUsers(): Promise<any[]> {
    try {
      const content = await fs.readFile(this.dbPath, 'utf8');
      if (!content.trim()) return [];
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.users)) return parsed.users;
      return [];
    } catch {
      return [];
    }
  }

  private async writeUsers(users: any[]): Promise<void> {
    const json = JSON.stringify(users, null, 2);
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.dbPath, json, 'utf8');
  }

  private findByIdentifier(users: any[], value: string) {
    return users.find((u) => u?.username === value || u?.email === value);
  }

  async login(dto: LoginDto) {
    const { value, password } = dto;
    const users = await this.readUsers();
    const user = this.findByIdentifier(users, value);

    if (!user) {
      throw new UnauthorizedException({ message: 'Invalid username or email', field: 'value' });
    }
    if (user.password !== password) {
      throw new UnauthorizedException({ message: 'Invalid password', field: 'password' });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      imgProfile: user.imgProfile,
    };
    const token = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '15d' });
    // persist refresh token to user record
    (user as any).refreshToken = refreshToken;
    await this.writeUsers(users);
    return { token, refreshToken };
  }

  async register(dto: RegisterDto) {
    const { name, email, username, nickname, phone, password, confirmPassword, imgProfile } = dto;

    // password match check
    if (password !== confirmPassword) {
      throw new BadRequestException({ message: 'Passwords do not match', field: 'confirmPassword' });
    }
    if(password.length < 8 && !password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
      throw new BadRequestException({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character', field: 'password' });
    }

    const users = await this.readUsers();

    if (users.some((u) => u.email === email)) {
      throw new BadRequestException({ message: 'Email already exists', field: 'email' });
    }
    if (users.some((u) => u.username === username)) {
      throw new BadRequestException({ message: 'Username is already exists', field: 'username' });
    }

    const nextId = users.reduce((max, u) => (u.id && u.id > max ? u.id : max), 0) + 1;
    const newUser = {
      id: nextId,
      name,
      email,
      username,
      nickname,
      phone,
      imgProfile,
      password,
    };
    users.push(newUser);
    await this.writeUsers(users);

    const payload = {
      sub: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      nickname: newUser.nickname,
      phone: newUser.phone,
      imgProfile: newUser.imgProfile,
    };
    const token = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '15d' });
    (newUser as any).refreshToken = refreshToken;
    await this.writeUsers(users);
    return { token, refreshToken };
  }

  async profile() {
    const users = await this.readUsers();
    const user = users[0];
    return {
      message: 'Profile fetched successfully',
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            nickname: user.nickname,
            phone: user.phone,
            imgProfile: user.imgProfile,
          }
        : null,
    };
  }

  async profileById(id: number) {
    const users = await this.readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException({ message: 'User not found', field: 'id' });
    }
    return {
      message: 'Profile fetched successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        nickname: user.nickname,
        phone: user.phone,
        imgProfile: user.imgProfile,
      },
    };
  }

  async listUsers() {
    const users = await this.readUsers();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      nickname: u.nickname,
      phone: u.phone,
      imgProfile: u.imgProfile,
    }));
  }

  async updateProfile(id: number, dto: UpdateProfileDto) {
    const users = await this.readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      throw new NotFoundException({ message: 'User not found', field: 'id' });
    }

    if (dto.email && users.some((u) => u.email === dto.email && u.id !== id)) {
      throw new BadRequestException({ message: 'Email already exists', field: 'email' });
    }
    if (dto.username && users.some((u) => u.username === dto.username && u.id !== id)) {
      throw new BadRequestException({ message: 'Username is already exists', field: 'username' });
    }

    const allowed = ['name', 'email', 'username', 'nickname', 'phone', 'imgProfile'] as const;
    const user = users[idx];
    for (const key of allowed) {
      if (key in dto && typeof (dto as any)[key] !== 'undefined') {
        (user as any)[key] = (dto as any)[key];
      }
    }

    await this.writeUsers(users);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      imgProfile: user.imgProfile,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    try {
      // Verify refresh token
      const decoded: any = this.jwt.verify(refreshToken);
      
      // Get user
      const users = await this.readUsers();
      const user = users.find((u) => u.id === decoded.sub);
      
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if stored refresh token matches
      const storedRefreshToken = (user as any).refreshToken;
      if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const payload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        phone: user.phone,
        imgProfile: user.imgProfile,
      };

      const newAccessToken = this.jwt.sign(payload, { expiresIn: '15m' });
      
      // Optionally rotate refresh token
      const newRefreshToken = this.jwt.sign(payload, { expiresIn: '15d' });
      (user as any).refreshToken = newRefreshToken;
      await this.writeUsers(users);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: number) {
    const users = await this.readUsers();
    const user = users.find((u) => u.id === userId);
    if (user && (user as any).refreshToken) {
      delete (user as any).refreshToken;
      await this.writeUsers(users);
    }
    return { success: true };
  }
}


