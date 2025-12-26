
import { GoogleGenAI, Type } from "@google/genai";
import { PatrolLog, AnalysisResult } from '../types';

/**
 * Analyzes security patrol logs using Gemini 3 Pro.
 * Adheres to the @google/genai guidelines for model selection and API usage.
 */
export const analyzePatrolLogs = async (log: PatrolLog): Promise<AnalysisResult> => {
  // Initialize AI client with API key from environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Analyze this security patrol log for a company. 
    Guard: ${log.guardName}
    Duration: ${log.endTime ? (log.endTime - log.startTime) / 1000 / 60 : 'Ongoing'} minutes
    Checkpoints covered: ${log.checkpoints.filter(cp => cp.reachedAt).length}/${log.checkpoints.length}
    Total GPS Points: ${log.points.length}
    
    Provide a concise summary, detect any suspicious movements or missed zones, score efficiency from 0-100, and give improvement tips.`;

  try {
    // Using gemini-3-pro-preview for advanced reasoning on patrol logs
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A concise summary of the patrol session" },
            anomalies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of detected anomalies" },
            efficiency: { type: Type.NUMBER, description: "Efficiency score from 0 to 100" },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tips for improvement" },
          },
          required: ["summary", "anomalies", "efficiency", "recommendations"]
        },
      },
    });

    // Access the text property directly as per latest SDK guidelines
    const resultText = response.text || '{}';
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Could not analyze at this time.",
      anomalies: ["Analysis failed"],
      efficiency: 0,
      recommendations: ["Check connection"]
    };
  }
};
