// Processos reais do sistema (Gerenciador de Tarefas do Orbe).
use super::R;
use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Proc {
    pub pid: u32,
    pub name: String,
    pub mem_mb: f64,
}

fn list_unix() -> R<Vec<Proc>> {
    let mut out = Vec::new();
    for e in std::fs::read_dir("/proc")? {
        let p = e?.path();
        let fname = match p.file_name().and_then(|n| n.to_str()) {
            Some(f) if f.chars().all(|c| c.is_ascii_digit()) => f.to_string(),
            _ => continue,
        };
        let pid: u32 = match fname.parse() {
            Ok(v) => v,
            Err(_) => continue,
        };
        // Nome real: /proc/<pid>/stat campo 2 (entre parênteses) — robusto a espaços.
        let stat = std::fs::read_to_string(p.join("stat")).unwrap_or_default();
        let name = stat
            .find('(')
            .and_then(|s| stat[s + 1..].rfind(')').map(|e| &stat[s + 1..s + 1 + e]))
            .unwrap_or("?")
            .to_string();
        // RSS em páginas (campo 24): cortamos tudo até ')' para ignorar espaços no nome.
        let after = stat.rfind(')').map(|i| &stat[i + 1..]).unwrap_or("");
        let rss_pages: u64 = after
            .split_whitespace()
            .nth(21) // campo 24 do stat == 22º token após o nome
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let page_kb = 4.0_f64;
        let mem_mb = rss_pages as f64 * page_kb / 1024.0;
        out.push(Proc { pid, name, mem_mb });
    }
    out.sort_by(|a, b| b.mem_mb.partial_cmp(&a.mem_mb).unwrap());
    out.truncate(120);
    Ok(out)
}

#[cfg(windows)]
fn list_windows() -> R<Vec<Proc>> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32,
        TH32CS_SNAPPROCESS,
    };
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)?;
        let mut entry = PROCESSENTRY32::default();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;
        let mut out = Vec::new();
        if Process32First(snap, &mut entry).is_ok() {
            loop {
                let name = String::from_utf16_lossy(&entry.szExeFile)
                    .trim_end_matches('\0')
                    .to_string();
                out.push(Proc { pid: entry.th32ProcessID, name, mem_mb: 0.0 });
                if Process32Next(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
        out.sort_by(|a, b| a.name.cmp(&b.name));
        out.truncate(150);
        Ok(out)
    }
}

#[tauri::command]
pub fn list_processes() -> R<Vec<Proc>> {
    #[cfg(windows)]
    {
        list_windows()
    }
    #[cfg(target_os = "linux")]
    {
        list_unix()
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        Err(super::ShellError("Lista de processos indisponível nesta plataforma.".into()))
    }
}

/// Encerra um processo pelo PID. Proteções de segurança: o shell recusa
/// matar a si mesmo e processos críticos do Windows quando nomeados.
#[tauri::command]
pub fn end_process(pid: u32, name: String) -> R<String> {
    let critical = ["csrss.exe", "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe"];
    if critical.iter().any(|c| c.eq_ignore_ascii_case(&name)) {
        return Err(super::ShellError(format!(
            "Segurança: {} é um processo crítico do Windows e não pode ser finalizado pelo Orbe.",
            name
        )));
    }
    if pid == std::process::id() {
        return Err(super::ShellError("O Orbe Shell não pode encerrar a si mesmo.".into()));
    }
    #[cfg(unix)]
    {
        std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()?;
    }
    #[cfg(windows)]
    {
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .stdout(std::process::Stdio::null())
            .spawn()?;
    }
    Ok(format!("Processo {} ({}) finalizado.", name, pid))
}
