declare module "@google-cloud/aiplatform" {
  // Minimal typing just to satisfy the TypeScript compiler within this repo.
  // We use `any` here intentionally to avoid pulling full type definitions.
  export class IndexServiceClient {
    locationPath(projectId: string, location: string): string;
    createIndex(request: any): Promise<any[]>;
  }

  export class IndexEndpointServiceClient {
    locationPath(projectId: string, location: string): string;
    createIndexEndpoint(request: any): Promise<any[]>;
    deployIndex(request: any): Promise<any[]>;
  }

  export class PredictionServiceClient {
    predict(request: any): Promise<any[]>;
  }
}
