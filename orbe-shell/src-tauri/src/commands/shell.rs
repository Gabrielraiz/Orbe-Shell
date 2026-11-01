// Registro de fallback do shell (Segurança e estabilidade — pilar 12).
//
// O Orbe NÃO substitui o Explorer por padrão. Quando o usuário ativa a
// "Troca de shell" experimental, escrevemos HKCU\...\Winlogon\Shell = caminho
// do executável ORBE_SHELL e registramos o valor anterior para restauração.
// Na próxima entrada (login) o Windows carrega o Orbe; se algo falhar, a
// Recuperação de Emergência (botão físico/seguro ou este comando via app)
// devolve o Explorer antes de qualquer reinício.
use super::{R, ShellError};
use serde::Serialize;

const SHELL_VALUE: &str = "OrbeShellEnabled";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FallbackStatus {
    pub enabled: bool,           // troca de shell ativa na próxima entrada?
    pub native_shell: String,    // shell original registrado (Explorer.exe etc.)
    pub exe_path: String,        // caminho deste executável
    pub platform_supported: bool,
}

// Implementação portável simples: guardamos o estado em arquivo no diretório
// de configuração do app (rota segura), e no Windows aplicamos o registro com
// `reg.exe` (API pública, sem dependências extras) apenas quando habilitado.
#[tauri::command]
pub fn get_explorer_fallback() -> R<FallbackStatus> {
    let exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let cfg = config_path()?;
    let enabled = std::fs::read_to_string(&cfg)
        .map(|s| s.trim() == "1")
        .unwrap_or(false);
    let native = std::env::var("OrbeNativeShell").unwrap_or_else(|_| "explorer.exe".into());
    Ok(FallbackStatus {
        enabled,
        native_shell: native,
        exe_path: exe,
        platform_supported: cfg!(windows),
    })
}

/// Habilita/desabilita a troca de shell para a PRÓXIMA entrada do Windows.
/// `enable=true` exige confirmação explícita da UI (com aviso + rollback).
#[tauri::command]
pub fn set_explorer_fallback(enable: bool) -> R<String> {
    let cfg = config_path()?;
    std::fs::write(&cfg, if enable { "1" } else { "0" })?;

    #[cfg(windows)]
    {
        // Aplica só o que é reversível e dentro do hive do usuário (HKCU).
        let exe = std::env::current_exe()
            .map_err(|_| ShellError("Não foi possível localizar o executável do Orbe.".into()))?
            .to_string_lossy()
            .to_string();
        let key = r"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon";
        if enable {
            // Guarda o shell atual ANTES de alterar (para rollback real).
            let cur = run_reg(&["query", key, "/v", "Shell"]);
            let prev = extract_reg_value(cur.as_str()).unwrap_or_else(|| "explorer.exe".into());
            let _ = std::fs::write(config_backup_path()?, &prev);
            run_reg(&["add", key, "/v", "Shell", "/t", "REG_SZ", "/d", &exe, "/f"])?;
            return Ok(format!(
                "Troca de shell agendada para a próxima entrada. Shell original guardado ({}) — use 'Voltar ao Explorer' para reverter.",
                prev
            ));
        } else {
            let prev = std::fs::read_to_string(config_backup_path()?)
                .unwrap_or_else(|_| "explorer.exe".into());
            run_reg(&["add", key, "/v", "Shell", "/t", "REG_SZ", "/d", prev.trim(), "/f"])?;
            return Ok(format!("Shell restaurado para {} na próxima entrada.", prev.trim()));
        }
    }
    #[cfg(not(windows))]
    {
        Ok(if enable {
            "A troca profunda de shell só está disponível no Windows; nada foi alterado neste sistema."
                .to_string()
        } else {
            "Fallback desativado.".to_string()
        })
    }
}

fn config_path() -> R<std::path::PathBuf> {
    let dir = dirs_orbe()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(SHELL_VALUE))
}

fn config_backup_path() -> R<std::path::PathBuf> {
    let dir = dirs_orbe()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("OrbeShellPrevShell"))
}

fn dirs_orbe() -> R<std::path::PathBuf> {
    let base = std::env::var("APPDATA")
        .or_else(|_| std::env::var("XDG_CONFIG_HOME"))
        .or_else(|_| std::env::var("HOME").map(|h| format!("{}/.config", h)))
        .map_err(|_| ShellError("Sem diretório de configuração disponível.".into()))?;
    Ok(std::path::PathBuf::from(base).join("OrbeShell"))
}

#[cfg(windows)]
fn run_reg(args: &[&str]) -> R<String> {
    let out = std::process::Command::new("reg")
        .args(args)
        .output()?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[cfg(windows)]
fn extract_reg_value(s: &str) -> Option<String> {
    for line in s.lines() {
        let l = line.trim_start();
        if l.starts_with("Shell") {
            if let Some(v) = l.split_whitespace().last() {
                return Some(v.to_string());
            }
        }
    }
    None
}
