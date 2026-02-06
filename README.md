# CareerCoach (The Deep Mirror)

## Version 3.1.0 - Deep Path (v3.1 deep-path)

This version introduces a refined "Deep Path" analysis flow, enhancing the user experience from conversation to career report generation.

### Key Features

1.  **Deep Analysis Flow (Chat -> Report)**
    - Streamlined transition from the chat interface to the report generation page.
    - Ensures a continuous and immersive analysis experience.

2.  **Immersive Loading Experience**
    - New `GenerationLoading` component with a 12-second full-screen progress animation.
    - Provides real-time status feedback to reduce user anxiety during report generation.

3.  **Visual & Interaction Polish**
    - **Smart Typography**: Automatic injection of "breathing space" (half-width space) around Chinese double quotes (e.g., `文本 “引用” 文本`) for better readability.
    - **Strict Punctuation**: Enforced use of standard Chinese punctuation (，。、：) and double quotes (“”) across all AI-generated content.
    - **Clean UI**: Removed redundant `ReportCard` popup for a cleaner interface.

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **AI Integration**: Alibaba DashScope (Qwen-Plus) via Vercel AI SDK
- **Language**: TypeScript
