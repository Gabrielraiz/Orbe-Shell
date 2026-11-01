// Orbe Update Center — verificação REAL de versão.
// Consulta o registro do Windows via PowerShell (sem dependências extras) e
// executa o instalador baixado SOMENTE após confirmação explícita do usuário.
use super::{ShellError, R};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestVersion {
    pub version: String,
    pub installer_url: String,
    pub channel: String,
}

#[derive(Deserialize)]
struct PsOut {
    #[serde(rename = "Version")]
    version: String,
    #[serde(rename = "Url")]
    url: String,
}

fn ps_quote(s: &str) -> String {
    s.replace('\'', "''")
}

/// Lê a última versão publicada no canal escolhido.
/// Canais suportados: "stable" | "beta".
#[tauri::command]
pub fn check_latest_version(channel: String) -> R<LatestVersion> {
    let channel = if channel == "beta" { "beta" } else { "stable" };
    // O script retorna um JSON com Version e DownloadUrl do último release do canal.
    let script = format!(
        "$ProgressPreference='SilentlyContinue';try{{$r=Invoke-RestMethod -Uri 'https://api.github.com/repos/Gabrielraiz/Orbe-Shell/releases?per_page=10' -Headers @{{Accept='application/vnd.github+json'}};foreach($i in $r){{if($i.prerelease -and '{ch}' -ne 'beta'){{continue}};foreach($a in $i.assets){{if($a.name -like '*.exe'){{@{{Version=$i.tag_name;Url=$a.browser_download_url}}|ConvertTo-Json -Compress;exit}}}}}};throw 'none'}}catch{{@{{Version='';Url='';Err=\"$($_.Exception.Message)\"}}|ConvertTo-Json -Compress}}"
    , ch = channel);

    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|_| {
            ShellError("PowerShell indisponível — verificação de atualização exige Windows.".into())
        })?;

    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let parsed: PsOut = serde_json::from_str(&text)
        .map_err(|_| ShellError("Não foi possível contactar o servidor de atualizações. Verifique sua conexão ou tente mais tarde.".into()))?;

    if parsed.version.is_empty() {
        return Err(ShellError(
            "Nenhuma versão publicada neste canal ainda.".into(),
        ));
    }
    Ok(LatestVersion {
        version: parsed.version,
        installer_url: parsed.url,
        channel: channel.to_string(),
    })
}

/// Baixa o instalador para a pasta Downloads e o executa.
/// A UI DEVE pedir confirmação antes de chamar este comando (pilar 11/12).
#[tauri::command]
pub fn download_and_run_installer(url: String) -> R<String> {
    if !(url.starts_with("https://")) {
        return Err(ShellError(
            "URL de instalação rejeitada por segurança (apenas HTTPS).".into(),
        ));
    }
    let _ = ps_quote(&url); // escapamento disponível para variações futuras do pipeline
    #[cfg(windows)]
    {
        let downloads = crate::commands::system::known_folder("downloads")
            .unwrap_or_else(crate::commands::system::dirs_home);
        let file = std::path::PathBuf::from(downloads).join("OrbeShell-Setup.exe");
        let script = format!(
            "$ProgressPreference='SilentlyContinue';Invoke-WebRequest -Uri '{}' -OutFile '{}';Start-Process '{}' ",
            ps_quote(&url),
            ps_quote(&file.to_string_lossy()),
            ps_quote(&file.to_string_lossy())
        );
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .spawn()
            .map_err(|e| ShellError(format!("Falha ao iniciar o instalador: {}", e)))?;
        Ok(format!(
            "Instalador iniciado. Arquivo salvo em: {}",
            file.display()
        ))
    }
    #[cfg(not(windows))]
    {
        Err(ShellError(
            "Atualização distribuída com instalador só está disponível no Windows.".into(),
        ))
    }
}
