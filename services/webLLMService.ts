// WebLLM Service for 100% Local Inference (NO API COSTS)
// Uses WebGPU for in-browser AI inference - fully private

import * as webllm from '@mlc-ai/web-llm';

class WebLLMService {
  private engine: any = null;
  private isLoading: boolean = false;
  private selectedModel: string = 'Llama-3.2-3B-Instruct-q4f32_1-MLC';

  // Best free local models for writing
  private availableModels = [
    { id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 3B (Fast, Good Quality)' },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini (Very Fast)' },
    { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', name: 'Mistral 7B (Best Quality)' },
    { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B (Lightweight)' }
  ];

  async initializeEngine(progressCallback?: (progress: string) => void): Promise<void> {
    if (this.engine) return;
    this.isLoading = true;
    
    try {
      this.engine = await webllm.CreateMLCEngine(this.selectedModel, {
        initProgressCallback: (progress: any) => {
          if (progressCallback) {
            progressCallback(`Loading ${this.selectedModel}: ${Math.round(progress.progress * 100)}%`);
          }
        }
      });
      console.log('WebLLM engine initialized successfully');
    } catch (error) {
      console.error('WebLLM initialization failed:', error);
      throw new Error('Failed to initialize WebLLM. Ensure your browser supports WebGPU.');
    } finally {
      this.isLoading = false;
    }
  }

  async generate(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.engine) {
      await this.initializeEngine();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    try {
      const response = await this.engine.chat.completions.create({
        messages,
        temperature: 0.8,
        max_tokens: 2000
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('WebLLM generation failed:', error);
      throw new Error('Generation failed. Try a different model or check browser compatibility.');
    }
  }

  async generateStream(prompt: string, systemPrompt: string, onChunk: (chunk: string) => void): Promise<void> {
    if (!this.engine) {
      await this.initializeEngine();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const completion = await this.engine.chat.completions.create({
      messages,
      temperature: 0.8,
      max_tokens: 2000,
      stream: true
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) onChunk(content);
    }
  }

  setModel(modelId: string) {
    if (this.availableModels.some(m => m.id === modelId)) {
      this.selectedModel = modelId;
      // Reset engine to load new model
      this.engine = null;
    }
  }

  getAvailableModels() {
    return this.availableModels;
  }

  isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }
}

export const webLLMService = new WebLLMService();
