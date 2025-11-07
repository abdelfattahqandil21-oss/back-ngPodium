import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Post } from './post.interface';
import { CreatePostDto, UpdatePostDto } from './posts.dto';

@Injectable()
export class PostsService {
  private readonly dbPath = path.resolve('src', 'data', 'posts.db.json');
  

  private async readPosts(): Promise<Post[]> {
    try {
      const content = await fs.readFile(this.dbPath, 'utf8');
      if (!content.trim()) return [];
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed as Post[];
      if (parsed && Array.isArray(parsed.posts)) return parsed.posts as Post[];
      return [];
    } catch {
      return [];
    }
  }

  private async writePosts(posts: Post[]): Promise<void> {
    const json = JSON.stringify(posts, null, 2);
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.dbPath, json, 'utf8');
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private sortDesc(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findAll(limit = 5, offset = 0): Promise<Post[]> {
    const posts = this.sortDesc(await this.readPosts());
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
    return posts.slice(safeOffset, safeOffset + safeLimit);
  }

  async count(): Promise<number> {
    const posts = await this.readPosts();
    return posts.length;
  }

  async findBySlug(slug: string): Promise<Post> {
    const posts = await this.readPosts();
    const post = posts.find((p) => p.slug === slug);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async search(q: string, limit = 5): Promise<Post[]> {
    const term = (q ?? '').toString().trim().toLowerCase();
    if (!term) return [];
    const posts = this.sortDesc(await this.readPosts());
    const filtered = posts.filter((p) => {
      const inHeader = p.header?.toLowerCase().includes(term);
      const inContent = p.content?.toLowerCase().includes(term);
      const inTags = Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(term));
      const inUser = p.userName?.toLowerCase().includes(term);
      return inHeader || inContent || inTags || inUser;
    });
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
    return filtered.slice(0, safeLimit);
  }

  async create(dto: CreatePostDto, user: { sub: number; username: string; imgProfile?: string }): Promise<Post> {
    const posts = await this.readPosts();
    const nextId = posts.reduce((m, p) => (p.id && p.id > m ? p.id : m), 0) + 1;
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.header);
    const now = new Date();
    const post: Post = {
      id: nextId,
      header: dto.header,
      content: dto.content,
      coverImg: dto.coverImg ?? '',
      createdAt: now,
      updatedAt: undefined,
      tags: dto.tags ?? [],
      slug,
      userId: user.sub,
      userName: user.username,
      userImg: user.imgProfile,
    };
    posts.push(post);
    await this.writePosts(posts);
    return post;
  }

  async update(id: number, dto: UpdatePostDto, user: { sub: number }): Promise<Post> {
    const posts = await this.readPosts();
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException('Post not found');
    if (posts[idx].userId !== user.sub) throw new UnauthorizedException('Not allowed');
    const current = posts[idx];
    const updated: Post = {
      ...current,
      header: dto.header ?? current.header,
      content: dto.content ?? current.content,
      coverImg: dto.coverImg ?? current.coverImg,
      tags: dto.tags ?? current.tags,
      slug: dto.slug ? this.slugify(dto.slug) : current.slug,
      updatedAt: new Date(),
    };
    posts[idx] = updated;
    await this.writePosts(posts);
    return updated;
  }

  async remove(id: number, user: { sub: number }): Promise<{ success: true }> {
    const posts = await this.readPosts();
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException('Post not found');
    if (posts[idx].userId !== user.sub) throw new UnauthorizedException('Not allowed');
    posts.splice(idx, 1);
    await this.writePosts(posts);
    return { success: true };
  }
}
