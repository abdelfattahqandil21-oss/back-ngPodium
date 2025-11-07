import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './posts.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/v1/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const l = Number.isFinite(Number(limit)) ? Number(limit) : 5;
    const o = Number.isFinite(Number(offset)) ? Number(offset) : 0;
    return this.posts.findAll(l, o);
  }
  @Get('count')
  async count() {
    return { total: await this.posts.count() };
  }
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.posts.findBySlug(slug);
  }

  @Get('search/query')
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    const l = Number.isFinite(Number(limit)) ? Number(limit) : undefined;
    return this.posts.search(q, l ?? 5);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreatePostDto, @Req() req: any) {
    return this.posts.create(dto, {
      sub: req.user.sub,
      username: req.user.username,
      imgProfile: req.user.imgProfile,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @Req() req: any,
  ) {
    return this.posts.update(id, dto, { sub: req.user.sub });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.posts.remove(id, { sub: req.user.sub });
  }

  @Post('upload/cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'covers');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '.png';
          const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
          cb(null, name);
        },
      }),
    }),
  )
  async uploadCover(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded' };
    }
    const publicUrl = `/uploads/covers/${file.filename}`;
    return { url: publicUrl };
  }

  @Post('upload/img')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'posts');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '.png';
          const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      return { message: 'No file uploaded', url: null };
    }
    const publicUrl = `/uploads/posts/${file.filename}`;
    console.log('✅ Image uploaded:', publicUrl);
    return { url: publicUrl, message: 'Image uploaded successfully' };
  }
}
