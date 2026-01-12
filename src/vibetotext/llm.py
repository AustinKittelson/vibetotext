"""LLM integration for text cleanup and refinement."""

import os
import google.generativeai as genai
from typing import Optional


# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))


CLEANUP_PROMPT = """You are an expert prompt optimizer and thought clarifier. The user has recorded a rambling voice message and needs you to transform it into a clear, well-structured prompt or request.

Your task:
1. **Extract the core intent** - What is the user actually trying to accomplish? Cut through the rambling to find their real goal.
2. **Resolve contradictions** - If they say conflicting things, use context to determine what they most likely meant.
3. **Apply expert knowledge** - The user may not know the correct terminology. As an expert in whatever domain they're discussing, use precise technical terms and concepts.
4. **Optimize for LLM consumption** - Structure the output so an AI assistant can best understand and act on it.
5. **Be concise but complete** - Remove filler words and repetition, but keep all important details.

Rules:
- Output ONLY the refined prompt/request. No explanations, no "Here's what you meant", just the clean output.
- Preserve the user's voice and intent - don't add requirements they didn't mention.
- If they're asking a question, make it a clear question. If they're giving instructions, make them clear instructions.
- Use markdown formatting if it helps clarity (bullet points, headers, etc.)

User's rambling input:
{text}

Refined output:"""


def cleanup_text(text: str) -> Optional[str]:
    """
    Use Gemini to clean up rambling text into a clear, refined prompt.

    Args:
        text: The raw transcribed text from the user's rambling

    Returns:
        Cleaned up, refined text or None if failed
    """
    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")

        prompt = CLEANUP_PROMPT.format(text=text)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,  # Lower temperature for more focused output
                max_output_tokens=2048,
            )
        )

        if response.text:
            return response.text.strip()
        return None

    except Exception as e:
        print(f"Gemini cleanup error: {e}")
        return None
