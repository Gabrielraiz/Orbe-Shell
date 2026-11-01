# Histórico de versões

## 1.1.0.5 — 2026-11-01

- Corrigida a sincronização que convertia a versão em `False`, gerava JSON
  inválido e sobrescrevia versões de dependências Rust.
- Versão da interface e tag: `1.1.0.5` / `v1.1.0.5`; manifestos SemVer:
  `1.1.0+5`, com revisão numérica preservada nos recursos Windows.
- Leitura e gravação UTF-8 sem BOM, com suporte a arquivos Windows CRLF.
- Diagnóstico mantém stderr completo, respeita códigos de saída, distingue
  testes aprovados de erros e bloqueia a geração de instaladores após falhas.
- Corrigidas as APIs nativas de áudio, CPU, memória, bateria, processos Unicode
  e papel de parede, usando estruturas e interfaces de windows-rs.
- Central de Atualização configurada para os releases de Gabrielraiz/Orbe-Shell.
- Título da aplicação e requisitos Node atualizados.

Validação no Windows: 18 testes JavaScript, 3 testes Rust, lint sem avisos,
build frontend, cargo check e instaladores x64 NSIS (.exe) e MSI (.msi).
