# Orbe Shell 1.1.0.5

Aplicativo Windows com Tauri 2, React e Rust. Consulte o [README principal](../README.md)
para requisitos, funcionalidades e diagnóstico.

Execute nesta pasta:

```powershell
npm install
npm run version:check
npm test
npm run tauri:dev
```

Para validar e gerar os instaladores Windows:

```powershell
.\scripts\dev.ps1 -Full
```

A versão exibida é definida em `src/lib/apps.js` (`1.1.0.5`).
`npm run version:sync` grava `1.1.0+5` nos manifestos SemVer e no lockfile npm,
preservando a revisão numérica no executável Windows. Os comandos de desenvolvimento
e build executam essa sincronização automaticamente.
