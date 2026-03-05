// OpenRouter Service with Auto-Failover and Free Model Support
// Automatically routes to next model if rate-limited

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: number; completion: number };
}

class OpenRouterService {
  private apiKey: string = '';
  private freeModels: OpenRouterModel[] = [];
  private currentModelIndex: number = 0;
  private failoverCount: number = 0;

  async fetchFreeModels(): Promise<OpenRouterModel[]> {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    const data = await response.json();
    this.freeModels = data.data
      .filter((m: any) => m.id.includes(':free') || m.pricing?.prompt === 0)
      .sort((a: any, b: any) => this.rankWritingQuality(b) - this.rankWritingQuality(a));
    return this.freeModels;
  }

  private rankWritingQuality(model: any): number {
    const scores: Record<string, number> = {
      'llama': 8, 'deepseek': 9, 'gemma': 7, 'mistral': 7, 'phi': 6
    };
    for (const [key, score] of Object.entries(scores)) {
      if (model.id.includes(key)) return score;
    }
    return 5;
  }

  async generate(prompt: string, systemPrompt: string): Promise<string | null> {
    let attempts = 0;
    while (attempts < this.freeModels.length) {
      const model = this.freeModels[attempts];
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model.id,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (response.status === 429) {
          // Rate limited - try next model
          attempts++;
          this.failoverCount++;
          continue;
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;
      } catch (error) {
        console.error(`Model ${model.id} failed:`, error);
        attempts++;
      }
    }
    return null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getFailoverCount(): number {
    return this.failoverCount;
  }
}

export const openRouterService = new OpenRouterService();
