# 0001. Monorepo with Bun workspaces, Turborepo, source-only packages and Biome

## Status

Accepted

## Context

bhidubot is a self-hosted meeting-notes app for a team. It needs a server, a web client and shared
code (types, roles, schemas) that evolve together.

## Decision

Use one repository with Bun workspaces (`apps/*`, `packages/*`), Turborepo for task orchestration,
internal packages that export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`),
and Biome for linting and formatting.

## Why

- A single language and runtime across the stack.
- Bun runs TypeScript natively.
- Turborepo caches results and orders tasks across packages.

## Pros

- No package build step.
- Fast installs.
- One tool for lint and format.

## Cons

- Source-only packages require every consumer to compile TypeScript (fine for Bun and Vite).
- Biome has fewer rules than ESLint.
- Turborepo is an extra tool to learn.

## Alternatives considered

- pnpm + Nx: heavier.
- Bun workspaces alone, without Turborepo: no caching or task graph.
- ESLint + Prettier: slower, and two tools.

## Consequences / follow-ups

- Every package must run on Windows, PowerShell and Git Bash alike, so scripts avoid bash-only syntax.
- Packages that need a published artifact later will add a build step individually.
