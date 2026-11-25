# Contributing to vite-plugin-iconify-bundle

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting issues

- **Questions, ideas, possible bugs**: the [Discord forum](https://discord.kirch.dev/).
- **Confirmed bugs**: a [Bug report](https://github.com/kirchDev/vite-plugin-iconify-bundle/issues/new?template=bug_report.yml), with a minimal reproduction.
- **Features**: a [Feature request](https://github.com/kirchDev/vite-plugin-iconify-bundle/issues/new?template=feature_request.yml).
- **Security vulnerabilities**: never a public issue — see [SECURITY.md](SECURITY.md).

## Development setup

Node **24+**, **pnpm 12**:

```bash
git clone https://github.com/kirchDev/vite-plugin-iconify-bundle.git
cd vite-plugin-iconify-bundle
pnpm install   # wires the husky hooks
```

`pnpm check` is the gate CI runs, and it builds both examples too; `pnpm check:fix` fixes lint and format.

## Branching & PRs

1. **Never push directly to `main` or `dev`.** Branch off `dev` and open the PR against `dev`.
2. **Conventional Commits**, enforced by commitlint; mark a breaking change with `!` or a `BREAKING CHANGE:` footer.
3. **One concern per PR.**
4. **Update the docs** when you change a default.

The hooks run `oxlint` and `oxfmt` on staged files and commitlint on the message. If one fails, fix it and commit again — don't `--no-verify`.

## AI agents

Agent instructions live in [`AGENTS.md`](AGENTS.md). Claude Code reads it directly from v2.1.277, as long as no `CLAUDE.md` or `CLAUDE.local.md` sits in the working directory or above it.

## License

Contributions are licensed under the [MIT License](LICENSE).
