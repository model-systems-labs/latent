# Latent workspace architecture

The repository is an npm workspace with the deployable web application at the
root. Keeping the application at the root preserves the Sites build and hosting
contract while allowing reusable systems to evolve as independent packages.

## Dependency direction

```text
@latent/web
  ├── @latent/course-kit
  ├── @latent/model-lab
  ├── @latent/tensor
  ├── @latent/browser-lab
  ├── @latent/artifact-runtime
  ├── @latent/training-replay
  └── @latent/mock-services
```

The only package-to-package edge is `@latent/training-replay` →
`@latent/artifact-runtime`; every other package is a leaf consumed by the web
application. The boundary check rejects undeclared workspace imports, private
source-path imports, unknown packages, root-application dependencies, and
dependency cycles.

- Packages never import `app/`, React components, lesson content, or web
  persistence orchestration.
- The application imports package public exports, never `packages/*/src`.
- Browser Lab owns untrusted learner-code compilation and execution, not IDE UI.
- Mock Services owns simulated network behavior, not LMS navigation or progress.
- Course Kit owns framework-neutral authoring schemas, not authored course text.
- Model Lab owns deterministic educational training and inference engines, not
  course UI, persistence, worker orchestration, or recorded replay.
- Latent Tensor owns numerical operations; the application generates lesson
  imports and injects the package's generated runtime source into the VFS.
- Artifact Runtime owns immutable artifacts; course-specific artifact adapters
  remain application features.
- Training Replay owns the model-neutral recording contract, validation,
  checkpoint materialization, lazy registry, and presentation view models. The
  application owns trainers, recordings, course placement, and React rendering.

Pure libraries compile to `dist/` with declarations before the web build.
Browser Lab is intentionally source-exported inside the private workspace so
Vite can discover its compiler and sandbox worker URLs; publishing it outside
the monorepo would require a dedicated worker-bundling build.

Run `npm run boundaries` to verify these constraints. Each workspace owns its
unit tests; the root test suite verifies the assembled website and capstone.
