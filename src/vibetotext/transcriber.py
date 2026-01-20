"""Whisper transcription using whisper.cpp for 2-4x faster inference."""

import json
import numpy as np
from pathlib import Path
from pywhispercpp.model import Model
import time

CONFIG_PATH = Path.home() / ".vibetotext" / "config.json"

# Technical vocabulary prompt to bias Whisper toward programming terms
TECH_PROMPT = """This is a software engineer dictating code and technical documentation.
They frequently discuss: APIs, databases, frontend frameworks, backend services,
cloud infrastructure, and AI/ML systems. Use programming terminology and proper
capitalization for technical terms.

Common terms: Firebase, Firestore, MongoDB, PostgreSQL, MySQL, Redis, SQLite,
API, REST, GraphQL, gRPC, WebSocket, JSON, YAML, XML, HTML, CSS, SCSS,
JavaScript, TypeScript, Python, Rust, Go, Java, C++, Swift, Kotlin,
React, Vue, Angular, Svelte, Next.js, Nuxt, Remix, Astro,
Node.js, Deno, Bun, npm, yarn, pnpm, webpack, Vite, esbuild, Rollup,
Docker, Kubernetes, K8s, Helm, Terraform, Ansible, Jenkins, CircleCI,
AWS, S3, EC2, Lambda, DynamoDB, CloudFront, Route53, ECS, EKS,
GCP, BigQuery, Cloud Run, Cloud Functions, Pub/Sub,
Azure, Vercel, Netlify, Railway, Render, Fly.io, Cloudflare,
Git, GitHub, GitLab, Bitbucket, PR, pull request, merge, rebase, cherry-pick,
CI/CD, DevOps, SRE, microservices, monorepo, serverless, edge functions,
useState, useEffect, useContext, useRef, useMemo, useCallback, useReducer,
Redux, Zustand, Jotai, Recoil, MobX, XState,
Prisma, Drizzle, TypeORM, Sequelize, Knex, SQLAlchemy,
tRPC, Zod, Yup, Joi, Express, Fastify, Hono, FastAPI, Flask, Django,
Tailwind, styled-components, Emotion, CSS Modules, Sass,
Jest, Vitest, Cypress, Playwright, Testing Library,
ESLint, Prettier, Biome, TypeScript, TSConfig,
OAuth, JWT, session, cookie, CORS, CSRF, XSS, SQL injection,
Claude, Anthropic, OpenAI, GPT, Gemini, Llama, Mistral,
LLM, embedding, vector database, Pinecone, Weaviate, ChromaDB, Qdrant,
RAG, retrieval, chunking, tokenization, fine-tuning, RLHF, prompt engineering,
Whisper, transcription, TTS, speech-to-text, ASR, NLP, NLU,
regex, cron, UUID, Base64, SHA, MD5, RSA, AES, TLS, SSL, HTTPS."""


class Transcriber:
    """Transcribes audio using whisper.cpp (faster than Python Whisper)."""

    def __init__(self, model_name: str = "base", custom_words: list[str] | None = None):
        """
        Initialize transcriber.

        Args:
            model_name: Whisper model size. Options: tiny, base, small, medium, large
                       Bigger = more accurate but slower.
                       'base' is a good balance for real-time use.
            custom_words: Deprecated - custom words are now loaded from config on each transcription.
        """
        self.model_name = model_name
        self._model = None
        self._last_custom_words = None

    def _load_custom_words(self) -> list[str]:
        """Load custom dictionary from config file."""
        try:
            if CONFIG_PATH.exists():
                with open(CONFIG_PATH, "r") as f:
                    config = json.load(f)
                    return config.get("custom_dictionary", [])
        except Exception:
            pass
        return []

    def _build_prompt(self, custom_words: list[str]) -> str:
        """Build the full vocabulary prompt including custom words."""
        if not custom_words:
            return TECH_PROMPT

        # Format custom words with emphasis to help Whisper recognize them
        words_list = ", ".join(custom_words)
        custom_section = f"\n\nIMPORTANT: The speaker uses these specific terms that must be transcribed exactly as spelled: {words_list}. When you hear anything similar to these words, use the exact spelling provided: {words_list}."
        return TECH_PROMPT + custom_section

    @property
    def model(self):
        """Lazy load the model."""
        if self._model is None:
            print(f"Loading whisper.cpp model '{self.model_name}'...")
            start = time.time()
            self._model = Model(self.model_name, print_progress=False)
            print(f"Model loaded in {time.time() - start:.2f}s")
        return self._model

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> str:
        """
        Transcribe audio to text.

        Args:
            audio: Audio data as numpy array (float32, mono)
            sample_rate: Sample rate of audio (Whisper expects 16000)

        Returns:
            Transcribed text
        """
        if len(audio) == 0:
            return ""

        # Whisper expects float32 audio normalized to [-1, 1]
        audio = audio.astype(np.float32)

        # Reload custom words from config (hot reload support)
        custom_words = self._load_custom_words()
        if custom_words != self._last_custom_words:
            self._last_custom_words = custom_words
            if custom_words:
                print(f"[WHISPER.CPP] Custom dictionary: {len(custom_words)} words ({', '.join(custom_words)})")

        prompt = self._build_prompt(custom_words)

        start = time.time()

        # Transcribe with whisper.cpp
        # Note: pywhispercpp uses initial_prompt parameter for vocabulary hints
        segments = self.model.transcribe(
            audio,
            language="en",
            initial_prompt=prompt,
        )

        # Combine all segments into one string
        text = " ".join(segment.text for segment in segments).strip()

        print(f"[WHISPER.CPP] Transcribed in {time.time() - start:.2f}s")

        return text
