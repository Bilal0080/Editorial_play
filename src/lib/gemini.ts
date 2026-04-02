import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Story {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  timestamp: string;
}

export const generateStory = async (prompt: string, theme?: string) => {
  const model = "gemini-3-flash-preview";
  const themeContext = theme ? ` The story should be in the ${theme} genre.` : "";
  const response = await ai.models.generateContent({
    model,
    contents: `Generate a short children's story title and a 2-sentence summary based on this prompt: "${prompt}".${themeContext} Return as JSON with keys "title" and "summary".`,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { title: "A New Adventure", summary: prompt };
  }
};

export const generateStoryImage = async (prompt: string, theme?: string, artStyle?: string) => {
  const model = "gemini-2.5-flash-image";
  const themeContext = theme ? ` in a ${theme} setting` : "";
  const styleContext = artStyle ? ` with a ${artStyle} art style` : " in a whimsical children's book style";
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          text: `A magical illustration${themeContext}${styleContext} for: ${prompt}. Vibrant colors, detailed background.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
