// Volume REAL do sistema (Endpoint Volume API do Windows).
// Em Linux usa `amixer`; em outras plataformas reporta indisponível — nunca inventa valores.
use super::{R, ShellError};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioState {
    pub available: bool,
    pub percent: u8,
    pub muted: bool,
}

#[cfg(windows)]
mod win {
    use super::*;
    use windows::core::{Interface, GUID, HRESULT};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        EDataFlow, ERole, IMMDeviceEnumerator, MMDeviceEnumerator,
    };

    // Interfaces de Endpoint Volume — IID/VTBL públicos documentados por MS-SAPEVOE.
    #[repr(C)]
    #[allow(non_snake_case)]
    struct IAudioEndpointVolumeVtbl {
        _unknown: [unsafe extern "system" fn(); 3],
        _unused1: unsafe extern "system" fn(),
        _unused2: unsafe extern "system" fn(),
        GetMasterVolumeLevelScalar: unsafe extern "system" fn(*mut core::ffi::c_void, *mut f32) -> HRESULT,
        SetMasterVolumeLevelScalar: unsafe extern "system" fn(*mut core::ffi::c_void, f32, *const GUID) -> HRESULT,
        _unused3: unsafe extern "system" fn(),
        _unused4: unsafe extern "system" fn(),
        _unused5: unsafe extern "system" fn(),
        _unused6: unsafe extern "system" fn(),
        GetMute: unsafe extern "system" fn(*mut core::ffi::c_void, *mut i32) -> HRESULT,
        SetMute: unsafe extern "system" fn(*mut core::ffi::c_void, i32, *const GUID) -> HRESULT,
    }
    #[repr(C)]
    struct RawEndpointVolume(**const IAudioEndpointVolumeVtbl);

    const IID_IAEV: GUID = GUID::from_u128(0x5cdb2844_4481_4461_950f_52750613b915);

    fn with_endpoint<T>(f: impl FnOnce(&RawEndpointVolume) -> Option<T>) -> Option<T> {
        // COM precisa ser inicializado por thread (comandos rodam em threads próprias).
        let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        let owned = hr.is_ok();
        let result = (|| {
            let enumerator: IMMDeviceEnumerator =
                unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }.ok()?;
            let device = unsafe { enumerator.GetDefaultAudioEndpoint(EDataFlow::eRender, ERole::eConsole) }.ok()?;
            let obj = unsafe { device.Activate(&IID_IAEV, CLSCTX_ALL, None) }
                .ok()
                .map(|p: windows::core::IUnknown| p)?;
            let raw = RawEndpointVolume(obj.as_raw());
            std::mem::forget(obj); // liberamos manualmente abaixo
            let out = f(&raw);
            unsafe {
                let vt = *(*raw.0);
                (vt._unknown[2])(*raw.0 as *mut _); // Release
            }
            out
        })();
        if owned {
            unsafe { CoUninitialize() };
        }
        result
    }

    fn read_state(v: &RawEndpointVolume) -> Option<AudioState> {
        unsafe {
            let vt = &**v.0;
            let mut scalar: f32 = 0.0;
            (vt.GetMasterVolumeLevelScalar)(*v.0 as *mut _, &mut scalar).ok()?;
            let mut mute: i32 = 0;
            (vt.GetMute)(*v.0 as *mut _, &mut mute).ok()?;
            Some(AudioState {
                available: true,
                percent: (scalar.clamp(0.0, 1.0) * 100.0).round() as u8,
                muted: mute != 0,
            })
        }
    }

    pub fn get() -> R<AudioState> {
        with_endpoint(|v| read_state(v))
            .flatten()
            .ok_or_else(|| ShellError("Controle de volume indisponível neste dispositivo.".into()))
    }

    pub fn set(percent: u8) -> R<AudioState> {
        let p = percent.min(100) as f32 / 100.0;
        with_endpoint(|v| unsafe {
            let vt = &**v.0;
            (vt.SetMasterVolumeLevelScalar)(*v.0 as *mut _, p, std::ptr::null()).ok()?;
            read_state(v)
        })
        .flatten()
        .ok_or_else(|| ShellError("Não foi possível ajustar o volume.".into()))
    }

    pub fn toggle_mute() -> R<AudioState> {
        with_endpoint(|v| unsafe {
            let vt = &**v.0;
            let mut cur: i32 = 0;
            (vt.GetMute)(*v.0 as *mut _, &mut cur).ok()?;
            (vt.SetMute)(*v.0 as *mut _, if cur == 0 { 1 } else { 0 }, std::ptr::null()).ok()?;
            read_state(v)
        })
        .flatten()
        .ok_or_else(|| ShellError("Não foi possível alternar o mudo.".into()))
    }
}

#[cfg(target_os = "linux")]
mod linux_impl {
    use super::*;
    fn amixer(args: &[&str]) -> R<String> {
        let out = std::process::Command::new("amixer").args(args).output()?;
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    }
    fn parse(s: &str) -> AudioState {
        let percent = s
            .split('[')
            .find(|p| p.ends_with('%]'))
            .and_then(|p| p.trim_end_matches('%]').parse().ok())
            .unwrap_or(0);
        AudioState {
            available: true,
            percent,
            muted: s.contains("[off]"),
        }
    }
    pub fn get() -> R<AudioState> {
        Ok(parse(&amixer(&["get", "Master"])?) )
    }
    pub fn set(percent: u8) -> R<AudioState> {
        Ok(parse(&amixer(&["set", "Master", &format!("{}%", percent)])?))
    }
    pub fn toggle_mute() -> R<AudioState> {
        let st = get()?;
        Ok(parse(&amixer(&["set", "Master", if st.muted { "unmute" } else { "mute" }))?))
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
mod stub {
    use super::*;
    pub fn get() -> R<AudioState> {
        Err(ShellError("Controle de volume indisponível nesta plataforma.".into()))
    }
    pub fn set(_: u8) -> R<AudioState> {
        Err(ShellError("Controle de volume indisponível nesta plataforma.".into()))
    }
    pub fn toggle_mute() -> R<AudioState> {
        Err(ShellError("Controle de volume indisponível nesta plataforma.".into()))
    }
}

#[tauri::command]
pub fn audio_state() -> R<AudioState> {
    #[cfg(windows)]
    { win::get() }
    #[cfg(target_os = "linux")]
    { linux_impl::get() }
    #[cfg(not(any(windows, target_os = "linux")))]
    { stub::get() }
}

#[tauri::command]
pub fn audio_set_volume(percent: u8) -> R<AudioState> {
    #[cfg(windows)]
    { win::set(percent) }
    #[cfg(target_os = "linux")]
    { linux_impl::set(percent) }
    #[cfg(not(any(windows, target_os = "linux")))]
    { stub::set(percent) }
}

#[tauri::command]
pub fn audio_toggle_mute() -> R<AudioState> {
    #[cfg(windows)]
    { win::toggle_mute() }
    #[cfg(target_os = "linux")]
    { linux_impl::toggle_mute() }
    #[cfg(not(any(windows, target_os = "linux")))]
    { stub::toggle_mute() }
}
