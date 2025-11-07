export interface Post {
  id: number;
  header: string;
  content: string;
  coverImg: string;
  createdAt: Date;
  tags: string[];
  slug: string;
  userId: number;
  userName: string;
  userImg?: string;
  updatedAt?: Date;
}