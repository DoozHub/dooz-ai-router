declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}
