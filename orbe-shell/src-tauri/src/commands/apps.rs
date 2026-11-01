// Catálogo REAL de aplicativos: lê os atalhos do usuário e do sistema no
// Windows (Menu Iniciar / Desktop) e os .desktop do Linux. Nada é inventado:
// se a fonte não existir, o catálogo simplesmente vem vazio e o frontend
// mostra "nenhum aplicativo encontrado" em vez de itens falsos.
use super::{R, ShellError};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub id: String,        // chave estável (nome do arquivo sem extensão)
    pub name: String,      // nome real do atalho/.desktop
    pub target: String,    // exe/Exec real
    pub source: String,    // caminho do .lnk / .desktop
    pub icon: Option<String>, // caminho extraído do atalho, se houver
}

fn slug(p: &Path) -> String {
    p.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("app")
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric(), "-")
}

// ── Windows: varre atalhos .lnk reais ─────────────────────────────
#[cfg(windows)]
fn windows_start_dirs() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        v.push(PathBuf::from(appdata).join(r#"Microsoft\Windows\Start Menu\Programs"#));
    }
    if let Ok(programdata) = std::env::var("PROGRAMDATA") {
        v.push(PathBuf::from(programdata).join(r#"Microsoft\Windows\Start Menu\Programs"#));
    }
    v
}

#[cfg(windows)]
fn read_lnk(path: &Path) -> Option<(String, String)> {
    // Lê o Target da estrutura binary MS-SHLLINK ([MS-SHLLINK]).
    // Suporta link local com comum IDList terminada por NULL-NULL e LinkInfo.
    let bytes = std::fs::read(path).ok()?;
    if bytes.len() < 0x4C || &bytes[0..4] != b"\x4C\x00\x00\x00" {
        return None;
    }
    let guid_ok = &bytes[4..20]
        == b"\x01\x14\x02\x00\x00\x00\x00\x00\xC0\x00\x00\x00\x00\x00\x00\x46";
    if !guid_ok {
        return None;
    }
    let flags = u32::from_le_bytes(bytes[20..24].try_into().ok()?);
    let has_idlist = flags & 0x01 != 0;
    let has_linkinfo = flags & 0x02 != 0;
    let mut off = 0x4Cusize; // HeaderSize fixo
    if has_idlist {
        let idlen = u16::from_le_bytes(bytes[off..off + 2].try_into().ok()?) as usize;
        off += 2 + idlen;
    }
    if !has_linkinfo {
        return None;
    }
    // Estrutura LINK_INFO ([MS-SHLLINK] 2.4.1), começando em `off`:
    // [LinkInfoSize(4)][Version(4)][Flags(4)][VolumeIDSize(4)][VolumeID(..)]
    // [LocalBasePathSize(2)][CommonDataOffset(2)][..][LocalBasePath (ANSI, NUL)]
    let li = off;
    let local_len = u16::from_le_bytes(bytes[li + 0x10..li + 0x12].try_into().ok()?) as usize;
    if local_len == 0 {
        return None;
    }
    // LocalBasePath inicia após VolumeID: offset 0x14 relativo a LinkInfo.
    let target_start = li + 0x14;
    if target_start + local_len > bytes.len() {
        return None;
    }
    let raw = &bytes[target_start..target_start + local_len];
    let target = String::from_utf8_lossy(raw).trim_end_matches('\0').to_string();
    // Nome amigável = nome do arquivo .lnk
    let display = Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| target.clone());
    Some((display, target))
}

#[cfg(windows)]
#[tauri::command]
pub fn app_catalog() -> R<Vec<AppEntry>> {
    let mut out = Vec::new();
    for dir in windows_start_dirs() {
        if !dir.exists() {
            continue;
        }
        for entry in walk(dir, 4) {
            if entry.extension().and_then(|e| e.to_str()) == Some("lnk") {
                if let Some((name, target)) = read_lnk(&entry) {
                    out.push(AppEntry {
                        id: slug(&entry),
                        name,
                        target,
                        source: entry.to_string_lossy().to_string(),
                        icon: None,
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out.dedup_by(|a, b| a.id == b.id);
    Ok(out)
}

fn walk(dir: PathBuf, depth: u8) -> Vec<PathBuf> {
    let mut acc = Vec::new();
    fn go(d: &Path, depth: u8, acc: &mut Vec<PathBuf>) {
        if depth == 0 {
            return;
        }
        if let Ok(rd) = std::fs::read_dir(d) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    go(&p, depth - 1, acc);
                } else {
                    acc.push(p);
                }
            }
        }
    }
    go(&dir, depth, &mut acc);
    acc
}

// ── Linux/Unix: .desktop reais ────────────────────────────────────
#[cfg(not(windows))]
#[tauri::command]
pub fn app_catalog() -> R<Vec<AppEntry>> {
    let mut dirs = vec![PathBuf::from("/usr/share/applications"), PathBuf::from("/usr/local/share/applications")];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(PathBuf::from(home).join(".local/share/applications"));
    }
    let mut out = Vec::new();
    for dir in dirs {
        if !dir.exists() {
            continue;
        }
        for entry in walk(dir, 2) {
            if entry.extension().and_then(|e| e.to_str()) != Some("desktop") {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&entry) {
                let mut name = String::new();
                let mut exec = String::new();
                let mut icon = String::new();
                let mut in_section = false;
                for line in content.lines() {
                    let l = line.trim();
                    if l == "[Desktop Entry]" {
                        in_section = true;
                        continue;
                    }
                    if l.starts_with('[') {
                        in_section = false;
                        continue;
                    }
                    if !in_section {
                        continue;
                    }
                    if let Some(v) = l.strip_prefix("Name=") {
                        if name.is_empty() {
                            name = v.to_string();
                        }
                    } else if let Some(v) = l.strip_prefix("Exec=") {
                        exec = v.split_whitespace().next().unwrap_or(v).to_string();
                    } else if let Some(v) = l.strip_prefix("Icon=") {
                        icon = v.to_string();
                    }
                }
                if !exec.is_empty() && !name.is_empty() {
                    out.push(AppEntry {
                        id: slug(&entry),
                        name,
                        target: exec,
                        source: entry.to_string_lossy().to_string(),
                        icon: if icon.is_empty() { None } else { Some(icon) },
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out.dedup_by(|a, b| a.id == b.id);
    Ok(out)
}

/// Abre um aplicativo REAL: no Windows usa `explorer.exe` para caminhos
/// normais (resolve .lnk/associations como o Explorer faria) e cmd para
/// comandos; no Linux usa xdg-open. Retorna erro amigável se o alvo sumir —
/// o Orbe Continuity registra a falha sem fechar nada.
#[tauri::command]
pub fn launch_app(target: String) -> R<()> {
    if target.trim().is_empty() {
        return Err(ShellError("Nada para abrir.".into()));
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(&target)
            .spawn()
            .map_err(|e| ShellError(format!("Falha ao abrir {}: {}", target, e)))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| ShellError(format!("Falha ao abrir {}: {}", target, e)))?;
        Ok(())
    }
}

/// Resolve um atalho .lnk para seu destino real (para "Abrir local do
/// arquivo" etc.). No Linux retorna o próprio caminho.
#[tauri::command]
pub fn resolve_shortcut(source: String) -> R<String> {
    #[cfg(windows)]
    {
        if let Some((_, target)) = read_lnk(Path::new(&source)) {
            return Ok(target);
        }
        Err(ShellError("Não foi possível ler o atalho.".into()))
    }
    #[cfg(not(windows))]
    {
        Ok(source)
    }
}
