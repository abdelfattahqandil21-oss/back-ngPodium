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
    const raw = (q ?? '').toString().trim();
    if (!raw) return [];

    const term = raw.toLowerCase();
    const tokens = Array.from(new Set(term.split(/\s+/g).filter(Boolean)));
    if (!tokens.length) return [];

    const slugCandidate = this.slugify(raw);
    const posts = this.sortDesc(await this.readPosts());

    const evaluated = posts
      .map((post) => {
        const header = (post.header ?? '').toLowerCase();
        const content = (post.content ?? '').toLowerCase();
        const userName = (post.userName ?? '').toLowerCase();
        const tags = Array.isArray(post.tags) ? post.tags.map((t) => (t ?? '').toLowerCase()) : [];
        const slug = (post.slug ?? '').toLowerCase();

        const includesAll = (value: string) => tokens.every((token) => value.includes(token));
        const includesAny = (value: string) => tokens.some((token) => value.includes(token));

        const scoreField = (value: string, weightAll: number, weightAny: number) => {
          if (!value) return 0;
          if (includesAll(value)) return weightAll;
          return includesAny(value) ? weightAny : 0;
        };

        const slugExactMatch = slugCandidate && slug === slugCandidate;
        let score = slugExactMatch ? 100 : 0;

        score += scoreField(header, 24, 12);
        score += scoreField(content, 16, 8);
        score += scoreField(userName, 6, 3);

        const tagsScore = tags.reduce((acc, tag) => {
          if (!tag) return acc;
          if (includesAll(tag)) return Math.max(acc, 10);
          if (includesAny(tag)) return Math.max(acc, 5);
          return acc;
        }, 0);
        score += tagsScore;

        if (!slugExactMatch && includesAny(slug)) {
          score += 10;
        }

        return { post, score, slugExactMatch };
      })
      .filter((result) => result.slugExactMatch || result.score > 0);

    evaluated.sort((a, b) => {
      if (a.slugExactMatch !== b.slugExactMatch) {
        return a.slugExactMatch ? -1 : 1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
    });

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
    return evaluated.slice(0, safeLimit).map((entry) => entry.post);
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
