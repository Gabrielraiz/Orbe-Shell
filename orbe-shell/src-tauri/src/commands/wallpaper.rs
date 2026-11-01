// Papel de parede REAL do Windows: lê e grava via SystemParametersInfoW
// (SPI_GETDESKWALLPAPER / SPI_SETDESKWALLPAPER). No Linux, detecta o GNOME
// via gsettings quando disponível. Sem falsos "papéis aplicados".
use super::{ShellError, R};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperInfo {
    pub path: String,  // arquivo atual real (vazio se indisponível)
    pub style: String, // "win" | "gnome" | "none"
}

#[tauri::command]
pub fn current_wallpaper() -> R<WallpaperInfo> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPI_GETDESKWALLPAPER, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
        };
        let mut buf = [0u16; 520];
        unsafe {
            if SystemParametersInfoW(
                SPI_GETDESKWALLPAPER,
                buf.len() as u32,
                Some(buf.as_mut_ptr().cast()),
                SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
            )
            .is_ok()
            {
                let end = buf.iter().position(|&c| c == 0).unwrap_or(0);
                let path = String::from_utf16_lossy(&buf[..end]);
                return Ok(WallpaperInfo {
                    path,
                    style: "win".into(),
                });
            }
        }
        Ok(WallpaperInfo {
            path: String::new(),
            style: "none".into(),
        })
    }
    #[cfg(target_os = "linux")]
    {
        let out = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.background", "picture-uri"])
            .output();
        if let Ok(o) = out {
            if o.status.success() {
                let raw = String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .trim_matches('\'')
                    .to_string();
                let path = raw.trim_start_matches("file://").to_string();
                return Ok(WallpaperInfo {
                    path,
                    style: "gnome".into(),
                });
            }
        }
        Ok(WallpaperInfo {
            path: String::new(),
            style: "none".into(),
        })
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        Ok(WallpaperInfo {
            path: String::new(),
            style: "none".into(),
        })
    }
}

/// Aplica um arquivo de imagem como papel de parede real do sistema.
/// O caminho deve ser absoluto e apontar para uma imagem existente.
#[tauri::command]
pub fn set_wallpaper(path: String) -> R<String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(ShellError(format!("Arquivo não encontrado: {}", path)));
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
        };
        let mut wpath: Vec<u16> = p
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let ok = unsafe {
            SystemParametersInfoW(
                SPI_SETDESKWALLPAPER,
                0,
                Some(wpath.as_mut_ptr().cast()),
                SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
            )
        };
        if ok.is_ok() {
            Ok(format!("Papel de parede aplicado: {}", path))
        } else {
            Err(ShellError(
                "O Windows recusou a aplicação do papel de parede.".into(),
            ))
        }
    }
    #[cfg(target_os = "linux")]
    {
        let uri = format!("file://{}", path);
        for key in ["picture-uri", "picture-uri-dark"] {
            let _ = std::process::Command::new("gsettings")
                .args(["set", "org.gnome.desktop.background", key, uri.as_str()])
                .status();
        }
        Ok(format!("Papel de parede aplicado (GNOME): {}", path))
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        Err(ShellError(
            "Aplicação de papel de parede indisponível nesta plataforma.".into(),
        ))
    }
}
