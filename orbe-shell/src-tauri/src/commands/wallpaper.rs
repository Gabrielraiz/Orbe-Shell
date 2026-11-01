// Papel de parede REAL do Windows: lê e grava via SystemParametersInfoW
// (SPI_GETDESKWALLPAPER / SPI_SETDESKWALLPAPER). No Linux, detecta o GNOME
// via gsettings quando disponível. Sem falsos "papéis aplicados".
use super::{R, ShellError};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperInfo {
    pub path: String,     // arquivo atual real (vazio se indisponível)
    pub style: String,    // "win" | "gnome" | "none"
}

#[tauri::command]
pub fn current_wallpaper() -> R<WallpaperInfo> {
    #[cfg(windows)]
    {
        const SPI_GETDESKWALLPAPER: u32 = 0x0073;
        extern "system" {
            fn SystemParametersInfoW(action: u32, param: u32, pv: *mut u16, winini: u32) -> i32;
        }
        let mut buf = [0u16; 520];
        unsafe {
            if SystemParametersInfoW(SPI_GETDESKWALLPAPER, 260, buf.as_mut_ptr(), 0) != 0 {
                let end = buf.iter().position(|&c| c == 0).unwrap_or(0);
                let path = String::from_utf16_lossy(&buf[..end]);
                return Ok(WallpaperInfo { path, style: "win".into() });
            }
        }
        Ok(WallpaperInfo { path: String::new(), style: "none".into() })
    }
    #[cfg(target_os = "linux")]
    {
        let out = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.background", "picture-uri"])
            .output();
        if let Ok(o) = out {
            if o.status.success() {
                let raw = String::from_utf8_lossy(&o.stdout).trim().trim_matches('\'').to_string();
                let path = raw.trim_start_matches("file://").to_string();
                return Ok(WallpaperInfo { path, style: "gnome".into() });
            }
        }
        Ok(WallpaperInfo { path: String::new(), style: "none".into() })
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        Ok(WallpaperInfo { path: String::new(), style: "none".into() })
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
        const SPI_SETDESKWALLPAPER: u32 = 0x0014;
        const SPIF_UPDATEINIFILE: u32 = 0x01;
        const SPIF_SENDCHANGE: u32 = 0x02;
        extern "system" {
            fn SystemParametersInfoW(action: u32, param: u32, pv: *const u16, winini: u32) -> i32;
        }
        use std::os::windows::ffi::OsStrExt;
        let wpath: Vec<u16> = std::ffi::OsStr::new(p.as_os_str())
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let ok = unsafe {
            SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, wpath.as_ptr(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE)
        };
        if ok != 0 {
            Ok(format!("Papel de parede aplicado: {}", path))
        } else {
            Err(ShellError("O Windows recusou a aplicação do papel de parede.".into()))
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
        Err(ShellError("Aplicação de papel de parede indisponível nesta plataforma.".into()))
    }
}
