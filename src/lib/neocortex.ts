// Neocortex API Integration
const NEOCORTEX_API_KEY = 'sk_f4b0fda4-4772-41ba-8b92-edf59d6e38f6';
const NEOCORTEX_PROJECT_ID = 'cmh5uhb1l0003jj04tahgqbm8';
const NEOCORTEX_BASE_URL = 'https://api.neocortex.link/v1';

export interface NeocortexAgent {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

export class NeocortexAPI {
  private apiKey: string;
  private projectId: string;

  constructor(apiKey: string = NEOCORTEX_API_KEY, projectId: string = NEOCORTEX_PROJECT_ID) {
    this.apiKey = apiKey;
    this.projectId = projectId;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${NEOCORTEX_BASE_URL}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Neocortex API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Neocortex API request failed:', error);
      throw error;
    }
  }

  // Get project agents
  async getAgents(): Promise<NeocortexAgent[]> {
    try {
      const data = await this.request(`/projects/${this.projectId}/agents`);
      return data.agents || [];
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return [];
    }
  }

  // Get project info
  async getProject() {
    try {
      return await this.request(`/projects/${this.projectId}`);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      return null;
    }
  }

  // Simple chat/query endpoint (common AI API pattern)
  async query(prompt: string, context?: Record<string, any>) {
    try {
      return await this.request(`/projects/${this.projectId}/query`, {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          context,
        }),
      });
    } catch (error) {
      console.error('Failed to query:', error);
      return null;
    }
  }
}

// Singleton instance
export const neocortexAPI = new NeocortexAPI();

