---
title: 'Treat the source text as the definition of a used icon'
description: 'A quoted prefix:name literal found by plain text search is what counts as used, and the build fails on one the installed collection lacks.'
status: 'accepted'
date: '2026-08-30'
---

# ADR-0001 — Treat the source text as the definition of a used icon

## Context

Resolving icons at build time is what makes them work offline, render inline under server-side rendering, and stay identical across builds. That requires knowing the set of icons before anything runs, so the set has to be derivable from the source rather than observed at runtime.

Two ways to derive it were available. A list maintained beside the code states the set explicitly. Reading the set out of the source derives it, and then the question becomes what in the source counts — and how much machinery it takes to find out.

The failure being designed against is specific: an icon that is used, is not in the bundle, and says nothing. It surfaces as an empty space in a rendered page, far from the change that caused it, in a build that reported success.

## Decision

We will treat a quoted `prefix:name` literal appearing in a scanned file as the definition of a used icon, and find it by a plain text search over the source rather than by parsing it.

We will fail the build when a name found this way is absent from the installed collection, rather than warning and continuing.

## Consequences

There is no list to maintain. Writing an icon's name is what puts it in the bundle, and deleting the last use of one removes it, with no second edit and nothing to keep in step.

A text search cannot distinguish a string in code from one in a comment or in prose, so a name written anywhere in a scanned file counts as used. A name written into a comment that names no real icon therefore fails the build. This is the cost the decision accepts, and it is paid loudly.

A misspelled name is reported at build time, by name, before anything ships.

A name the search cannot read is a name nothing checks. Assembling a name at runtime, or writing it where the scan does not reach, produces exactly the silent gap this decision was made to prevent — the guarantee covers literals, and only literals.

Anything that changes what the search matches changes what ships. The function that performs the match is part of the package's tested surface for that reason, rather than an implementation detail of the plugin.

## Alternatives considered

**Parse the source and collect only names in real code positions.** This removes the false positive from comments, which is the one visible cost of the decision above. It lost on the shape of its failure: a parser has to be right about every file type in a project, and where it is wrong it does not produce noise, it silently disagrees with the text and drops an icon. That trades a loud, immediately located failure for the quiet one this whole design exists to avoid — and it makes the definition of a used icon depend on which parser saw the file.

**Warn on an unknown name and continue.** A warning keeps a build green when an icon is known to be missing. The missing icon then reaches a rendered page, which is the original failure with an extra step; a warning in a build log is read by nobody at the moment it matters.

**Maintain the set of icons explicitly.** An explicit list is exact and sees through any construction, dynamic names included. It lost because it is a second place the truth lives: it drifts from the code that uses it, and nothing signals the drift — the entry that is merely stale looks identical to the entry that is correct.
