// Informações reais do sistema operacional (sem dados inventados).
use super::{R, ShellError};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SysInfo {
    pub os: String,          // ex.: "Windows 11" / "Linux" / "Darwin"
    pub version: String,     // build real do SO
    pub arch: String,
    pub hostname: String,
    pub cpus: usize,         // núcleos lógicos
    pub ram_total_gb: f64,   // 0 se indisponível nesta plataforma
    pub home: String,
}

fn pretty_os(name: &str, version: &str) -> (String, String) {
    let n = name.trim();
    if n.contains("Windows") {
        // Build >= 22000 é Windows 11; o resto mantém o nome reportado.
        let build: u32 = version.split('.').last().unwrap_or("0").parse().unwrap_or(0);
        let label = if build >= 22000 { "Windows 11".to_string() } else { n.to_string() };
        (label, version.to_string())
    } else {
        (n.to_string(), version.to_string())
    }
}

#[tauri::command]
pub fn sys_info() -> R<SysInfo> {
    let mut name = String::new();
    let mut rel = String::new();

    #[cfg(unix)]
    {
        use std::ffi::c_void;
        extern "C" {
            fn uname(buf: *mut c_void) -> i32;
        }
        unsafe {
            let mut buf = vec![0u8; 512];
            if uname(buf.as_mut_ptr() as *mut c_void) == 0 {
                let field = |off: usize| -> String {
                    let end = buf[off..].iter().position(|&c| c == 0).unwrap_or(0);
                    String::from_utf8_lossy(&buf[off..off + end]).to_string()
                };
                name = field(0);
                rel = field(65); // struct utsname: campos de 65 bytes
            }
        }
    }

    #[cfg(windows)]
    {
        name = "Windows NT".to_string();
        #[repr(C)]
        struct OsVersionInfoExW {
            dw_os_version_size: u32,
            dw_major_version: u32,
            dw_minor_version: u32,
            dw_build_number: u32,
            dw_platform_id: u32,
            sz_csd_version: [u16; 128],
        }
        extern "system" {
            fn RtlGetVersion(info: *mut OsVersionInfoExW) -> i32;
        }
        let mut info = OsVersionInfoExW {
            dw_os_version_size: std::mem::size_of::<OsVersionInfoExW>() as u32,
            dw_major_version: 0,
            dw_minor_version: 0,
            dw_build_number: 0,
            dw_platform_id: 0,
            sz_csd_version: [0; 128],
        };
        unsafe {
            if RtlGetVersion(&mut info) == 0 {
                rel = format!(
                    "{}.{}.{}",
                    info.dw_major_version, info.dw_minor_version, info.dw_build_number
                );
            }
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        name = std::env::consts::OS.to_string();
    }

    let (os_label, ver) = pretty_os(&name, &rel);

    Ok(SysInfo {
        os: os_label,
        version: ver,
        arch: std::env::consts::ARCH.to_string(),
        hostname: std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "local".to_string()),
        cpus: std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(0),
        ram_total_gb: ram_total_gb(),
        home: dirs_home(),
    })
}

pub fn dirs_home() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string())
}

fn ram_total_gb() -> f64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(mem) = std::fs::read_to_string("/proc/meminfo") {
            for line in mem.lines() {
                if line.starts_with("MemTotal:") {
                    let kb: f64 = line
                        .split_whitespace()
                        .nth(1)
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0.0);
                    return kb / 1024.0 / 1024.0;
                }
            }
        }
        0.0
    }
    #[cfg(windows)]
    {
        #[repr(C)]
        struct MEMORYSTATUSEX {
            dw_length: u32,
            dw_memory_load: u32,
            ull_total_phys: u64,
            ull_avail_phys: u64,
            ull_total_page_file: u64,
            ull_avail_page_file: u64,
            ull_total_virtual: u64,
            ull_avail_virtual: u64,
            ull_avail_extended_virtual: u64,
        }
        extern "system" {
            fn GlobalMemoryStatusEx(m: *mut MEMORYSTATUSEX) -> i32;
        }
        let mut m = MEMORYSTATUSEX {
            dw_length: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            dw_memory_load: 0,
            ull_total_phys: 0,
            ull_avail_phys: 0,
            ull_total_page_file: 0,
            ull_avail_page_file: 0,
            ull_total_virtual: 0,
            ull_avail_virtual: 0,
            ull_avail_extended_virtual: 0,
        };
        unsafe {
            if GlobalMemoryStatusEx(&mut m) != 0 {
                return m.ull_total_phys as f64 / 1024f64.powi(3);
            }
        }
        0.0
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        0.0
    }
}

/// Bateria real: /sys/class/power_supply no Linux, GetSystemPowerStatus no
/// Windows. Outras plataformas retornam erro amigável (o frontend degrada com
/// elegância — Orbe Continuity registra e oculta o indicador).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub has_battery: bool,
    pub percent: u8,
    pub charging: bool,
}

#[tauri::command]
pub fn battery_info() -> R<BatteryInfo> {
    #[cfg(target_os = "linux")]
    {
        let base = std::path::Path::new("/sys/class/power_supply");
        if let Ok(entries) = std::fs::read_dir(base) {
            for e in entries.flatten() {
                let p = e.path();
                if let Ok(t) = std::fs::read_to_string(p.join("type")) {
                    if t.trim() == "Battery" {
                        let cap = std::fs::read_to_string(p.join("capacity"))
                            .ok
                            .and_then(|s| s.trim().parse::<u8>().ok())
                            .unwrap_or(0);
                        let st = std::fs::read_to_string(p.join("status"))
                            .unwrap_or_default()
                            .trim()
                            .to_string();
                        return Ok(BatteryInfo {
                            has_battery: true,
                            percent: cap,
                            charging: st.eq_ignore_ascii_case("charging"),
                        });
                    }
                }
            }
        }
        return Ok(BatteryInfo { has_battery: false, percent: 0, charging: false });
    }
    #[cfg(windows)]
    {
        #[repr(C, packed)]
        struct SYSTEM_POWER_STATUS {
            ac_line_status: u8,
            battery_life_percent: u8,
            battery_system_flag: u8,
            battery_life_time: i8,
        }
        extern "system" {
            fn GetSystemPowerStatus(psi: *mut SYSTEM_POWER_STATUS) -> i32;
        }
        let mut s = SYSTEM_POWER_STATUS { ac_line_status: 0, battery_life_percent: 0, battery_system_flag: 0, battery_life_time: 0 };
        unsafe {
            if GetSystemPowerStatus(&mut s) != 0 && s.battery_system_flag & 0b1000_0000 != 0 {
                let pct = if s.battery_life_percent == 255 { 0 } else { s.battery_life_percent };
                return Ok(BatteryInfo {
                    has_battery: s.battery_life_percent != 128 || s.ac_line_status != 0,
                    percent: pct,
                    charging: s.ac_line_status == 1 || s.ac_line_status == 2,
                });
            }
        }
        Ok(BatteryInfo { has_battery: false, percent: 0, charging: false })
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        Err(ShellError("Indicador de bateria indisponível nesta plataforma.".into()))
    }
}
