# Contributing to kselect.js

Thank you for your interest in contributing! Here's how to get involved.

---

## Reporting bugs

Please open a GitHub issue and include:

- A minimal reproducible example (a single HTML file is ideal)
- The browser and OS you're using
- What you expected to happen and what actually happened

---

## Suggesting features

Open an issue describing the feature and the use case it solves. Please check existing issues first to avoid duplicates.

---

## Submitting a pull request

1. **Open an issue first** for anything beyond a trivial fix — this lets us discuss the approach before you invest time writing code.
2. Fork the repository and create a branch from `main`.
3. Make your changes to `kselect.js` and/or `kselect.css`.
4. Minify `kselect.js` and/or `jselect.css`.
5. Update `CHANGELOG.md` with a clear description of what changed.
6. Open a pull request with a description of what it does and why.

---

## Code style

- Vanilla JavaScript only — no build tools, no transpilation, no dependencies.
- Keep the UMD wrapper intact so the file works as both a browser global and a CommonJS module.
- All DOM classes must use the `ks-` prefix.
- All CSS custom properties must use the `--ks-` prefix.
- Maintain WCAG 2.1 AA compliance — if you add interactive elements, include appropriate ARIA attributes and `:focus-visible` styles.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
