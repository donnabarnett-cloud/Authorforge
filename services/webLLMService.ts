// WebLLM Service for 100% Local Inference (NO API COSTS)
// Uses WebGPU for in-browser AI inference - fully private
// AUTO-LOADS BEST MODEL + AUTO-FAILOVER ON QUOTA EXCEEDED

import * as webllm from '@mlc-ai/web-llm';

class WebLLMService {
  private engine: any = null;
  private isLoading: boolean = false;
  private currentModelIndex: number = 0;
  
  // Best free local models for writing (ordered by quality/performance)
  private availableModels = [
    { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', name: 'Mistral 7B (Best Quality)', size: '~4GB' },
    { id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 3B (Fast, Good Quality)', size: '~2GB' },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini (Very Fast)', size: '~2GB' },
    { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B (Lightweight)', size: '~1.5GB' }
  ];

  async initializeEngine(progressCallback?: (progress: string) => void): Promise<void> {
    if (this.engine) return;
    
    // AUTO-LOAD: Start with the best model
    await this.loadModel(this.currentModelIndex, progressCallback);
  }

  private async loadModel(modelIndex: number, progressCallback?: (progress: string) => void): Promise<void> {
    if (modelIndex >= this.availableModels.length) {
      throw new Error('All models failed to load. Please check your browser compatibility.');
    }

    const model = this.availableModels[modelIndex];
    this.isLoading = true;
    
    try {
      if (progressCallback) {
        progressCallback(`Loading ${model.name} (${model.size})...`);
      }

      this.engine = await webllm.CreateMLCEngine(model.id, {
        initProgressCallback: (progress: any) => {
          if (progressCallback) {
            progressCallback(`Loading ${model.name}: ${Math.round(progress.progress * 100)}%`);
          }
        }
      });
      
      this.currentModelIndex = modelIndex;
      console.log(`WebLLM engine initialized successfully with ${model.name}`);
    } catch (error) {
      console.error(`Failed to load ${model.name}:`, error);
      
      // AUTO-FAILOVER: Try next model if current one fails
      if (progressCallback) {
        progressCallback(`${model.name} failed. Trying next model...`);
      }
      
      await this.loadModel(modelIndex + 1, progressCallback);
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
    } catch (error: any) {
      console.error('WebLLM generation failed:', error);
      
      // AUTO-FAILOVER: If quota exceeded or model fails, try next model
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        console.log('Quota exceeded, switching to next model...');
        this.engine = null; // Reset engine
        this.currentModelIndex++; // Move to next model
        await this.initializeEngine();
        
        // Retry with new model
        return this.generate(prompt, systemPrompt);
      }
      
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

    try {
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
    } catch (error: any) {
      console.error('WebLLM streaming failed:', error);
      
      // AUTO-FAILOVER for streaming
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        console.log('Quota exceeded during streaming, switching to next model...');
        this.engine = null;
        this.currentModelIndex++;
        await this.initializeEngine();
        
        // Retry with new model
        return this.generateStream(prompt, systemPrompt, onChunk);
      }
      
      throw error;
    }
  }

  setModel(modelId: string) {
    const index = this.availableModels.findIndex(m => m.id === modelId);
    if (index !== -1) {
      this.currentModelIndex = index;
      // Reset engine to load new model
      this.engine = null;
    }
  }

  getAvailableModels() {
    return this.availableModels;
  }

  getCurrentModel() {
    return this.availableModels[this.currentModelIndex];
  }

  isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }
}

export const webLLMService = new WebLLMService();