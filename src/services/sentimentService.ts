import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      console.warn("GEMINI_API_KEY is not set. Sentiment analysis will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function analyzeSentiment(text: string): Promise<{ sentiment: 'Positive' | 'Neutral' | 'Negative', score: number }> {
  try {
    const ai = getAI();
    if (!ai) return { sentiment: 'Neutral', score: 0.5 };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the sentiment of the following feedback comment for an NGO. Classify it as Positive, Neutral, or Negative and provide a confidence score between 0 and 1.
      
      Comment: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              enum: ['Positive', 'Neutral', 'Negative'],
              description: "The sentiment classification."
            },
            score: {
              type: Type.NUMBER,
              description: "The confidence score between 0 and 1."
            }
          },
          required: ["sentiment", "score"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      sentiment: result.sentiment || 'Neutral',
      score: result.score || 0.5
    };
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { sentiment: 'Neutral', score: 0.5 };
  }
}
