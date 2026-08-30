---
title: 'vite-plugin-iconify-bundle documentation'
description: 'Why the plugin is shaped the way it is, and what its scan does and does not see.'
---

# vite-plugin-iconify-bundle

A Vite plugin that bundles only the Iconify icons a codebase actually names. These pages hold what the code and the README cannot: the model behind the scan, and the reasoning behind the decisions that shaped it.

## Sections

- [Concepts](1.concepts/) — how the plugin decides what belongs in the bundle.
- [Architecture decisions](99.adr/) — the decision log.

Usage, installation and the option table live in the [README](../README.md), which ships with the package. The options themselves are declared in `src/index.ts`; nothing here restates them.
