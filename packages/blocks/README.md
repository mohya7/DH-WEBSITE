# Shared blocks

These components are used by both the Next.js website and the Vite Studio. They must not import anything Next-specific — no `next/image`, no `next/link`. Image and link rendering go through small adapter components each application supplies.
