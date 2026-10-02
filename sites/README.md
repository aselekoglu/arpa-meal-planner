# Arpa on ChatGPT Sites

`arpa-meal-planner/` contains the cloud application source published to the
existing private [Arpa Meal Planner Site](https://arpa-meal-planner.aselekoglu.chatgpt.site).
It includes the responsive React interface, Workers API, D1 schema/migrations,
private R2 image storage, Gemini integration and MCP tools/UI.

This GitHub copy is based on Sites source commit
`2e0a75b93e6416311fcf0832cf7d6235cc5dffca`. It stores real source files, not a
submodule pointer. Local Git metadata, dependencies, generated builds, secrets,
database snapshots, private migration helpers and internal planning notes are
excluded.

The application at the repository root and the Sites application are separate.
Root-source changes do not automatically propagate to Sites, and a GitHub push
does not publish a new Site version. Sites publication uses its separately
managed source repository and the existing `.openai/hosting.json` identity.
Do not overwrite the cloud files with root versions.

## Local checks and build

```sh
cd sites/arpa-meal-planner
npm ci
npm run lint
npm test
node --import tsx --test src/lib/*.test.ts ai/providers/*.test.ts
npm run build
```

Production access and provider credentials belong in the private hosting
configuration. No production credentials or kitchen data are included here.
