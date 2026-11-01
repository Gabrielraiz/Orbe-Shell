# Orbe Shell — Protótipo 0.4

Substituto visual completo da experiência de desktop do Windows: ambiente premium,
extremamente fluido, inteligente e totalmente personalizável, com identidade própria.

**Filosofia:** beleza, fluidez, desempenho, inteligência e liberdade de personalização
funcionando juntos — um sistema que não apenas pareça moderno, mas que seja agradável
de utilizar em cada interação.

## 🚀 Como testar agora

```bash
cd orbe-shell
npm install        # já instalado neste workspace
npm run dev        # abre em http://localhost:5173
```

Ou a versão de produção compilada: `npm run build && npm run preview`

## ✨ Os 12 pilares implementados no protótipo

| # | Pilar | Onde testar |
|---|-------|-------------|
| 1 | **Liquid Glass Premium** — interface escura translúcida, desfoque real, cantos arredondados, cores dinâmicas por papel de parede | Tudo visível; troque o wallpaper no Studio |
| 2 | **Animações fluidas** — molas (spring), efeito Genie ao minimizar, velocidade global ajustável | Minimizar janela (botão ou duplo-clique na barra de título) |
| 3 | **Dock flutuante inteligente** — magnificação por proximidade, ocultação automática, reordenação por arrastar, menu de contexto (botão direito) | Base da tela |
| 4 | **Menu Iniciar adaptável** — modos Compacto/Completo/Inteligente, pesquisa integrada; **tecla Windows abre/fecha** | Tecla `Meta`/Windows ou orbe no Dock |
| 5 | **Gerenciamento avançado de janelas** — snap nas bordas/cantos (esq., dir., topo, 4 quadrantes), maximizar, múltiplas áreas de trabalho | Arraste a janela até as bordas |
| 6 | **Área de trabalho personalizável** — ícones arrastáveis (posição salva), widgets (relógio, clima, música, monitor), menu de contexto flutuante (botão direito no fundo) | Fundo da tela |
| 7 | **Orbe Studio** — central de personalização: cores, glass (transparência/desfoque), dock, animações, modos, widgets | Abra pelo Dock ou menu de contexto |
| 8 | **Desempenho e compatibilidade** — modo "Reduzir efeitos", persistência de preferências, otimizações de GPU via CSS | Studio → Glass / Configurações |
| 9 | **Modos inteligentes** — perfis Gamer, Trabalho e Inteligente alteram Dock e favoritos do Menu Iniciar | Central de controle (topo) ou Studio |
| 10 | **Orbe Continuity** — log de eventos, verificação de saúde, simulação de falha de widget e recuperação de emergência sem perder estado | Menu de contexto → Orbe Continuity |
| 11 | **Orbe Update Center** — canais Estável/Beta/Experimental, aviso antes de instalar, opção de reverter versão | Menu de contexto → Verificar atualizações |
| 12 | **Segurança e estabilidade** — arquitetura modular (cada componente isolado no store), recuperação de emergência disponível em todos os menus críticos | Dock → botão direito → Recuperação |

## ⌨️ Atalhos

- `Windows/Meta` — abre/fecha o Menu Orbe
- `Esc` — fecha overlays
- Duplo-clique na barra de título — minimiza com efeito Genie
- Arrastar janela para bordas/topo/cantos — encaixe inteligente
- Botão direito no Dock — menu de contexto completo
- Botão direito na área de trabalho — menu flutuante do shell

## 🗂 Estrutura

```
orbe-shell/
├── src/
│   ├── App.jsx                 # shell raiz: boot, tecla Windows, variáveis CSS dinâmicas
│   ├── store/shellStore.js     # estado global (Zustand + persistência)
│   ├── lib/apps.js             # catálogo de aplicativos
│   ├── lib/wallpapers.js       # papéis de parede + paletas de cores dinâmicas
│   └── components/
│       ├── MenuBar.jsx         # barra superior estilo macOS
│       ├── Dock.jsx            # dock com magnificação, drag & context menu
│       ├── StartMenu.jsx       # menu iniciar em 3 modos + pesquisa
│       ├── Window.jsx          # janelas: snap, resize, Genie + Orbe Studio
│       ├── Desktop.jsx         # ícones arrastáveis + widgets
│       ├── ControlCenter.jsx   # central de controle + Mission Control leve
│       └── AppIcon.jsx, icons/ # ícones nativos vetoriais
```

Stack: **React 19 · Vite · Zustand · Framer Motion**

## 🛣 Roadmap para produção (não concluído no protótipo)

- Substituição profunda do Explorer (shell real via API Win32/UWP)
- Orbe Window Bridge — efeitos em aplicativos externos respeitando limitações
- Mecanismo Continuity real (monitoramento de processos com fallback ao desktop nativo)
- Atualizações distribuídas com rollback assinado
- Suporte a toque e otimizações automáticas por hardware
- Alvo: Windows 11+ (Windows 10 opcional)

> Protótipo web interativo — demonstra a experiência completa de UI/UX. A integração
> nativa com o Windows é a próxima fase de engenharia.
