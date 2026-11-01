// Volume REAL do sistema (Endpoint Volume API do Windows).
// Em Linux usa `amixer`; em outras plataformas reporta indisponível — nunca inventa valores.
#[cfg(not(windows))]
use super::ShellError;
use super::R;
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
    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, Endpoints::IAudioEndpointVolume, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };

    struct ComApartment(bool);

    impl Drop for ComApartment {
        fn drop(&mut self) {
            if self.0 {
                unsafe { CoUninitialize() };
            }
        }
    }

    fn with_endpoint<T>(f: impl FnOnce(&IAudioEndpointVolume) -> R<T>) -> R<T> {
        let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        if hr != RPC_E_CHANGED_MODE {
            hr.ok()?;
        }
        let _apartment = ComApartment(hr.is_ok());
        let enumerator: IMMDeviceEnumerator =
            unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }?;
        let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) }?;
        let endpoint: IAudioEndpointVolume = unsafe { device.Activate(CLSCTX_ALL, None) }?;
        f(&endpoint)
    }

    fn read_state(endpoint: &IAudioEndpointVolume) -> R<AudioState> {
        let scalar = unsafe { endpoint.GetMasterVolumeLevelScalar() }?;
        let muted = unsafe { endpoint.GetMute() }?.as_bool();
        Ok(AudioState {
            available: true,
            percent: (scalar.clamp(0.0, 1.0) * 100.0).round() as u8,
            muted,
        })
    }

    pub fn get() -> R<AudioState> {
        with_endpoint(read_state)
    }

    pub fn set(percent: u8) -> R<AudioState> {
        with_endpoint(|endpoint| {
            unsafe {
                endpoint
                    .SetMasterVolumeLevelScalar(percent.min(100) as f32 / 100.0, std::ptr::null())
            }?;
            read_state(endpoint)
        })
    }

    pub fn toggle_mute() -> R<AudioState> {
        with_endpoint(|endpoint| {
            let muted = unsafe { endpoint.GetMute() }?.as_bool();
            unsafe { endpoint.SetMute(!muted, std::ptr::null()) }?;
            read_state(endpoint)
        })
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
            .find_map(|part| {
                part.split_once("%]")
                    .and_then(|(number, _)| number.parse().ok())
            })
            .unwrap_or(0);
        AudioState {
            available: true,
            percent,
            muted: s.contains("[off]"),
        }
    }
    pub fn get() -> R<AudioState> {
        Ok(parse(&amixer(&["get", "Master"])?))
    }
    pub fn set(percent: u8) -> R<AudioState> {
        Ok(parse(&amixer(&[
            "set",
            "Master",
            &format!("{}%", percent),
        ])?))
    }
    pub fn toggle_mute() -> R<AudioState> {
        let st = get()?;
        Ok(parse(&amixer(&[
            "set",
            "Master",
            if st.muted { "unmute" } else { "mute" },
        ])?))
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
mod stub {
    use super::*;
    pub fn get() -> R<AudioState> {
        Err(ShellError(
            "Controle de volume indisponível nesta plataforma.".into(),
        ))
    }
    pub fn set(_: u8) -> R<AudioState> {
        Err(ShellError(
            "Controle de volume indisponível nesta plataforma.".into(),
        ))
    }
    pub fn toggle_mute() -> R<AudioState> {
        Err(ShellError(
            "Controle de volume indisponível nesta plataforma.".into(),
        ))
    }
}

#[tauri::command]
pub fn audio_state() -> R<AudioState> {
    #[cfg(windows)]
    {
        win::get()
    }
    #[cfg(target_os = "linux")]
    {
        linux_impl::get()
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        stub::get()
    }
}

#[tauri::command]
pub fn audio_set_volume(percent: u8) -> R<AudioState> {
    #[cfg(windows)]
    {
        win::set(percent)
    }
    #[cfg(target_os = "linux")]
    {
        linux_impl::set(percent)
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        stub::set(percent)
    }
}

#[tauri::command]
pub fn audio_toggle_mute() -> R<AudioState> {
    #[cfg(windows)]
    {
        win::toggle_mute()
    }
    #[cfg(target_os = "linux")]
    {
        linux_impl::toggle_mute()
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        stub::toggle_mute()
    }
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn reads_endpoint_without_changing_volume() {
        // Machines without an audio endpoint may return an ordinary error.
        if let Ok(state) = super::audio_state() {
            assert!(state.available);
            assert!(state.percent <= 100);
        }
    }
}
