import { Post } from "./posts";

export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  image: string | Blob | null;
  isActive: boolean;
  emailVerified: boolean;
  searchableName: string;
  postsCount: number;
  posts: Post[];
  password: string; // only for new users
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  tokenRefresh?: {
    newAccessToken: string;
    expiresIn: number;
  };
}
