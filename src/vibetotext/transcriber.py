"""Whisper transcription using whisper.cpp for 2-4x faster inference."""

import numpy as np
from pywhispercpp.model import Model
import time


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

    def __init__(self, model_name: str = "base"):
        """
        Initialize transcriber.

        Args:
            model_name: Whisper model size. Options: tiny, base, small, medium, large
                       Bigger = more accurate but slower.
                       'base' is a good balance for real-time use.
        """
        self.model_name = model_name
        self._model = None

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

        start = time.time()

        # Transcribe with whisper.cpp
        # Note: pywhispercpp uses initial_prompt parameter for vocabulary hints
        segments = self.model.transcribe(
            audio,
            language="en",
            initial_prompt=TECH_PROMPT,
        )

        # Combine all segments into one string
        text = " ".join(segment.text for segment in segments).strip()

        print(f"[WHISPER.CPP] Transcribed in {time.time() - start:.2f}s")

        return text
