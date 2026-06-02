# Tauri placeholder

This folder contains placeholder notes for Tauri integration.

To initialize Tauri for this project (recommended after the web UI is working):

1. Install Rust toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

2. Install Tauri CLI and initialize:

```bash
cargo install tauri-cli
npx tauri init
```

3. Follow the interactive prompts. The `tauri` dev scripts rely on the web build artifacts produced by Vite.

Notes
- This repository currently contains only placeholder files; the real Rust/Cargo scaffolding is created by `npx tauri init`.
