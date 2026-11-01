// Sistema de arquivos REAL — Explorador de Arquivos do Orbe.
// Restrições de segurança: o shell só expõe operações dentro das pastas
// padrão do usuário (Home e subpastas). Qualquer caminho fora disso é
// recusado com erro amigável (permissões controladas por componente).
use super::{R, ShellError};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>, // epoch ms
}

fn within_home(p: &Path) -> R<PathBuf> {
    let home = crate::commands::system::dirs_home();
    let canon = p.canonicalize().map_err(|_| ShellError(format!("Caminho não encontrado: {}", p.display())))?;
    let h = Path::new(&home)
        .canonicalize()
        .map_err(|_| ShellError("Pasta pessoal indisponível.".into()))?;
    if canon.starts_with(&h) {
        Ok(canon)
    } else {
        Err(ShellError(format!(
            "Permissão negada pelo Orbe: {} está fora da pasta do usuário.",
            canon.display()
        )))
    }
}

fn ls(path: &Path) -> R<Vec<FsEntry>> {
    let mut out = Vec::new();
    for e in std::fs::read_dir(path)? {
        let e = e?;
        let meta = e.metadata().ok();
        out.push(FsEntry {
            name: e.file_name().to_string_lossy().to_string(),
            path: e.path().to_string_lossy().to_string(),
            is_dir: e.path().is_dir(),
            size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0)
                }),
        });
    }
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

/// Lista uma pasta real. Caminho vazio → raiz permitida (pasta do usuário).
#[tauri::command]
pub fn read_dir_entries(path: String) -> R<Vec<FsEntry>> {
    let target = if path.trim().is_empty() {
        PathBuf::from(crate::commands::system::dirs_home())
    } else {
        PathBuf::from(&path)
    };
    let safe = within_home(&target)?;
    ls(&safe)
}

#[tauri::command]
pub fn read_text_file(path: String) -> R<String> {
    let safe = within_home(&PathBuf::from(&path))?;
    std::fs::read_to_string(&safe).map_err(|e| ShellError(format!("Não foi possível ler {}: {}", path, e)))
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> R<()> {
    let p = PathBuf::from(&path);
    // Para escrita, o arquivo pode ainda não existir: validamos o pai.
    let parent = p.parent().ok_or_else(|| ShellError("Caminho inválido.".into()))?;
    let _ = within_home(parent)?;
    std::fs::write(&p, contents).map_err(|e| ShellError(format!("Falha ao salvar {}: {}", path, e)))
}

#[tauri::command]
pub fn delete_entry(path: String) -> R<String> {
    let safe = within_home(&PathBuf::from(&path))?;
    if safe.is_dir() {
        return Err(ShellError("O Orbe não apaga pastas em massa por segurança.".into()));
    }
    std::fs::remove_file(&safe)?;
    Ok(format!("Arquivo removido: {}", safe.display()))
}
