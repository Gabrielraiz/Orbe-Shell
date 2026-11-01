// Informações reais do sistema operacional (sem dados inventados).
use super::{ShellError, R};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SysInfo {
    pub os: String,      // ex.: "Windows 11" / "Linux" / "Darwin"
    pub version: String, // build real do SO
    pub arch: String,
    pub hostname: String,
    pub cpus: usize,       // núcleos lógicos
    pub ram_total_gb: f64, // 0 se indisponível nesta plataforma
    pub home: String,
}

fn pretty_os(name: &str, version: &str) -> (String, String) {
    let n = name.trim();
    if n.contains("Windows") {
        // Build >= 22000 é Windows 11; o resto mantém o nome reportado.
        let build: u32 = version
            .split('.')
            .last()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let label = if build >= 22000 {
            "Windows 11".to_string()
        } else {
            n.to_string()
        };
        (label, version.to_string())
    } else {
        (n.to_string(), version.to_string())
    }
}

#[tauri::command]
pub fn sys_info() -> R<SysInfo> {
    #[cfg(unix)]
    let (mut n, mut r) = (String::new(), String::new());

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
                n = field(0);
                r = field(65); // struct utsname: campos de 65 bytes
            }
        }
    }

    #[cfg(windows)]
    let (n, r) = {
        use windows::Wdk::System::SystemServices::RtlGetVersion;
        use windows::Win32::System::SystemInformation::OSVERSIONINFOW;
        let mut info = OSVERSIONINFOW {
            dwOSVersionInfoSize: std::mem::size_of::<OSVERSIONINFOW>() as u32,
            ..Default::default()
        };
        unsafe { RtlGetVersion(&mut info) }.ok()?;
        (
            "Windows NT".to_string(),
            format!(
                "{}.{}.{}",
                info.dwMajorVersion, info.dwMinorVersion, info.dwBuildNumber
            ),
        )
    };

    #[cfg(not(any(unix, windows)))]
    let (n, r) = (std::env::consts::OS.to_string(), String::new());

    let (os_label, ver) = pretty_os(&n, &r);

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

/// Pasta "conhecida" real do usuário (Downloads, Documents...). No Windows
/// essas pastas podem ser redirecionadas; usamos o caminho padrão relativo à
/// pasta pessoal e verificamos a existência — sem inventar nada.
pub fn known_folder(name: &str) -> Option<String> {
    let home = dirs_home();
    let cand = std::path::Path::new(&home).join(name);
    if cand.is_dir() {
        Some(cand.to_string_lossy().to_string())
    } else {
        None
    }
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
        use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        let mut status = MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };
        if unsafe { GlobalMemoryStatusEx(&mut status) }.is_ok() {
            return status.ullTotalPhys as f64 / 1024f64.powi(3);
        }
        0.0
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        0.0
    }
}

// ── Desempenho em tempo real (monitor do Orbe) ────────────────────
// Sem dados inventados: usa APIs reais (GetSystemTimes/GlobalMemoryStatusEx
// no Windows, /proc/stat e /proc/meminfo no Linux). O estado anterior fica
// em um mutex — nada de variáveis globais mutáveis.
use std::sync::Mutex;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfStats {
    pub cpu_percent: f32, // uso da CPU entre a amostra anterior e agora (0-100)
    pub mem_used_mb: u64,
    pub mem_total_mb: u64,
}

#[derive(Default)]
pub struct PerfState(pub Mutex<Option<(u64, u64)>>); // (total, ocioso) acumulados

/// Amostra os contadores agregados de tempo de CPU (ticks).
fn cpu_counters() -> Option<(u64, u64)> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::FILETIME;
        use windows::Win32::System::Threading::GetSystemTimes;
        let (mut idle, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }.ok()?;
        let ticks =
            |time: FILETIME| (u64::from(time.dwHighDateTime) << 32) | u64::from(time.dwLowDateTime);
        Some((ticks(kernel) + ticks(user), ticks(idle)))
    }
    #[cfg(target_os = "linux")]
    {
        let s = std::fs::read_to_string("/proc/stat").ok()?;
        let l = s.lines().next()?;
        let mut it = l
            .split_whitespace()
            .skip(1)
            .map(|v| v.parse::<u64>().unwrap_or(0));
        let user = it.next()?;
        let nice = it.next()?;
        let system = it.next()?;
        let idle = it.next()?;
        let iowait = it.next().unwrap_or(0);
        let irq = it.next().unwrap_or(0);
        let softirq = it.next().unwrap_or(0);
        let steal = it.next().unwrap_or(0);
        Some((
            user + nice + system + idle + iowait + irq + softirq + steal,
            idle + iowait,
        ))
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        None
    }
}

fn mem_mb() -> (u64, u64) {
    #[cfg(windows)]
    {
        use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        let mut status = MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };
        if unsafe { GlobalMemoryStatusEx(&mut status) }.is_ok() {
            let total = status.ullTotalPhys / 1024 / 1024;
            let available = status.ullAvailPhys / 1024 / 1024;
            return (total - available, total);
        }
        (0, 0)
    }
    #[cfg(target_os = "linux")]
    {
        let meminfo = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
        let mut total_kb = 0u64;
        let mut avail_kb = 0u64;
        for line in meminfo.lines() {
            if line.starts_with("MemTotal:") {
                total_kb = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if line.starts_with("MemAvailable:") {
                avail_kb = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            }
        }
        ((total_kb - avail_kb) / 1024, total_kb / 1024)
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        (0, 0)
    }
}

#[tauri::command]
pub fn perf_stats(state: tauri::State<'_, PerfState>) -> R<PerfStats> {
    let cur = cpu_counters();
    let prev = state
        .0
        .lock()
        .map_err(|e| ShellError(e.to_string()))?
        .take();
    let cpu = match (cur, prev) {
        (Some(c), Some(p)) if c.0 > p.0 => {
            (1.0 - (c.1 - p.1) as f64 / (c.0 - p.0) as f64).clamp(0.0, 1.0) as f32 * 100.0
        }
        _ => 0.0,
    };
    if let Some(c) = cur {
        *state.0.lock().map_err(|e| ShellError(e.to_string()))? = Some(c);
    }
    let (used, total) = mem_mb();
    Ok(PerfStats {
        cpu_percent: cpu,
        mem_used_mb: used,
        mem_total_mb: total,
    })
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
                            .ok()
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
        return Ok(BatteryInfo {
            has_battery: false,
            percent: 0,
            charging: false,
        });
    }
    #[cfg(windows)]
    {
        use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
        let mut status = SYSTEM_POWER_STATUS::default();
        unsafe { GetSystemPowerStatus(&mut status) }?;
        let has_battery = status.BatteryFlag != 255 && status.BatteryFlag & 128 == 0;
        Ok(BatteryInfo {
            has_battery,
            percent: if has_battery && status.BatteryLifePercent <= 100 {
                status.BatteryLifePercent
            } else {
                0
            },
            charging: has_battery && status.BatteryFlag & 8 != 0,
        })
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        Err(ShellError(
            "Indicador de bateria indisponível nesta plataforma.".into(),
        ))
    }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn reads_windows_statistics_with_native_structures() {
        let info = super::sys_info().expect("Windows version is available");
        assert!(!info.version.is_empty());
        assert!(info.cpus > 0);
        assert!(info.ram_total_gb > 0.0);
        let (used, total) = super::mem_mb();
        assert!(total > 0 && used <= total);
        let (cpu, idle) = super::cpu_counters().expect("Windows CPU counters are available");
        assert!(cpu >= idle && cpu > 0);
        let battery = super::battery_info().expect("Windows power status is available");
        assert!(battery.percent <= 100);
    }
}
