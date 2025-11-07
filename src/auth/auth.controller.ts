import { Body, Controller, Post, Get, UploadedFile, UseInterceptors, Param, ParseIntPipe, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthService, RegisterDto, LoginDto, UpdateProfileDto } from './auth.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { ApiBody, ApiConsumes, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Put } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
  
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Req() req: any) {
    return this.authService.logout(req.user.sub);
  }


  @Get('profile/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: Number })
  getProfileById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (req.user?.sub !== id) {
      throw new ForbiddenException('You can only access your own profile');
    }
    return this.authService.profileById(id);
  }

  @Post('upload/profile/:username')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // In production, use dist/data/uploads/profile
          // In development, use src/data/uploads/profile
          const isProduction = process.env.NODE_ENV === 'production';
          const dir = isProduction
            ? path.join(process.cwd(), 'dist', 'data', 'uploads', 'profile')
            : path.join(process.cwd(), 'src', 'data', 'uploads', 'profile');
          
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const username = req.params.username;
          // Always use .webp extension for consistency
          const name = `${username}.webp`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  uploadProfile(@Param('username') username: string, @UploadedFile() file: Express.Multer.File) {
    const url = `/uploads/profile/${file.filename}`;
    return { message: 'Profile image uploaded', url };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getUsers() {
    return this.authService.listUsers();
  }

  @Put('profile/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: Number })
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() dto: UpdateProfileDto,
  ) {
    if (req.user?.sub !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.authService.updateProfile(id, dto);
  }

}
