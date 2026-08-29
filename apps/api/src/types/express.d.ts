declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        username: string;
        legacyRole: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}

export {};